/* 详情页桌面 hero 选图验证：DPR 1 应取 1400w 派生（46KB），DPR 2 应取原图（311KB）。 */
async (page) => {
  const out = {}
  for (const dpr of [1, 2]) {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.clearBrowserCache')
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: dpr,
      mobile: false,
    })
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    })
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })

    await page.addInitScript(() => {
      window.__lcp = []
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) window.__lcp.push({ t: Math.round(e.startTime), url: e.url ? e.url.split('/').slice(-1)[0] : '' })
      }).observe({ type: 'largest-contentful-paint', buffered: true })
    })
    await page.goto('http://localhost:4180/agents/1011', { waitUntil: 'load' })
    await page.waitForTimeout(5000)
    const r = await page.evaluate(() => {
      const img = document.querySelector('.hero-bg img')
      const hero = performance
        .getEntriesByType('resource')
        .filter((x) => /hero\/(mobile\/)?Mindscape/.test(x.name))
        .map((x) => ({
          variant: x.name.includes('/mobile/') ? 'mobile-1400w' : 'full-res',
          kb: Math.round((x.transferSize || 0) / 1024),
          start: Math.round(x.startTime),
          end: Math.round(x.responseEnd),
        }))
      return {
        dpr: window.devicePixelRatio,
        chosenSrc: img ? (img.currentSrc || img.src).split('/').slice(-2).join('/') : 'none',
        naturalW: img?.naturalWidth ?? 0,
        hero,
        lcp: window.__lcp.at(-1) ?? null,
      }
    })
    out[`dpr${dpr}`] = r
    await cdp.send('Emulation.clearDeviceMetricsOverride')
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  }
  return JSON.stringify(out, null, 1)
}
