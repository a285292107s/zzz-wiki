async (page) => {
  // 页面级 landmark 审计：每页恰好 1 个 h1、header/main/footer/nav 齐备
  const routes = ['/', '/agents', '/agents/1021', '/w-engines/14162', '/bangboos/54023', '/disks/34200', '/atlas', '/formulas', '/none']
  const report = {}
  for (const route of routes) {
    await page.goto('http://localhost:4175' + route, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1300)
    report[route] = await page.evaluate(() => ({
      h1: document.querySelectorAll('h1').length,
      header: document.querySelectorAll('header').length,
      main: document.querySelectorAll('main').length,
      footer: document.querySelectorAll('footer').length,
      navLabels: [...document.querySelectorAll('nav')].map((n) => n.getAttribute('aria-label')).filter(Boolean),
      imgsNoAlt: [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt') && !i.closest('[aria-hidden]')).length,
    }))
  }
  return JSON.stringify(report, null, 1)
}
