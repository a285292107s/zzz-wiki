async (page) => {
  const routes = ['/', '/agents', '/agents/1011', '/w-engines', '/w-engines/14162', '/bangboos', '/disks', '/formulas', '/atlas']
  const viewports = [[1920, 1080], [1440, 900], [1280, 800], [1024, 768], [820, 1180], [768, 1024], [390, 844], [360, 740]]
  const problems = []
  for (const [w, h] of viewports) {
    await page.setViewportSize({ width: w, height: h })
    for (const route of routes) {
      await page.goto('http://localhost:4175' + route)
      await page.waitForTimeout(650)
      const r = await page.evaluate(() => {
        const doc = document.documentElement
        const overflow = doc.scrollWidth - doc.clientWidth
        if (overflow <= 1) return null
        // 找出超宽元素
        const culprits = [...document.querySelectorAll('body *')]
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter((x) => x.r.right > doc.clientWidth + 1 && x.r.width > 0)
          .slice(0, 3)
          .map((x) => (x.el.tagName.toLowerCase()) + '.' + String(x.el.className).split(' ')[0].slice(0, 18) + '+w' + Math.round(x.r.width))
        return { overflow: Math.round(overflow), culprits }
      })
      if (r) problems.push({ vp: w + 'x' + h, route, ...r })
    }
  }
  await page.setViewportSize({ width: 1920, height: 1080 })
  return JSON.stringify({ total: problems.length, problems: problems.slice(0, 8) }, null, 1)
}
