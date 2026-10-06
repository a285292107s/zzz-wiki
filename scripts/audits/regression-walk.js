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
    // 首页基线 0.000（原 0.023：hero-meta 的版本位用 v-if，清单到达后窄屏多折一行
    // 把下方推下 34px；改为常驻占位后位移归零）。阈值 0.02 与详情页一致，
    // 仍能捕获 0.15 级的「骨架期站尾被推走」类回退
    add('home-cls', cls < 0.02, String(cls))
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

  // ---- 名录空态（检索无匹配 → 文案 + 清除出路 → 一键恢复）----
  {
    await page.fill('.search input', 'zzzzzz')
    await page.waitForTimeout(600)
    const empty = await page.evaluate(() => {
      const cell = document.querySelector('.empty-cell')
      const btn = document.querySelector('.empty-clear')
      return {
        shown: !!cell,
        text: (cell?.querySelector('.empty-title')?.textContent ?? '').trim(),
        clear: btn?.textContent.trim() ?? '',
        rows: document.querySelectorAll('tbody.d-body tr:not(.empty-row)').length,
      }
    })
    add('agents-empty-state', empty.shown && empty.rows === 0, `${empty.text} | rows=${empty.rows}`)
    add('agents-empty-clear', empty.clear.includes('清除'), empty.clear || 'no-button')
    if (empty.shown) {
      await page.click('.empty-clear')
      await page.waitForTimeout(600)
      const restored = await page.evaluate(() => ({
        rows: document.querySelectorAll('tbody.d-body tr:not(.empty-row)').length,
        input: document.querySelector('.search input')?.value ?? '',
      }))
      add('agents-empty-restored', restored.rows === 60 && restored.input === '', JSON.stringify(restored))
    }
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

  // ---- 路由切换的焦点管理（SPA 无障碍：切页后焦点不能留在旧页面）----
  {
    // 区块索引（hash 直达）→ 焦点应落到目标区块（区块带 tabindex="-1"）
    const nav = await page.evaluate(() => {
      const a = document.querySelector('.sn-item')
      const href = a?.getAttribute('href') ?? ''
      return { href, id: href.includes('#') ? href.slice(href.lastIndexOf('#') + 1) : '' }
    })
    if (nav.id) {
      await page.evaluate((h) => document.querySelector(`.sn-item[href="${h}"]`)?.click(), nav.href)
      await page.waitForTimeout(1300)
      const focusedId = await page.evaluate(() => document.activeElement?.id ?? '')
      add('hash-focus-target', focusedId === nav.id, `${focusedId}（期望 ${nav.id}）`)
    } else {
      add('hash-focus-target', false, '未找到区块索引链接')
    }
  }

  // ---- 翻页键盘 ----
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(1300)
  {
    const path = await page.evaluate(() => location.pathname)
    add('pager-arrow-right', path === '/agents/1031', path)
    // 翻页（路由切换）后焦点须落到正文容器，读屏才会播报新条目
    const focused = await page.evaluate(() => document.activeElement?.id ?? '')
    add('route-change-focus-main', focused === 'main', focused || 'body')
  }

  // ---- 加载失败态：可读文案 + 重试出路（拦截数据请求再放开） ----
  {
    await page.route('**/data/live/weapon.json', (r) => r.abort())
    await page.goto('http://localhost:4175/w-engines', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1800)
    const err = await page.evaluate(() => {
      const box = document.querySelector('.state.err')
      return {
        shown: !!box,
        role: box?.getAttribute('role') ?? '',
        title: box?.querySelector('.err-title')?.textContent.trim() ?? '',
        retry: box?.querySelector('.err-retry')?.textContent.trim() ?? '',
        hint: (box?.querySelector('.err-hint')?.textContent.trim() ?? '').length,
        invalid: !!document.querySelector('p > button'),
      }
    })
    add('error-state-copy', err.shown && err.role === 'alert' && err.title.includes('数据加载失败') && err.hint > 10, `${err.title} | hint=${err.hint}`)
    add('error-state-retry-btn', err.retry === '重新加载', err.retry || 'none')
    add('error-state-valid-dom', !err.invalid, `p>button=${err.invalid}`)
    await page.unrouteAll({ behavior: 'ignoreErrors' })
    if (err.shown) {
      await page.click('.err-retry')
      await page.waitForTimeout(1600)
      const recovered = await page.evaluate(
        () => document.querySelectorAll('tbody.d-body tr:not(.empty-row)').length,
      )
      add('error-state-retry-recovers', recovered === 100, `rows=${recovered}`)
    }
  }

  // ---- 内容完整性抽样（全量扫描见 content-sweep.js：238 页 0 异常）----
  // 抽 5 页覆盖四类详情 + 已知「最简内容」页（1531 档案仅一行、31000 套装仅一句）
  {
    const sample = ['/agents/1011', '/agents/1531', '/w-engines/14162', '/bangboos/54023', '/disks/31000']
    const bad = []
    for (const p of sample) {
      await page.goto('http://localhost:4175' + p, { waitUntil: 'domcontentloaded' })
      await page.waitForFunction(() => !!document.querySelector('h1, .page-title'), null, { timeout: 6000 }).catch(() => {})
      await page.waitForTimeout(400)
      const r = await page.evaluate(() => {
        const text = document.body.innerText || ''
        const leak = /undefined|null|NaN|\[object Object\]|\{\{/.exec(text)
        const empty = [...document.querySelectorAll('section[id]')]
          .map((s) => {
            const c = s.cloneNode(true)
            c.querySelectorAll('h1,h2,h3,.section-head,.sr-only').forEach((h) => h.remove())
            return { id: s.id, rest: (c.textContent || '').replace(/\s+/g, ' ').trim() }
          })
          .filter((x) => x.rest.length < 4)
          .map((x) => x.id)
        const broken = [...document.querySelectorAll('img')].filter(
          (i) => i.complete && i.naturalWidth === 0 && i.getAttribute('src'),
        ).length
        return {
          leak: leak ? text.slice(Math.max(0, leak.index - 20), leak.index + 20).replace(/\s+/g, ' ') : '',
          empty,
          broken,
          desc: document.querySelector('meta[name=description]')?.getAttribute('content') ?? '',
        }
      })
      if (r.leak || r.empty.length || r.broken || !r.desc)
        bad.push(`${p}${r.leak ? ' 泄漏' : ''}${r.empty.length ? ' 空区块:' + r.empty.join(',') : ''}${r.broken ? ' 断图' + r.broken : ''}${!r.desc ? ' 缺description' : ''}`)
    }
    add('content-sample-clean', bad.length === 0, bad.join(' ⏐ ') || '5 页抽样无异常')
  }

  // ---- 等级深链（?lv= 可分享视图；改等级不得丢滚动位置） ----
  {
    await page.goto('http://localhost:4175/agents/1011?lv=55', { waitUntil: 'networkidle' })
    await page.waitForTimeout(2200)
    const deep = await page.evaluate(() => ({
      level: document.querySelector('.level-range')?.value,
      url: location.search,
    }))
    add('level-deeplink', deep.level === '55' && deep.url.includes('lv=55'), JSON.stringify(deep))

    // 中段改等级：URL 跟随且滚动保持（滑条实测在 y≈1450，依赖 scrollBehavior 同路由不滚动）
    await page.evaluate(() => window.scrollTo(0, 1500))
    await page.waitForTimeout(400)
    const y0 = await page.evaluate(() => Math.round(window.scrollY))
    await page.evaluate(() => {
      const s = document.querySelector('.level-range')
      s.value = '42'
      s.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await page.waitForTimeout(900)
    const after = await page.evaluate(() => ({
      y: Math.round(window.scrollY),
      url: location.search,
      level: document.querySelector('.level-range')?.value,
    }))
    add('level-sync-url', after.url.includes('lv=42') && after.level === '42', JSON.stringify(after))
    add('level-keeps-scroll', Math.abs(after.y - y0) < 120, `before=${y0} after=${after.y}`)

    // 翻页到相邻条目：等级与 lv 参数一并重置（不把上一档等级带给下一个角色）
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(1500)
    const next = await page.evaluate(() => ({
      path: location.pathname,
      search: location.search,
      level: document.querySelector('.level-range')?.value,
    }))
    add('level-reset-on-pager', next.path !== '/agents/1011' && next.search === '' && next.level === '60', JSON.stringify(next))
  }

  // ---- 数据说明页（页脚入口 + 动态数字） ----  await page.goto('http://localhost:4175/', { waitUntil: 'networkidle' })
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
