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

    // 搜索框聚焦指示：整框转琥珀（原先只把边框从 line-1 提到 line-2，深底上不可辨）
    await page.focus('.search input')
    await page.waitForTimeout(250)
    const focusRing = await page.evaluate(() => {
      const probe = document.createElement('span')
      probe.style.cssText = 'position:absolute;visibility:hidden;border:1px solid var(--focus)'
      document.body.appendChild(probe)
      const focusColor = getComputedStyle(probe).borderTopColor
      probe.remove()
      return {
        border: getComputedStyle(document.querySelector('.search')).borderTopColor,
        focusColor,
      }
    })
    add('search-focus-indicator', focusRing.border === focusRing.focusColor, `${focusRing.border} vs ${focusRing.focusColor}`)
    await page.evaluate(() => document.activeElement?.blur())

    // 同页状态变化（筛选/滑条经 URL 同步）不得被路由焦点管理抢走焦点——
    // 否则键盘用户选完筛选被抛到 main、滑条连按两步只生效一步
    await page.evaluate(() => document.querySelector('.filter-dropdown .trigger')?.focus())
    await page.keyboard.press('Enter')
    await page.waitForTimeout(350)
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(200)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(900)
    const kbFilter = await page.evaluate(() => ({
      url: location.search,
      focus: document.activeElement?.className ?? 'BODY',
      rows: document.querySelectorAll('tbody.d-body tr:not(.empty-row)').length,
    }))
    add(
      'kb-state-keeps-focus',
      /attr=/.test(kbFilter.url) && kbFilter.focus.includes('trigger') && kbFilter.rows < 60,
      JSON.stringify(kbFilter),
    )
    // 复位筛选，避免影响后续检查
    await page.goto('http://localhost:4175/agents', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)
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

    // 人名标题走 --fs-name 令牌（站内最醒目的排印元素不该游离在尺度外）
    const nameToken = await page.evaluate(() => {
      const probe = document.createElement('span')
      probe.style.cssText = 'position:absolute;visibility:hidden;font-size: var(--fs-name)'
      document.body.appendChild(probe)
      const tokenSize = getComputedStyle(probe).fontSize
      probe.remove()
      return { tokenSize, titleSize: getComputedStyle(document.querySelector('.main .page-title')).fontSize }
    })
    add('detail-name-token', nameToken.tokenSize === nameToken.titleSize, JSON.stringify(nameToken))

    // 逐条出处：详情页须显示本条所属的数据版本（可追溯到快照）
    const prov = await page.evaluate(() => {
      const el = document.querySelector('.prov')
      return { text: (el?.textContent ?? '').replace(/\s+/g, ' ').trim(), hasVer: !!document.querySelector('.prov-v') }
    })
    add('detail-provenance', prov.hasVer && /LIVE \d/.test(prov.text), prov.text || 'missing')

    // 桌面 hero 按 DPR 选图：DPR 1 用 1400w 派生（46KB），DPR ≥1.5 才用原图（311KB）。
    // 分支与逐路由 HTML 的预载 media 条件必须一致，否则预载与实取错位。
    const heroAt = async (dpr) => {
      const cdp = await page.context().newCDPSession(page)
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: dpr, mobile: false })
      await page.goto('http://localhost:4175/agents/1011', { waitUntil: 'networkidle' })
      await page.waitForTimeout(2200)
      const r = await page.evaluate(() => {
        const img = document.querySelector('.hero-bg img')
        return { src: (img?.currentSrc || img?.src || '').split('/').slice(-2).join('/'), nw: img?.naturalWidth ?? 0 }
      })
      await cdp.send('Emulation.clearDeviceMetricsOverride')
      return r
    }
    const heroDpr1 = await heroAt(1)
    const heroDpr2 = await heroAt(2)
    add(
      'detail-hero-dpr',
      heroDpr1.src.includes('mobile/') && heroDpr1.nw === 1400 && !heroDpr2.src.includes('mobile/') && heroDpr2.nw > 2000,
      `DPR1 ${heroDpr1.src}(${heroDpr1.nw}) / DPR2 ${heroDpr2.src}(${heroDpr2.nw})`,
    )
    await page.setViewportSize({ width: 1440, height: 900 })
    // 回到本段原本的页面（1021），否则后面的翻页断言会按 1011 的邻居失配
    await page.goto('http://localhost:4175/agents/1021', { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)

    // 区块导航「当前项」也要有悬停反馈（它已是 ink-0/琥珀，普通 hover 对它等于无变化）
    const navActive = await page.evaluate(() => {
      const el = document.querySelector('.sn-item.active')
      return el ? { sel: 'yes', color: getComputedStyle(el).color } : null
    })
    if (navActive) {
      await page.hover('.sn-item.active')
      await page.waitForTimeout(250)
      const after = await page.evaluate(() => getComputedStyle(document.querySelector('.sn-item.active')).color)
      add('hover-nav-active', after !== navActive.color, `${navActive.color} → ${after}`)
      await page.mouse.move(0, 0)
    }
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

  // ---- 复制视图链接（URL 带状态时才出现；复制内容 = 当前完整 URL） ----
  {
    await page.goto('http://localhost:4175/agents', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)
    const idleHidden = await page.evaluate(() => !document.querySelector('.copy-link'))
    add('copy-hidden-when-idle', idleHidden, String(idleHidden))

    await page.fill('.search input', '安')
    await page.waitForTimeout(700)
    const shown = await page.evaluate(
      () => document.querySelector('.copy-link')?.textContent.replace(/\s+/g, ' ').trim() ?? '',
    )
    add('copy-shown-when-stateful', shown.includes('复制'), shown || 'none')
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

    // 等级非默认 → 出现「复制此等级链接」，复制内容含 ?lv=
    const copyShown = await page.evaluate(
      () => document.querySelector('.copy-link')?.textContent.replace(/\s+/g, ' ').trim() ?? '',
    )
    add('level-copy-shown', copyShown.includes('复制'), copyShown || 'none')

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

  // ---- 排序深链（?sort=&dir=）与三态循环 ----
  {
    await page.goto('http://localhost:4175/agents?sort=rarity&dir=desc', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1600)
    const deep = await page.evaluate(() => ({
      ariaSort: [...document.querySelectorAll('thead th')].map((t) => t.getAttribute('aria-sort')).filter(Boolean),
      url: location.search,
    }))
    add('sort-deeplink', deep.url.includes('sort=rarity') && deep.ariaSort[0] === 'descending', JSON.stringify(deep))

    // 同键三击：升 → 降 → 回默认（默认键无表头，两态循环回不去），参数随之清空
    await page.goto('http://localhost:4175/agents', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)
    const first0 = await page.evaluate(() => document.querySelector('tbody.d-body tr .name')?.textContent.trim())
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => document.querySelectorAll('thead th .sort-btn')[1]?.click())
      await page.waitForTimeout(650)
    }
    const back = await page.evaluate(() => ({
      url: location.search,
      ariaSort: !!document.querySelector('thead th[aria-sort]'),
      first: document.querySelector('tbody.d-body tr .name')?.textContent.trim(),
    }))
    add('sort-third-toggle-default', back.url === '' && !back.ariaSort && back.first === first0, JSON.stringify(back))

    // 非法排序参数就地清理
    await page.goto('http://localhost:4175/agents?sort=zzz&dir=sideways', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1600)
    const cleaned = await page.evaluate(() => ({ url: location.search, ariaSort: !!document.querySelector('thead th[aria-sort]') }))
    add('sort-invalid-cleaned', cleaned.url === '' && !cleaned.ariaSort, JSON.stringify(cleaned))
  }

  // ---- 交互态：悬停必须有可见反馈（真实鼠标，非 CDP 强制） ----
  {
    const styleOf = (sel) =>
      page.evaluate((s) => {
        const el = document.querySelector(s)
        if (!el) return null
        const cs = getComputedStyle(el)
        return `${cs.color}|${cs.borderTopColor}`
      }, sel)

    // 站名（首页链接）：原先没有 hover 规则
    const brandBefore = await styleOf('.brand-mark')
    await page.hover('.brand')
    await page.waitForTimeout(250)
    const brandAfter = await styleOf('.brand-mark')
    add('hover-brand', brandBefore && brandAfter && brandBefore !== brandAfter, `${brandBefore} → ${brandAfter}`)
    await page.mouse.move(0, 0)

    // ⌘K 检索钮：transition 早已写好却一直没有 hover 规则
    const toggleBefore = await styleOf('.search-toggle')
    await page.hover('.search-toggle')
    await page.waitForTimeout(250)
    const toggleAfter = await styleOf('.search-toggle')
    add('hover-search-toggle', toggleBefore !== toggleAfter, `${toggleBefore} → ${toggleAfter}`)
    await page.mouse.move(0, 0)
  }

  // ---- reduced-motion：关掉动效后不得有残留动画/长过渡 ----
  {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const reduced = []
    for (const r of ['/', '/agents/1011']) {
      await page.goto('http://localhost:4175' + r, { waitUntil: 'networkidle' })
      await page.waitForTimeout(1600)
      const res = await page.evaluate(() => {
        let infinite = 0
        let longT = 0
        for (const el of document.querySelectorAll('body *')) {
          const cs = getComputedStyle(el)
          if (cs.display === 'none' || cs.visibility === 'hidden') continue
          if (cs.animationName !== 'none' && cs.animationIterationCount.includes('infinite')) infinite++
          const td = Math.max(...cs.transitionDuration.split(',').map((d) => parseFloat(d) || 0))
          if (td > 0.05) longT++
        }
        return { infinite, longT }
      })
      reduced.push({ r, ...res })
    }
    await page.emulateMedia({ reducedMotion: null })
    const bad = reduced.filter((x) => x.infinite || x.longT)
    add('reduced-motion-clean', bad.length === 0, bad.length ? JSON.stringify(bad) : JSON.stringify(reduced))
  }

  // ---- 文本对比度：非装饰文本最差须 ≥4.5（AA）。axe 对「背景是图片/渐变」的文字
  //      只能判「无法确定」，故这里自算有效背景补上这块覆盖。 ----
  {
    await page.goto('http://localhost:4175/agents', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1600)
    const worst = await page.evaluate(() => {
      const parse = (c) => {
        const m = /rgba?\(([^)]+)\)/.exec(c)
        if (!m) return null
        const [r, g, b, a = '1'] = m[1].split(',').map((x) => parseFloat(x))
        return { r, g, b, a }
      }
      const lum = ({ r, g, b }) => {
        const f = (v) => {
          const s = v / 255
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
        }
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
      }
      const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)
      const bgOf = (el) => {
        let n = el
        while (n && n !== document.documentElement) {
          const c = parse(getComputedStyle(n).backgroundColor)
          if (c && c.a > 0.5) return c
          n = n.parentElement
        }
        return { r: 13, g: 15, b: 17, a: 1 }
      }
      const decorative = (el) => {
        let n = el
        for (let d = 0; d < 4 && n; d++, n = n.parentElement) if (n.getAttribute?.('aria-hidden') === 'true') return true
        return false
      }
      let worst = { ratio: 99, sel: '' }
      for (const el of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(el)
        if (cs.display === 'none' || cs.visibility === 'hidden') continue
        if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue
        if (decorative(el)) continue
        const fg = parse(cs.color)
        if (!fg || fg.a <= 0.3) continue
        const cr = ratio(fg, bgOf(el))
        if (cr < worst.ratio) worst = { ratio: Math.round(cr * 100) / 100, sel: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : '') }
      }
      return worst
    })
    add('text-contrast-aa', worst.ratio >= 4.5, `最差 ${worst.ratio}:1（${worst.sel}）`)
  }

  // ---- 320px 重排（WCAG 1.4.10）与触屏档命中区（2.5.8）----
  {
    await page.setViewportSize({ width: 320, height: 720 })
    const wide = []
    for (const r of ['/', '/agents', '/agents/1011']) {
      await page.goto('http://localhost:4175' + r, { waitUntil: 'networkidle' })
      await page.waitForTimeout(1500)
      const res = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        scrollW: document.documentElement.scrollWidth,
      }))
      if (res.overflow) wide.push(`${r}(${res.scrollW})`)
    }
    add('reflow-320-no-overflow', wide.length === 0, wide.join(' ') || '320px 无横向溢出')

    // 触屏档：滑条拇指放大（CDP 触摸模拟可真正翻转 pointer: coarse）
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('http://localhost:4175/agents/1011', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1800)
    const cdp = await page.context().newCDPSession(page)
    const readSlider = () =>
      page.evaluate(() => {
        const el = document.querySelector('input.level-range')
        return {
          thumb: parseFloat(getComputedStyle(el).getPropertyValue('--thumb-size')) || 0,
          boxH: Math.round(el.getBoundingClientRect().height),
        }
      })
    const desktop = await readSlider()
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
    await page.waitForTimeout(300)
    const touch = await readSlider()
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false })
    add(
      'touch-slider-target',
      touch.thumb > desktop.thumb && touch.boxH >= 24 && desktop.boxH >= 24,
      `桌面 ${desktop.thumb}px/${desktop.boxH}px → 触屏 ${touch.thumb}px/${touch.boxH}px`,
    )
  }

  // ---- 无障碍树基本盘：h1 唯一 / 无冗余图片名 / 可交互元素都有名字 ----
  {
    const ax = []
    for (const r of ['/', '/agents', '/agents/1011']) {
      await page.goto('http://localhost:4175' + r, { waitUntil: 'networkidle' })
      await page.waitForTimeout(1500)
      const res = await page.evaluate(() => {
        const h1 = document.querySelectorAll('h1').length
        // 冗余图片名：alt 与所在链接/按钮的可见文本重复
        const redundant = [...document.querySelectorAll('img[alt]')].filter((img) => {
          const alt = (img.getAttribute('alt') || '').trim()
          if (!alt) return false
          const host = img.closest('a, button, [role="button"]')
          return !!host && (host.textContent || '').includes(alt)
        }).length
        // 无名可交互元素：无文本、无 aria-label、无 title、无 aria-labelledby
        const unnamed = [...document.querySelectorAll('a[href], button, [role="button"]')].filter((el) => {
          const cs = getComputedStyle(el)
          if (cs.display === 'none' || cs.visibility === 'hidden') return false
          const text = (el.textContent || '').trim()
          return (
            !text &&
            !el.getAttribute('aria-label') &&
            !el.getAttribute('title') &&
            !el.getAttribute('aria-labelledby') &&
            !el.querySelector('img[alt]:not([alt=""])')
          )
        }).length
        return { h1, redundant, unnamed }
      })
      if (res.h1 !== 1 || res.redundant > 0 || res.unnamed > 0) ax.push(`${r}: h1=${res.h1} 冗余=${res.redundant} 无名=${res.unnamed}`)
    }
    add('ax-basics', ax.length === 0, ax.join(' ⏐ ') || 'h1 唯一 / 无冗余图片名 / 无无名可交互元素')
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
      keyRows: document.querySelectorAll('.key-row').length,
      hasShortcuts: !!document.querySelector('#shortcuts'),
      // 字段覆盖：类目数 + 覆盖行数 + 缺口行数（缺口是「如实标注」而非错误）
      covCats: document.querySelectorAll('.cov-cat').length,
      covRows: document.querySelectorAll('.cov-row').length,
      covGaps: document.querySelectorAll('.cov-row dd.gap').length,
      covBadFractions: [...document.querySelectorAll('.cov-row dd')].filter((dd) => {
        const m = /(\d+)\s*\/\s*(\d+)/.exec(dd.textContent ?? '')
        return !m || Number(m[2]) === 0 || Number(m[1]) > Number(m[2])
      }).length,
    }))
    add('about-title', r.title === '数据说明', r.title ?? 'none')
    add('about-sections', r.sections === 6, String(r.sections))
    add('about-shortcuts', r.hasShortcuts && r.keyRows === 4, `rows=${r.keyRows}`)
    add(
      'about-coverage',
      r.covCats === 4 && r.covRows >= 6 && r.covBadFractions === 0,
      `类目 ${r.covCats} / 行 ${r.covRows} / 缺口 ${r.covGaps} / 非法分数 ${r.covBadFractions}`,
    )
    // 编号规则：号段必须由数据派生（形如 1011–1621），且四类目齐全
    const ranges = await page.evaluate(() =>
      [...document.querySelectorAll('.spec-cat .range')].map((el) => el.textContent.trim()),
    )
    add(
      'about-id-ranges',
      ranges.length === 4 && ranges.every((x) => /^\d+–\d+$/.test(x)),
      ranges.join(' '),
    )
    add('about-cats', r.cats === 4, String(r.cats))
    add('about-total', /^\d+ 条$/.test(r.total ?? ''), r.total ?? 'none')
    add('about-version', /LIVE \d/.test(r.version ?? ''), r.version ?? 'none')
  }

  // ---- 公式页：出处 + 版本锚定（机制版本 vs 数据版本并列）+ 通向实据的交叉引用 ----
  {
    await page.goto('http://localhost:4175/formulas', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1800)
    const r = await page.evaluate(() => ({
      sourceHref: document.querySelector('.notice-source .source-link')?.getAttribute('href') ?? '',
      ver: (document.querySelector('.notice-ver')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      linkHref: document.querySelector('.notice-link')?.getAttribute('href') ?? '',
      parts: document.querySelectorAll('section[id^="part-"]').length,
      eqs: document.querySelectorAll('.eq').length,
    }))
    add('formulas-source', r.sourceHref.includes('nga'), r.sourceHref.slice(0, 44) || 'missing')
    // 两个版本必须同时出现：只说「可能随版本调整」而不给可对照的版本号，等于没锚定
    add('formulas-version', r.ver.includes('机制整理') && /LIVE \d/.test(r.ver), r.ver || 'missing')
    add('formulas-crossref', r.linkHref === '/agents', r.linkHref || 'missing')
    add('formulas-content', r.parts >= 5 && r.eqs >= 3, `段 ${r.parts} / 公式 ${r.eqs}`)
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
