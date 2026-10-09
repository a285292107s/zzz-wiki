/* 详情页 LCP 可控测量（静态服务器版）：慢 4G + 4× CPU 节流。
   用法：node temp/static-server.mjs 起 4180（目录索引优先，模拟 Vercel 静态优先），
   再 playwright-cli run-code --filename=temp/lcp-probe-4180.js */
async (page) => {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await page.setViewportSize({ width: 390, height: 844 })

  await page.addInitScript(() => {
    window.__lcp = []
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        window.__lcp.push({
          t: Math.round(e.startTime),
          tag: e.element ? e.element.tagName.toLowerCase() : '',
          url: e.url ? e.url.split('/').slice(-1)[0] : '',
        })
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true })
  })

  await page.goto('http://localhost:4180/agents/1011', { waitUntil: 'load' })
  await page.waitForTimeout(3500)

  const out = await page.evaluate(() => {
    const lcp = window.__lcp.at(-1) ?? null
    const hero = performance
      .getEntriesByType('resource')
      .filter((r) => /hero\/(mobile\/)?Mindscape/.test(r.name))
      .map((r) => ({
        variant: r.name.includes('/mobile/') ? 'mobile' : 'full',
        start: Math.round(r.startTime),
        end: Math.round(r.responseEnd),
        kb: Math.round((r.transferSize || 0) / 1024),
      }))
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]
    return {
      lcp,
      fcp: fcp ? Math.round(fcp.startTime) : null,
      heroRequests: hero,
      preloads: [...document.querySelectorAll('link[rel=preload][as=image]')].length,
    }
  })
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  return JSON.stringify(out, null, 1)
}
