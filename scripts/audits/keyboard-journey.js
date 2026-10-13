/* ============================================================
 * keyboard-journey.js — 键盘完整旅程审计（playwright-cli run-code，WCAG 2.1.1）
 *
 * 此前只验证过「焦点可见」与「Tab 顺序」；本脚本验证**每个任务能否纯键盘走通**，
 * 且焦点不被系统抢走（SPA 里最常见的破绽：状态同步触发路由钩子把焦点抛到 main）。
 *
 * 覆盖：跳转链接 / 全局检索（开→输入→方向键→回车→Esc 归还焦点）/ 筛选下拉
 * （开→方向键→回车→**焦点归还触发钮**）/ 名录检索输入 / 详情翻页 / 等级滑条
 * （连按两步必须都生效）/ 回到顶部 / 术语浮层 / 窄屏 ☰ 导航菜单
 * （开→条目与站头导航同数→Esc 关闭→焦点归还）/ 点当前页条目也收起 / 检索面板不兼任
 * 导航（窄屏与桌面一致）/ Esc 在任意焦点位置都能关检索面板 / 菜单开着时 Ctrl+K 先收菜单 /
 * 纯空格查询的空态判据与模板一致 / 空态「检索范围」只在无最近访问时出现。
 *
 * 用法：playwright-cli open http://localhost:4175 && \
 *       playwright-cli run-code --filename=scripts/audits/keyboard-journey.js
 * 基线：全部旅程通过（0 失败）
 * ============================================================ */

