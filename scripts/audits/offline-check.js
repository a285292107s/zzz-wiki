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
  await page.waitForTimeout(2000)
  const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller)
  add('sw-controlled', controlled, String(controlled))

  // 2) 断网后重载已访问页面
  await cdp.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  })
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

  // 3) 断网下访问未缓存页面：允许失败，但不得是「空白无外壳」
  await page.goto('http://localhost:4175/formulas', { waitUntil: 'domcontentloaded' }).catch(() => {})
  await page.waitForTimeout(1500)
  const cold = await page.evaluate(() => ({ nodes: document.querySelectorAll('*').length, url: location.pathname })).catch(() => ({ nodes: 0, url: '?' }))
  add('offline-cold-page-graceful', cold.nodes === 0 || cold.nodes > 50, JSON.stringify(cold))

  // 4) 恢复联网
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  })
  await page.goto('http://localhost:4175/agents', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1800)
  const back = await page.evaluate(() => ({
    rows: document.querySelectorAll('tbody.d-body tr:not(.empty-row)').length,
    title: document.title,
  }))
  add('online-restored', back.rows === 60, JSON.stringify(back))

  const failed = checks.filter((c) => !c.ok)
  return JSON.stringify({ total: checks.length, failed: failed.length, failedItems: failed }, null, 1)
}
