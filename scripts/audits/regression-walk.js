async (page) => {
  const checks = []
  const add = (name, ok, detail) => checks.push({ name, ok, detail })

  // 固定视口：本走查的基线按桌面宽度定义（首页卡片行在窄屏是横向滚动容器，
  // 屏外卡片不显现属正确行为；视口漂移会让断言意义变化）
  await page.setViewportSize({ width: 1440, height: 900 })

  // 每次导航都装 CLS 观测器（累积位移分数）：骨架期站尾被推走的位移曾达 0.156，
  // 只有量出来才防得住（阈值取 0.02——远严于 Google「良好」线 0.1）。
  await page.addInitScript(() => {
    window.__cls = 0
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value
    }).observe({ type: 'layout-shift', buffered: true })
  })
  const clsNow = () => page.evaluate(() => Math.round((window.__cls ?? 0) * 1000) / 1000)

  // ---- 首页 ----
  await page.goto('http://localhost:4175/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1800)
  {
    const cls = await clsNow()
    // 首页基线 0.023（实测位移在 t≈83ms、字体加载之前：首帧后卡片/目录区高度收敛 34px）。
    // 阈值取 0.05 而非 0.02：仍能捕获 0.15 级的「骨架期站尾被推走」类回退，又不受首帧收敛噪声干扰
    add('home-cls', cls < 0.05, String(cls))
  }
  {
    const r = await page.evaluate(() => ({
      serif: getComputedStyle(document.querySelector('.page-title')).fontFamily.split(',')[0].replaceAll('"', '').trim(),
      // 同下图：只统计「视口内却未显现」的残留（视口外待显现属设计行为）。
      // 判定须双向：首页精选卡行在窄屏是横向滚动容器，屏外卡片本就未显现
      revealResidueInViewport: [...document.querySelectorAll('.reveal:not(.revealed)')].filter((el) => {
        const b = el.getBoundingClientRect()
        return b.top < innerHeight && b.bottom > 0 && b.left < innerWidth && b.right > 0
      }).length,
      cards: document.querySelectorAll('.specimen-card').length,
      title: document.title,
      // 首页目录 = 站点索引：4 数据类目 + 2 图文板块（战斗公式/数据说明）
      indexRows: document.querySelectorAll('.index-row').length,
      lastEntry: document.querySelector('.index-list li:last-child .name .zh')?.textContent.trim(),
    }))
    add('home-serif', r.serif === 'Noto Serif SC', r.serif)
    add('home-reveal-settled', r.revealResidueInViewport === 0, String(r.revealResidueInViewport))
    add('home-index-rows', r.indexRows === 6, String(r.indexRows))
    add('home-index-last', r.lastEntry === '数据说明', r.lastEntry ?? 'none')
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
      // v-reveal 是一次性显现：视口内区块必须已显现；视口外待滚动显现是设计行为，
      // 不能算缺陷（Round 17/33 曾因此误报——此处只统计视口内）
      inViewportHidden: [...document.querySelectorAll('section[id]')].filter((s) => {
        const b = s.getBoundingClientRect()
        const inView = b.top < innerHeight * 0.9 && b.bottom > innerHeight * 0.1
        return inView && getComputedStyle(s).opacity !== '1'
      }).length,
    }))
    add('detail-serif', r.serif === 'Noto Serif SC', r.serif)
    add('detail-backtop', r.scrollBtn, '')
    add('detail-inview-sections-visible', r.inViewportHidden === 0, String(r.inViewportHidden))
  }

  // ---- 翻页键盘 ----
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(1300)
  {
    const path = await page.evaluate(() => location.pathname)
    add('pager-arrow-right', path === '/agents/1031', path)
  }

  // ---- 数据说明页（页脚入口 + 动态数字） ----
  await page.goto('http://localhost:4175/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1400)
  {
    // 页脚入口可点且落到 /about
    const href = await page.evaluate(
      () => document.querySelector('.foot-link')?.getAttribute('href') ?? 'none',
    )
    add('footer-about-link', href === '/about', href)
    await page.goto('http://localhost:4175/about', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1800)
    const r = await page.evaluate(() => ({
      title: document.querySelector('.page-title')?.textContent.trim(),
      sections: document.querySelectorAll('section[id]').length,
      total: document.querySelectorAll('.spec-item dd')[2]?.textContent.trim(),
      cats: document.querySelectorAll('.spec-cat').length,
      version: document.querySelectorAll('.spec-item dd')[0]?.textContent.trim(),
    }))
    add('about-title', r.title === '数据说明', r.title ?? 'none')
    add('about-sections', r.sections === 4, String(r.sections))
    add('about-cats', r.cats === 4, String(r.cats))
    add('about-total', /^\d+ 条$/.test(r.total ?? ''), r.total ?? 'none')
    add('about-version', /LIVE \d/.test(r.version ?? ''), r.version ?? 'none')
  }

  // ---- 详情页 CLS（独立文档加载：SPA 内导航会让观测器跨页累加，须另起一次 goto）----
  {
    await page.goto('http://localhost:4175/agents/1021', { waitUntil: 'networkidle' })
    await page.waitForTimeout(2200)
    const cls = await clsNow()
    // 基线 0.001–0.007（骨架期站尾被推走曾达 0.156——:has(.state.loading) 规则已修）
    add('detail-cls-fresh', cls < 0.02, String(cls))
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
