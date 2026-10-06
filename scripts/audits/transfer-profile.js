async (page) => {
  // 字体分片传输画像：首页加载了哪些分片、各多大（transferSize 在内存缓存下为 0——用 decodedBodySize 兜底）
  await page.goto('http://localhost:4175/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  return await page.evaluate(() => {
    const rs = performance.getEntriesByType('resource').filter((r) => r.name.includes('/fonts/'))
    const detail = rs.map((r) => ({
      f: r.name.split('/').pop().slice(0, 26),
      kb: +(((r.transferSize || 0) + (r.decodedBodySize || 0) || 0) / 1024).toFixed(1),
      t: Math.round(r.startTime),
    }))
    return JSON.stringify({ count: rs.length, detail })
  })
}
