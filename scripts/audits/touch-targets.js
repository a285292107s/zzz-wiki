async (page) => {
  // 触屏目标尺寸审计：所有可交互元素的命中区几何
  await page.setViewportSize({ width: 390, height: 844 })
  const routes = ['/', '/agents', '/agents/1011', '/disks']
  const problems = []
  let checked = 0
  for (const route of routes) {
    await page.goto('http://localhost:4175' + route, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)
    const found = await page.evaluate(() => {
      const out = []
      const els = document.querySelectorAll('a[href], button, input, [role="slider"], [role="option"]')
      for (const el of els) {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) continue
        const style = getComputedStyle(el)
        if (style.visibility === 'hidden' || style.display === 'none') continue
        // 视口内才查
        if (r.bottom < 0 || r.top > innerHeight) continue
        // WCAG 2.5.8: min 24x24 CSS px（例外：内联文本链接、由周围 spacing 保证间隔的目标）
        const w = Math.round(r.width)
        const h = Math.round(r.height)
        const isTextLink = el.tagName === 'A' && el.children.length === 0 && /inline/.test(style.display)
        if (w < 24 || h < 24) {
          out.push({
            tag: el.tagName.toLowerCase(),
            cls: String(el.className).split(' ')[0].slice(0, 20),
            w,
            h,
            text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 10),
            isTextLink,
          })
        }
      }
      return out
    })
    for (const p of found) problems.push({ route, ...p })
    checked++
  }
  await page.setViewportSize({ width: 1920, height: 1080 })
  return JSON.stringify({ routesChecked: checked, problems: problems.slice(0, 20) }, null, 1)
}
