/* ============================================================
 * offline-check.js — 离线阅读能力审计（playwright-cli run-code）
 *
 * 背景：数据说明页承诺「离线打开已缓存页面仍可阅读」——没有 Service Worker 时
 * 这是空话（HTML 响应头 must-revalidate，离线重载直接失败）。本脚本把该承诺变成
 * 可验收项：
 *   1) 首次在线访问若干页 → SW 接管（controller 存在）
 *   2) **断网**（CDP Network.emulateNetworkConditions offline）后重新加载同一页面
 *      → 仍渲染出正文（标题 / 关键区块）
 *   3) 断网下再访问**未访问过**的页面 → 允许失败，但不得白屏到没有任何站点外壳
 *   4) 恢复联网后一切照旧（不残留坏状态）
 *
 * 依赖：构建产物含 sw.js（`npm run build:ci` 后 preview 运行中）。
 * 用法：playwright-cli open http://localhost:4175 && \
 *       playwright-cli run-code --filename=scripts/audits/offline-check.js
 * 基线：已访问页面离线可读；SW 已接管
 * ============================================================ */

async (page) => {
  const checks = []
  const add = (name, ok, detail) => checks.push({ name, ok, detail })
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.clearBrowserCache')

  // 0) 自清理：注销可能残留的 SW 并清空其缓存。
  //    浏览器配置跨审计复用，旧注册会**不重新拉取脚本**就继续生效——
  //    不清的话本审计可能「因上一轮的 SW」通过（负向验证时实测踩到：删掉 dist/sw.js 仍全绿）。
  await page.goto('http://localhost:4175/', { waitUntil: 'domcontentloaded' })
  await page.evaluate(async () => {
    const regs = await navigator.serviceWorker.getRegistrations()
    await Promise.all(regs.map((r) => r.unregister()))
    const keys = await caches.keys()
    await Promise.all(keys.map((k) => caches.delete(k)))
  })
  await cdp.send('Network.clearBrowserCache')

  // 1) 在线访问两页，让 SW 接管并缓存
  await page.goto('http://localhost:4175/agents/1011', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  await page.goto('http://localhost:4175/about', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)

  const sw = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration()
    return { registered: !!reg, active: !!reg?.active, controller: !!navigator.serviceWorker.controller }
  })
  add('sw-registered', sw.registered && sw.active, JSON.stringify(sw))

  // 等 SW 接管本页（首次注册后需要一次导航或 clients.claim）
  await page.reload({ waitUntil: 'networkidle' })
  // **确定性等待 SW 就绪**，而不是定时猜测：安装要预缓存 /offline.html，
  // 在浏览器刚跑完别的审计（忙）时 2s 可能不够 → 曾出现「兜底页未缓存 → 离线落到
  // 浏览器错误页」的偶发失败（三次复跑均通过，确认是竞态而非功能问题）。
  let ready = { controlled: false, offlineCached: false }
  for (let i = 0; i < 20; i++) {
    ready = await page.evaluate(async () => {
      const controlled = !!navigator.serviceWorker.controller
      let offlineCached = false
      for (const k of await caches.keys()) {
        const c = await caches.open(k)
        if (await c.match('/offline.html')) offlineCached = true
      }
      return { controlled, offlineCached }
    })
    if (ready.controlled && ready.offlineCached) break
    await page.waitForTimeout(400)
  }
  add('sw-controlled', ready.controlled, JSON.stringify(ready))

  // 2) 断网后重载已访问页面
  // **必须用 context.setOffline**：CDP 的 Network.emulateNetworkConditions({offline:true})
  // 只作用于页面 target，**SW 自己发起的 fetch 不在其中**——SW 仍能联网取回真实页面，
  // 于是「离线」检查会因错误原因通过（本审计首版即如此，实测发现后改为上下文级断网）。
  await page.context().setOffline(true)
  let offlineDetail = await page.evaluate(async () => {
    // 等一小会儿让离线状态生效，再重载
    await new Promise((r) => setTimeout(r, 300))
    location.reload()
    return 'reloading'
  }).catch(() => 'reload-threw')
  void offlineDetail
  await page.waitForTimeout(3500)
  const offlinePage = await page.evaluate(() => ({
    url: location.pathname,
    title: document.title,
    h1: document.querySelector('h1')?.textContent?.trim() ?? '',
    nodes: document.querySelectorAll('*').length,
    prov: !!document.querySelector('.prov'),
  }))
  add(
    'offline-visited-page',
    offlinePage.nodes > 100 && offlinePage.h1.length > 0,
    JSON.stringify(offlinePage),
  )

  // 3) 断网下访问未缓存页面：应落到**离线兜底页**（自包含、可读、给出返回入口），
  //    而不是浏览器空白/错误页——这是「离线能力」的最后一环。
  await page.goto('http://localhost:4175/disks/34200', { waitUntil: 'domcontentloaded' }).catch(() => {})
  await page.waitForTimeout(1500)
  const cold = await page
    .evaluate(() => ({
      title: document.title,
      h1: document.querySelector('h1')?.textContent?.trim() ?? '',
      text: (document.body.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40),
      links: [...document.querySelectorAll('a')].map((a) => a.getAttribute('href')).filter(Boolean),
      nodes: document.querySelectorAll('*').length,
    }))
    .catch(() => ({ title: '', h1: '', text: '', links: [], nodes: 0 }))
  add(
    'offline-fallback-page',
    cold.h1 === '当前离线' && cold.links.includes('/') && cold.nodes > 20,
    JSON.stringify(cold),
  )

  // 4) 恢复联网
  await page.context().setOffline(false)
  await page.goto('http://localhost:4175/agents', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1800)
  const back = await page.evaluate(() => ({
    rows: document.querySelectorAll('tbody.d-body tr:not(.empty-row)').length,
    title: document.title,
  }))
  add('online-restored', back.rows === 60, JSON.stringify(back))

  // 5) 缓存有界：图片 ≤180、数据 JSON ≤100（sw.js 的 MAX_IMAGE_ENTRIES=160 / MAX_DATA_ENTRIES=80
  //    + 每 20 次写入修剪一次的节流余量）。无上限时浏览完整档案会累积数十 MB。
  for (const r of ['/agents/1011', '/agents/1021', '/w-engines', '/bangboos', '/disks', '/about']) {
    await page.goto('http://localhost:4175' + r, { waitUntil: 'networkidle' })
    await page.waitForTimeout(900)
  }
  const cacheStats = await page.evaluate(async () => {
    const names = await caches.keys()
    let images = 0
    let data = 0
    let kb = 0
    for (const n of names) {
      const c = await caches.open(n)
      for (const k of await c.keys()) {
        const p = new URL(k.url).pathname
        if (/\.(?:webp|png|jpe?g|avif|gif)$/.test(p)) images++
        else if (p.startsWith('/data/') && p.endsWith('.json')) data++
        const res = await c.match(k)
        if (res) kb += (await res.clone().arrayBuffer()).byteLength / 1024
      }
    }
    return { images, data, kb: Math.round(kb) }
  })
  add(
    'cache-bounded',
    cacheStats.images <= 180 && cacheStats.data <= 100 && cacheStats.kb < 20000,
    JSON.stringify(cacheStats),
  )

  // 6) 回访零网络：SW 热缓存下再访已浏览页面，**传输量应为 0 且资源全部由 SW 处理**
  //    （实测：首访 881KB / 122 项 → 回访 0KB / 128 项全由 SW 命中）。这是回访用户的实际收益。
  await page.goto('http://localhost:4175/agents/1011', { waitUntil: 'load' })
  await page.waitForTimeout(2500)
  const repeat = await page.evaluate(() => {
    const res = performance.getEntriesByType('resource')
    return {
      kb: Math.round(res.reduce((n, x) => n + (x.transferSize || 0), 0) / 1024),
      sw: res.filter((x) => (x.workerStart || 0) > 0).length,
      total: res.length,
    }
  })
  add('repeat-visit-zero-network', repeat.kb === 0 && repeat.sw === repeat.total, JSON.stringify(repeat))

  const failed = checks.filter((c) => !c.ok)
  return JSON.stringify({ total: checks.length, failed: failed.length, failedItems: failed }, null, 1)
}
