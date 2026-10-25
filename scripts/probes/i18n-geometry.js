async (page) => {
  const ORIGIN = 'http://localhost:4175'
  const LANGS = ['zh', 'en', 'ja', 'ko']
  const WIDTHS = [320, 360, 375, 389, 390, 768, 1000, 1024, 1100, 1200, 1440, 1499, 1500, 1600, 1920]
  const ROUTES = ['/', '/agents', '/agents/1011', '/formulas']
  const out = { combos: 0, overflow: [], headerMisaligned: [], leaks: [], langMismatch: [] }

  for (const lang of LANGS) {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 })
      if (lang === 'zh') await page.evaluate(() => localStorage.removeItem('zzz-wiki:lang'))
      else await page.evaluate((l) => localStorage.setItem('zzz-wiki:lang', l), lang)
      for (const route of ROUTES) {
        await page.goto(ORIGIN + route)
        await page.waitForFunction(() => document.querySelector('main') && document.querySelector('main').textContent.trim().length > 40, null, { timeout: 10000 }).catch(() => {})
        await page.waitForFunction(() => document.fonts && document.fonts.status === 'loaded', null, { timeout: 20000 }).catch(() => {})
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
        const r = await page.evaluate(() => {
          const doc = document.documentElement
          const inner = document.querySelector('.masthead-inner')
          const brand = document.querySelector('.brand')
          const tools = document.querySelector('.masthead-tools')
          const innerCs = inner ? getComputedStyle(inner) : null
          const innerBox = inner ? inner.getBoundingClientRect() : null
          const contentLeft = innerBox && innerCs ? innerBox.left + parseFloat(innerCs.paddingLeft) : null
          const contentRight = innerBox && innerCs ? innerBox.right - parseFloat(innerCs.paddingRight) : null
          let leaks = 0
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
          while (walker.nextNode()) {
            if (/\[object Object\]|\bundefined\b|\bNaN\b/.test(walker.currentNode.textContent || '')) leaks++
          }
          const heads = [...document.querySelectorAll('.section-head')].filter((h) => h.scrollWidth - h.clientWidth > 1).length
          return {
            lang: doc.lang,
            over: doc.scrollWidth - doc.clientWidth,
            gapLeft: brand ? Math.round(brand.getBoundingClientRect().left - contentLeft) : null,
            gapRight: tools ? Math.round(contentRight - tools.getBoundingClientRect().right) : null,
            headOverflow: heads,
            leaks,
          }
        })
        out.combos++
        const where = `${lang}:${width}${route}`
        if (r.over > 1) out.overflow.push({ where, px: r.over })
        if (r.gapLeft !== 0 || r.gapRight !== 0) out.headerMisaligned.push({ where, gapLeft: r.gapLeft, gapRight: r.gapRight })
        if (r.headOverflow) out.leaks.push({ where, kind: 'section-head-overflow', n: r.headOverflow })
        if (r.leaks) out.leaks.push({ where, kind: 'text-leak', n: r.leaks })
        const langOk = lang === 'zh' ? r.lang.toLowerCase().startsWith('zh') : r.lang === lang
        if (!langOk) out.langMismatch.push({ where, htmlLang: r.lang })
      }
    }
  }
  await page.evaluate(() => localStorage.removeItem('zzz-wiki:lang'))
  await page.setViewportSize({ width: 1440, height: 900 })
  return JSON.stringify(out, null, 1)
}
