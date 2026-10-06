async (page) => {
  const checks = []
  const add = (name, ok, detail) => checks.push({ name, ok, detail })

  // ---- 首页 ----
  await page.goto('http://localhost:4175/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1800)
  {
    const r = await page.evaluate(() => ({
      serif: getComputedStyle(document.querySelector('.page-title')).fontFamily.split(',')[0].replaceAll('"', '').trim(),
      revealResidue: document.querySelectorAll('.reveal:not(.revealed)').length,
      cards: document.querySelectorAll('.specimen-card').length,
      title: document.title,
    }))
    add('home-serif', r.serif === 'Noto Serif SC', r.serif)
    add('home-reveal-settled', r.revealResidue === 0, String(r.revealResidue))
    add('home-cards', r.cards === 4, String(r.cards))
    add('home-title', r.title.includes('绳网档案'), r.title)
  }

  // ---- 名录页 + 检索 + 筛选 ----
  await page.goto('http://localhost:4175/agents', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  {
    const r = await page.evaluate(() => ({
      search: !!document.querySelector('.search input'),
      filterTriggers: document.querySelectorAll('.filter-dropdown .trigger').length,
      rows: document.querySelectorAll('tbody.d-body tr').length,
      ariaCurrent: [...document.querySelectorAll('.nav a')].filter((a) => a.getAttribute('aria-current')).length,
      searchToggle: !!document.querySelector('.search-toggle'),
    }))
    add('agents-search', r.search, '')
    add('agents-filters', r.filterTriggers === 3, String(r.filterTriggers))
    add('agents-rows', r.rows === 60, String(r.rows))
    add('agents-aria-current', r.ariaCurrent === 1, String(r.ariaCurrent))
    add('header-search-btn', r.searchToggle, '')
  }

  // ---- ⌘K 检索链路 ----
  await page.keyboard.press('Control+k')
  await page.waitForTimeout(800)
  await page.keyboard.type('猫又')
  await page.waitForTimeout(450)
  {
    const r = await page.evaluate(() => ({
      rows: [...document.querySelectorAll('.qs-row .qs-name')].map((x) => x.textContent.trim()),
      overflow: document.documentElement.style.overflow === 'hidden',
    }))
    add('qs-zh-results', r.rows.includes('猫又'), JSON.stringify(r.rows.slice(0, 3)))
    add('qs-scroll-lock', r.overflow, '')
  }
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1400)
  {
    const r = await page.evaluate(() => ({
      path: location.pathname,
      title: document.title,
      pager: !!document.querySelector('.detail-pager'),
    }))
    add('qs-enter-nav', r.path === '/agents/1021', r.path)
    add('detail-title', r.title.includes('猫又'), r.title)
    add('detail-pager', r.pager, '')
  }

  // ---- 详情页：字体/翻页/scrollspy/BackToTop ----
  {
    const r = await page.evaluate(() => ({
      serif: getComputedStyle(document.querySelector('.page-title, .dh-title')).fontFamily.split(',')[0].replaceAll('"', '').trim(),
      scrollBtn: !!document.querySelector('.back-top'),
      sectionsOk: [...document.querySelectorAll('section[id]')].every((s) => getComputedStyle(s).opacity === '1'),
    }))
    add('detail-serif', r.serif === 'Noto Serif SC', r.serif)
    add('detail-backtop', r.scrollBtn, '')
    add('detail-sections-visible', r.sectionsOk, '')
  }

  // ---- 翻页键盘 ----
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(1300)
  {
    const path = await page.evaluate(() => location.pathname)
    add('pager-arrow-right', path === '/agents/1031', path)
  }

  // ---- 404 ----
  await page.goto('http://localhost:4175/none', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  {
    const t = await page.evaluate(() => document.querySelector('.page-title')?.textContent.trim())
    add('404', t === '档案缺失', t ?? 'none')
  }

  // ---- 汇总 ----
  const failed = checks.filter((c) => !c.ok)
  return JSON.stringify({ total: checks.length, failed: failed.length, failedItems: failed, checks }, null, 1)
}
