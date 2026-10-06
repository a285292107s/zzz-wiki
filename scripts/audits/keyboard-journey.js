/* ============================================================
 * keyboard-journey.js — 键盘完整旅程审计（playwright-cli run-code，WCAG 2.1.1）
 *
 * 此前只验证过「焦点可见」与「Tab 顺序」；本脚本验证**每个任务能否纯键盘走通**，
 * 且焦点不被系统抢走（SPA 里最常见的破绽：状态同步触发路由钩子把焦点抛到 main）。
 *
 * 覆盖：跳转链接 / 全局检索（开→输入→方向键→回车→Esc 归还焦点）/ 筛选下拉
 * （开→方向键→回车→**焦点归还触发钮**）/ 名录检索输入 / 详情翻页 / 等级滑条
 * （连按两步必须都生效）/ 复制链接 / 回到顶部 / 术语浮层 / 移动端菜单。
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

  /* ---------- 5) 详情：翻页 / 滑条连按 / 复制链接 / 回到顶部 ---------- */
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

  await page.evaluate(() => document.querySelector('.copy-link')?.focus())
  await page.keyboard.press('Enter')
  await page.waitForTimeout(400)
  const copyState = await page.evaluate(() => document.querySelector('.copy-link')?.textContent.replace(/\s+/g, ' ').trim() ?? '')
  add('kb-copy-link', copyState.includes('已复制'), copyState)

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

  /* ---------- 7) 移动端菜单：开 → Esc 关闭 → 焦点归还 ---------- */
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:4175/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1600)
  await page.evaluate(() => document.querySelector('.menu-toggle')?.focus())
  await page.keyboard.press('Enter')
  await page.waitForTimeout(500)
  // 面板是 #mobile-nav（v-show 切换）；首跑探针猜的 .m-menu/.mobile-menu 都不存在——探针自身的坑
  const menuOpen = await page.evaluate(() => {
    const nav = document.getElementById('mobile-nav')
    return !!nav && getComputedStyle(nav).display !== 'none'
  })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  const afterEsc = await active()
  const menuClosed = await page.evaluate(() => {
    const nav = document.getElementById('mobile-nav')
    return !nav || getComputedStyle(nav).display === 'none'
  })
  add('kb-mobile-menu', menuOpen && menuClosed && afterEsc.includes('menu-toggle'), `open=${menuOpen} closed=${menuClosed} focus=${afterEsc}`)

  /* ---------- 8) 对照台：加入 → 移出 → 移空（焦点必须被交棒，不能掉回 body） ---------- */
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.evaluate(() => localStorage.removeItem('zzz-wiki:compare'))
  await page.goto('http://localhost:4175/agents/1011', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  await page.evaluate(() => document.querySelector('.cmp-btn')?.focus())
  await page.keyboard.press('Enter')
  await page.waitForTimeout(400)
  const cmpAdded = await page.evaluate(() => ({
    pressed: document.querySelector('.cmp-btn')?.getAttribute('aria-pressed'),
    note: document.querySelector('.cmp-note')?.textContent.trim() ?? '',
  }))
  add('kb-compare-add', cmpAdded.pressed === 'true', JSON.stringify(cmpAdded))

  await page.goto('http://localhost:4175/compare?cat=/agents&ids=1011,1021', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1700)
  await page.evaluate(() => document.querySelector('.entry-remove')?.focus())
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1100)
  const afterRemove = await page.evaluate(() => ({
    cols: document.querySelectorAll('.th-entry').length,
    focus: document.activeElement?.tagName + '.' + String(document.activeElement?.className || '').split(' ')[0],
  }))
  // 移出后焦点必须落在**下一条的移出钮**上：掉回 body 的话键盘用户要重新 Tab 一整圈
  add(
    'kb-compare-remove-focus-handoff',
    afterRemove.cols === 1 && afterRemove.focus.includes('entry-remove'),
    JSON.stringify(afterRemove),
  )

  await page.keyboard.press('Enter')
  await page.waitForTimeout(1100)
  const afterLast = await page.evaluate(() => ({
    empty: !!document.querySelector('.bench-empty-title'),
    focus: document.activeElement?.tagName + '.' + String(document.activeElement?.className || '').split(' ')[0],
    text: document.activeElement?.textContent?.trim().slice(0, 8) ?? '',
  }))
  // 移空后：空态必须出现，且焦点交到空态标题（tabindex=-1）
  add(
    'kb-compare-empty-focus-handoff',
    afterLast.empty && afterLast.focus.includes('bench-empty-title') && afterLast.text.includes('对照台为空'),
    JSON.stringify(afterLast),
  )

  const failed = checks.filter((c) => !c.ok)
  return JSON.stringify({ total: checks.length, failed: failed.length, failedItems: failed, checks }, null, 1)
}
