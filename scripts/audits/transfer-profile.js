/* ============================================================
 * transfer-profile.js — 首访传输预算（冷缓存总重 + 分类明细）
 *
 * 为什么改成门禁而不是「仅测量」：竞奖档的硬指标之一就是**首访总重**（行业参考：获奖者
 * < 3MB）。此前本脚本只列字体分片的体积，既没有阈值、也漏掉图片/JS/CSS 这些大头，
 * 于是 `npm run audit:all` 只能标「？需人工判读」。
 *
 * 测量条件（必须**冷**，否则读到 0）：
 *   - 清 HTTP 缓存 + 注销 SW + 清 Cache Storage（SW 命中会把 transferSize 抹成 0）
 *   - 只测首页（最重、且带首屏头图）；分类明细用于定位超预算来源
 *
 * 阈值（与 QUALITY.md 记分卡一致）：
 *   总重 < 3MB（竞奖档）· 字体 ≤ 1.2MB（231 片 CJK 约 1MB）· 图片 ≤ 1MB
 *
 * 用法：npm run audit:all（或 playwright-cli run-code --filename=…）
 * 基线：总重 ~636KB / 字体与图片均在限内
 * ============================================================ */

async (page) => {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.clearBrowserCache')

  // 冷启动：注销 SW + 清 Cache Storage，否则 SW 命中会让 transferSize 全为 0
  await page.goto('http://localhost:4175/', { waitUntil: 'domcontentloaded' })
  await page.evaluate(async () => {
    const regs = await navigator.serviceWorker.getRegistrations()
    await Promise.all(regs.map((r) => r.unregister()))
    const keys = await caches.keys()
    await Promise.all(keys.map((k) => caches.delete(k)))
  })
  await cdp.send('Network.clearBrowserCache')

  await page.goto('http://localhost:4175/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)

  const r = await page.evaluate(() => {
    const res = performance.getEntriesByType('resource')
    const kb = (x) => (x.transferSize || x.decodedBodySize || 0) / 1024
    const byType = { js: 0, css: 0, font: 0, img: 0, json: 0, other: 0 }
    let total = 0
    for (const e of res) {
      const n = e.name
      const size = kb(e)
      total += size
      if (/\.js(\?|$)/.test(n)) byType.js += size
      else if (/\.css(\?|$)/.test(n)) byType.css += size
      else if (/\.woff2?(\?|$)/.test(n)) byType.font += size
      else if (/\.(webp|png|jpe?g|avif|svg)(\?|$)/.test(n)) byType.img += size
      else if (/\.json(\?|$)/.test(n)) byType.json += size
      else byType.other += size
    }
    const round = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v)]))
    return {
      requests: res.length,
      totalKB: Math.round(total),
      byTypeKB: round(byType),
      htmlKB: Math.round((performance.getEntriesByType('navigation')[0]?.transferSize || 0) / 1024),
    }
  })

  // 阈值（竞奖档）
  const LIMITS = { totalKB: 3072, fontKB: 1229, imgKB: 1024 }
  const failedItems = []
  if (r.totalKB >= LIMITS.totalKB)
    failedItems.push({ name: 'total-weight', ok: false, detail: `${r.totalKB}KB ≥ ${LIMITS.totalKB}KB` })
  if (r.byTypeKB.font > LIMITS.fontKB)
    failedItems.push({ name: 'font-weight', ok: false, detail: `${r.byTypeKB.font}KB > ${LIMITS.fontKB}KB` })
  if (r.byTypeKB.img > LIMITS.imgKB)
    failedItems.push({ name: 'img-weight', ok: false, detail: `${r.byTypeKB.img}KB > ${LIMITS.imgKB}KB` })

  return JSON.stringify({ total: 3, failed: failedItems.length, failedItems, measured: r, limits: LIMITS }, null, 1)
}
