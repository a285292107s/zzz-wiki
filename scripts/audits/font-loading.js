async (page) => {
  await page.goto('http://localhost:4175/agents/1011', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2200)
  return await page.evaluate(() =>
    JSON.stringify({
      serif: getComputedStyle(document.querySelector('.page-title')).fontFamily.split(',')[0].replaceAll('"', '').trim(),
      cssLink: !!document.querySelector('link[href*="noto-serif-sc.css"]'),
      loadedFragments: [...document.fonts].filter((f) => f.family.includes('Noto Serif') && f.status === 'loaded').length,
    }),
  )
}
