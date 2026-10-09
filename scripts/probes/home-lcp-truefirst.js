/* 可重复的「真首访」LCP 测量：新上下文 + 禁 SW + 禁缓存 + 移动节流。
   （此前直接在共享 page 上测：测量导航自身会注册 SW 并缓存资源，导致后续读数全是缓存命中） */
async (page) => {
  const ctx = await page.context().browser().newContext({ serviceWorkers: 'block' })
  const p = await ctx.newPage()
  const cdp = await ctx.newCDPSession(p)
  await cdp.send('Network.enable')
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await p.setViewportSize({ width: 390, height: 844 })
  await p.addInitScript(() => {
    window.__lcp = []
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        const el = e.element
        window.__lcp.push({
          t: Math.round(e.startTime),
          url: (e.url || '').split('/').pop(),
          tag: el?.tagName?.toLowerCase() ?? '',
          cls: String(el?.className ?? '').split(' ')[0],
        })
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true })
  })
  await p.goto('http://localhost:4175/', { waitUntil: 'load' })
  await p.waitForTimeout(9000)
  const r = await p.evaluate(() => {
    const hero = performance.getEntriesByType('resource').filter((x) => /hero\/card\//.test(x.name))
    return {
      lcp: window.__lcp.at(-1) ?? null,
      chain: window.__lcp.map((x) => `${x.t}:${x.tag}`),
      hero: hero.map((x) => ({
        f: x.name.split('/').pop().slice(0, 22),
        start: Math.round(x.startTime),
        end: Math.round(x.responseEnd),
        kb: Math.round((x.transferSize || 0) / 1024),
      })),
      bootLoaded: performance.getEntriesByType('resource').some((x) => /boot-picks\.js/.test(x.name)),
    }
  })
  await ctx.close()
  return JSON.stringify(r, null, 1)
}
