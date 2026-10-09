/* DPR 2 桌面详情 LCP：节流 vs 不节流对比（判断 5.0s 是否只是严苛节流的产物）。 */
async (page) => {
  const out = {}
  for (const [label, throttle] of [['节流(1.6Mbps/4xCPU)', true], ['不节流(典型桌面)', false]]) {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.clearBrowserCache')
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false })
    if (throttle) {
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 })
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    }
    await page.addInitScript(() => {
      window.__lcp = []
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) window.__lcp.push({ t: Math.round(e.startTime), url: e.url ? e.url.split('/').slice(-1)[0] : '' })
      }).observe({ type: 'largest-contentful-paint', buffered: true })
    })
    await page.goto('http://localhost:4175/agents/1011', { waitUntil: 'load' })
    await page.waitForTimeout(throttle ? 8000 : 3000)
    const r = await page.evaluate(() => {
      const hero = performance.getEntriesByType('resource').filter((x) => /hero\/(mobile\/)?Mindscape/.test(x.name)).map((x) => ({ v: x.name.includes('/mobile/') ? 'mobile' : 'full', kb: Math.round((x.transferSize || 0) / 1024), end: Math.round(x.responseEnd) }))
      return { lcp: window.__lcp.at(-1) ?? null, hero }
    })
    out[label] = r
    await cdp.send('Emulation.clearDeviceMetricsOverride')
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  }
  return JSON.stringify(out, null, 1)
}