async (page) => {
  const checks = []
  const add = (name, ok, detail) => checks.push({ name, ok, detail })
  const active = () => page.evaluate(() => {
    const el = document.activeElement
    return el && el !== document.body ? `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ')[0] : ''}` : 'BODY'
  })

  /* ---------- 1) 跳转链接 ---------- */
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('http://localhost:4175/agents', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1600)
  await page.keyboard.press('Tab')
  const skipFocus = await active()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(400)
  add('kb-skip-link', skipFocus.includes('skip-link') && (await active()).includes('main'), `${skipFocus} → ${await active()}`)

  /* ---------- 2) 全局检索：开 → 输入 → 方向键 → 回车 → 导航 ---------- */
  await page.keyboard.press('Control+k')
  await page.waitForTimeout(600)
  await page.keyboard.insertText('猫又')
  await page.waitForTimeout(800)
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(250)
  const qsActive = await active()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1400)
  add('kb-quicksearch-nav', qsActive.includes('qs') && /\/agents\/\d+/.test(page.url()), `${qsActive} → ${page.url()}`)

  /* ---------- 3) 筛选下拉：开 → 方向键 → 回车 → 应用 + 焦点归还 ---------- */
  await page.goto('http://localhost:4175/agents', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1600)
  await page.evaluate(() => document.querySelector('.filter-dropdown .trigger')?.focus())
  await page.keyboard.press('Enter')
  await page.waitForTimeout(400)
  add('kb-filter-open', !!(await page.evaluate(() => document.querySelector('.popover [role=option]'))), '')
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(250)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(900)
  const filterRes = await page.evaluate(() => ({
    url: location.search,
    rows: document.querySelectorAll('tbody.d-body tr:not(.empty-row)').length,
    focus: document.activeElement?.className ?? 'BODY',
  }))
  add('kb-filter-applies', /attr=/.test(filterRes.url) && filterRes.rows < 60, JSON.stringify(filterRes))
  // 焦点必须留在触发钮：同页 query 变化不该被路由焦点管理抢走
  add('kb-filter-focus-stays', filterRes.focus.includes('trigger'), filterRes.focus)

  /* ---------- 4) 名录检索输入（直接聚焦输入框：Tab 的下一个元素会随状态变化） ---------- */
  await page.evaluate(() => document.querySelector('.search input')?.focus())
  await page.waitForTimeout(200)
  const searchFocused = await active()
  await page.keyboard.insertText('安')
  await page.waitForTimeout(800)
  const typed = await page.evaluate(() => ({
    url: location.search,
    rows: document.querySelectorAll('tbody.d-body tr:not(.empty-row)').length,
  }))
  add('kb-search-type', searchFocused.includes('input') && /q=/.test(typed.url) && typed.rows < 60, `${searchFocused} ${JSON.stringify(typed)}`)

  /* ---------- 5) 详情：翻页 / 滑条连按 / 回到顶部 ---------- */
  await page.goto('http://localhost:4175/agents/1011', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2200)
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(1400)
  add('kb-pager-arrow', /\/agents\/\d+$/.test(page.url()) && page.url() !== 'http://localhost:4175/agents/1011', page.url())

  await page.evaluate(() => document.querySelector('.level-range')?.focus())
  const lv0 = await page.evaluate(() => Number(document.querySelector('.level-range')?.value))
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(600)
  const lv1 = await page.evaluate(() => Number(document.querySelector('.level-range')?.value))
  // 连按两步必须都生效——若 URL 同步把焦点抢走，第二步会落空
  add('kb-slider-two-steps', lv1 === lv0 - 2, `${lv0} → ${lv1}`)

  await page.evaluate(() => window.scrollTo(0, 2000))
  await page.waitForTimeout(300)
  await page.evaluate(() => document.querySelector('.back-top')?.focus())
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1200)
  add('kb-back-top', (await page.evaluate(() => Math.round(window.scrollY))) < 100, '')

  /* ---------- 6) 术语浮层（键盘聚焦触发） ---------- */
  await page.goto('http://localhost:4175/agents/1021', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2400)
  const tipOpened = await page.evaluate(async () => {
    const t = [...document.querySelectorAll('.rich-term')].find((el) => el.offsetParent !== null)
    if (!t) return false
    t.scrollIntoView({ block: 'center' })
    await new Promise((r) => setTimeout(r, 300))
    t.focus()
    await new Promise((r) => setTimeout(r, 900))
    return !!document.querySelector('.term-tip')
  })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  add('kb-term-tip', tipOpened, String(tipOpened))

  /* ---------- 7) 窄屏 ☰ 菜单：开 → 与站头导航同数 → Esc 关闭 → 焦点归还 ---------- */
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:4175/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1600)
  // 站头主排导航在 ≤979 隐去，☰ 菜单接管（检索面板不兼任导航，两个断点都不列，见 7b）
  await page.evaluate(() => document.querySelector('.menu-toggle')?.focus())
  await page.keyboard.press('Enter')
  await page.waitForTimeout(500)
  const menuMobile = await page.evaluate(() => {
    const panel = document.querySelector('#site-menu')
    return {
      open: !!panel && getComputedStyle(panel).display !== 'none',
      expanded: document.querySelector('.menu-toggle')?.getAttribute('aria-expanded'),
      items: document.querySelectorAll('#site-menu .menu-item').length,
      // 与主排导航同源：即便主排导航在窄屏不可见，DOM 里的条目数仍应一致
      navItems: document.querySelectorAll('.nav .nav-item').length,
    }
  })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  const afterMenuEsc = await active()
  // 菜单条目必须与站头导航同一份清单（不是「至少 4 项」）：数值漂移即说明两处清单脱钩
  add(
    'kb-mobile-nav-menu',
    menuMobile.open &&
      menuMobile.expanded === 'true' &&
      menuMobile.items > 0 &&
      menuMobile.items === menuMobile.navItems &&
      afterMenuEsc.includes('menu-toggle'),
    JSON.stringify({ ...menuMobile, focus: afterMenuEsc }),
  )

  /* ---------- 7aa) 菜单里点「当前页自己」也必须收起（回归护栏） ----------
     只靠 watch(route.fullPath) 时这一条会失败：路径没变 → watch 不触发 → 菜单赖着
     不收、切换钮仍读作 expanded（发布前独立审查实测到的真缺陷）。修法是面板上加
     一层 click 委托，与 watch 互补（正常跳转两者都命中，同页跳转只有委托能命中）。 */
  await page.goto('http://localhost:4175/agents', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1400)
  await page.click('.menu-toggle')
  await page.waitForTimeout(350)
  // 第一项就是 /agents（01 代理人），点它 = 点当前页
  await page.click('#site-menu .menu-item:nth-child(1)')
  await page.waitForTimeout(700)
  const afterSelfNav = await page.evaluate(() => ({
    path: location.pathname,
    open: getComputedStyle(document.querySelector('#site-menu')).display !== 'none',
    expanded: document.querySelector('.menu-toggle').getAttribute('aria-expanded'),
  }))
  add(
    'kb-mobile-menu-self-nav-closes',
    afterSelfNav.path === '/agents' && !afterSelfNav.open && afterSelfNav.expanded === 'false',
    JSON.stringify(afterSelfNav),
  )

  /* ---------- 7b) 检索面板不兼任导航：窄屏与桌面**都不**列类目入口 → Esc 归还焦点 ----------
     导航入口归站头（≥980 主排导航 / ≤979 ☰ 菜单）；面板若再列一遍同一批目的地，
     就是两个入口指同一处。这一条守住「面板只做检索」在两个断点上都成立。 */
  const probePanel = async (w) => {
    await page.setViewportSize({ width: w, height: 844 })
    await page.goto('http://localhost:4175/', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)
    await page.evaluate(() => document.querySelector('.search-toggle')?.focus())
    await page.keyboard.press('Enter')
    await page.waitForTimeout(1500)
    const r = await page.evaluate(() => {
      const scrim = document.querySelector('.qs-scrim')
      const panel = document.querySelector('.qs-panel')
      // 面板内的站内链接：检索结果行是 button，故任何 <a href> 都属于「额外导航入口」
      const links = panel ? [...panel.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')) : []
      return {
        open: !!scrim && getComputedStyle(scrim).display !== 'none',
        quickEntriesBlock: !!document.querySelector('.qs-quick-entries'),
        links,
      }
    })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(600)
    return { ...r, focus: await active() }
  }
  const panelNarrow = await probePanel(390)
  const panelWide = await probePanel(1440)
  add(
    'kb-search-panel-no-nav',
    panelNarrow.open &&
      panelWide.open &&
      !panelNarrow.quickEntriesBlock &&
      !panelWide.quickEntriesBlock &&
      panelNarrow.links.length === 0 &&
      panelWide.links.length === 0 &&
      panelNarrow.focus.includes('search-toggle') &&
      panelWide.focus.includes('search-toggle'),
    JSON.stringify({ narrow: panelNarrow, wide: panelWide }),
  )

  /* ---------- 7c) Esc 在**任意焦点位置**都能关检索面板（回归护栏） ----------
     旧写法把 onKeydown 只挂在输入框上，于是 Tab 走到 ESC 钮或结果行之后 Esc 就失效了——
     而 aria-modal="true" 的对话框本该随时可关（发布前独立审查实测 3/4 个位置关不掉）。
     焦点位置覆盖：输入框 / ESC 钮 / 结果行 / 遮罩。 */
  const escPositions = []
  for (const sel of ['#quick-search-input', '.qs-esc', '.qs-row', '.qs-scrim']) {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('http://localhost:4175/', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)
    await page.keyboard.press('Control+k')
    await page.waitForTimeout(1600)
    const present = await page.evaluate((s) => !!document.querySelector(s), sel)
    if (present) await page.evaluate((s) => document.querySelector(s)?.focus(), sel)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
    escPositions.push({
      sel,
      present,
      closed: !(await page.evaluate(() => !!document.querySelector('.qs-panel'))),
      // 滚动锁必须一并复原，否则页面卡死不可滚
      unlocked: await page.evaluate(() => document.documentElement.style.overflow !== 'hidden'),
    })
  }
  add(
    'kb-search-esc-any-focus',
    escPositions.every((p) => p.present && p.closed && p.unlocked),
    JSON.stringify(escPositions),
  )

  /* ---------- 7d) 菜单开着时 Ctrl+K：菜单必须先收起（回归护栏） ----------
     面板铺满全屏且 aria-modal="true"；菜单若留着，会留在可访问树里（读屏可读到）、
     指针却点不到，且 Esc 会被站头的文档级监听抢走、把焦点拽出对话框。 */
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:4175/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  await page.click('.menu-toggle')
  await page.waitForTimeout(350)
  await page.keyboard.press('Control+k')
  await page.waitForTimeout(1700)
  const menuVsPanel = await page.evaluate(() => ({
    menuOpen: getComputedStyle(document.querySelector('#site-menu')).display !== 'none',
    expanded: document.querySelector('.menu-toggle').getAttribute('aria-expanded'),
    panelOpen: !!document.querySelector('.qs-panel'),
    active: document.activeElement ? String(document.activeElement.className).split(' ')[0] : 'none',
  }))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  const escAfter = await page.evaluate(() => ({
    panelOpen: !!document.querySelector('.qs-panel'),
    menuOpen: getComputedStyle(document.querySelector('#site-menu')).display !== 'none',
  }))
  add(
    'kb-ctrlk-closes-menu',
    menuVsPanel.panelOpen && !menuVsPanel.menuOpen && menuVsPanel.expanded === 'false' &&
      menuVsPanel.active.includes('qs-input') && !escAfter.panelOpen && !escAfter.menuOpen,
    JSON.stringify({ atOpen: menuVsPanel, afterEsc: escAfter }),
  )

  /* ---------- 7e) 纯空格查询：空态判据必须与模板一致（回归护栏） ----------
     模板用 `!query.trim()` 判空态，`movable` 若用 query 真值判断，输入纯空格时二者分歧：
     最近访问行照常渲染，脚注却退化成只剩「ESC 关闭」、方向键静默失效（鼠标点同一行还能跳）。 */
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('http://localhost:4175/agents')
  await page.evaluate(() =>
    localStorage.setItem(
      'zzz-wiki:recent-items',
      JSON.stringify([{ to: '/agents/1021', label: '猫又', catNo: '01' }]),
    ),
  )
  await page.goto('http://localhost:4175/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  await page.keyboard.press('Control+k')
  await page.waitForTimeout(1600)
  await page.keyboard.type(' ')
  await page.waitForTimeout(700)
  const spaceState = await page.evaluate(() => {
    const foot = document.querySelector('.qs-foot')
    return {
      rows: document.querySelectorAll('.qs-row').length,
      hasMoveHint: foot ? foot.textContent.includes('移动') : false,
    }
  })
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(400)
  const spaceActive = await page.evaluate(
    () => document.querySelector('.qs-row.on .qs-name')?.textContent?.trim() ?? null,
  )
  add(
    'kb-search-space-query-consistent',
    // 有最近访问行 → 就必须给移动提示、且方向键真的能激活
    spaceState.rows > 0 && spaceState.hasMoveHint && !!spaceActive,
    JSON.stringify({ ...spaceState, spaceActive }),
  )
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)

  /* ---------- 7f) 空态内容：无「最近访问」时给「检索范围」，有则不给（回归护栏） ----------
     面板空查询下不该出现「只有一行提示语」的空面板（新访客看到的第一次就是它）；
     但也**不能**在有最近访问时再塞几行——窄屏面板高度有上限，会把列表挤到折叠线以下。 */
  const scopeState = []
  for (const withRecent of [false, true]) {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('http://localhost:4175/')
    await page.evaluate((keep) => {
      if (keep) {
        localStorage.setItem(
          'zzz-wiki:recent-items',
          JSON.stringify([{ to: '/agents/1021', label: '猫又', catNo: '01' }]),
        )
      } else {
        localStorage.removeItem('zzz-wiki:recent-items')
      }
    }, withRecent)
    await page.goto('http://localhost:4175/', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)
    await page.keyboard.press('Control+k')
    await page.waitForTimeout(1600)
    scopeState.push(
      await page.evaluate((keep) => ({
        withRecent: keep,
        rows: document.querySelectorAll('.qs-row').length,
        scopeRows: document.querySelectorAll('.qs-scope-row').length,
        scopeText: document.querySelector('.qs-scope')?.textContent.replace(/\s+/g, '') ?? '',
        panelScrolls: (() => {
          const p = document.querySelector('.qs-panel')
          return p ? p.scrollHeight > p.clientHeight + 1 : false
        })(),
      }), withRecent),
    )
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
  }
  const [noRec, withRec] = scopeState
  add(
    'kb-empty-state-has-content',
    // 无最近访问 → 有说明区、且三行齐全；有最近访问 → 无说明区（列表优先）
    noRec.scopeRows === 3 && noRec.scopeText.includes('名称') && !noRec.panelScrolls &&
      withRec.scopeRows === 0 && withRec.rows > 0 && !withRec.panelScrolls,
    JSON.stringify(scopeState),
  )

  /* ---------- 8) 详情页页头：返回链接可达且可聚焦 ---------- */
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('http://localhost:4175/agents/1011', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  await page.evaluate(() => document.querySelector('.page-actions .back')?.focus())
  const backFocused = await page.evaluate(() => ({
    tag: document.activeElement?.tagName ?? '',
    cls: String(document.activeElement?.className || ''),
    text: document.activeElement?.textContent?.trim() ?? '',
  }))
  add('kb-detail-back-focus', backFocused.tag === 'A' && backFocused.cls.includes('back'), JSON.stringify(backFocused))

  const failed = checks.filter((c) => !c.ok)
  return JSON.stringify({ total: checks.length, failed: failed.length, failedItems: failed, checks }, null, 1)
}
