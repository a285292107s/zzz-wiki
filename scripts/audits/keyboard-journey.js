/* ============================================================
 * keyboard-journey.js — 键盘完整旅程审计（playwright-cli run-code，WCAG 2.1.1）
 *
 * 此前只验证过「焦点可见」与「Tab 顺序」；本脚本验证**每个任务能否纯键盘走通**，
 * 且焦点不被系统抢走（SPA 里最常见的破绽：状态同步触发路由钩子把焦点抛到 main）。
 *
 * 覆盖：跳转链接 / 全局检索（开→输入→方向键→回车→Esc 归还焦点）/ 筛选下拉
 * （开→方向键→回车→**焦点归还触发钮**）/ 名录检索输入 / 详情翻页 / 等级滑条
 * （连按两步必须都生效）/ 复制链接 / 回到顶部 / 术语浮层 / 窄屏检索直达（站头导航的
 * 窄屏入口：⌕ 开面板→直达行与站头导航同数→Esc 关闭→焦点归还）。
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

  /* ---------- 7) 窄屏检索直达：⌕ 开面板 → 直达行与站头导航同数 → Esc 关闭 → 焦点归还 ---------- */
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:4175/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1600)
  // 站头导航在 ≤720 隐去，点开的检索面板就是窄屏的导航入口（⌕ 钮是唯一入口，故先聚焦再回车）
  await page.evaluate(() => document.querySelector('.search-toggle')?.focus())
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1500)
  const qsMobile = await page.evaluate(() => {
    const scrim = document.querySelector('.qs-scrim')
    return {
      open: !!scrim && getComputedStyle(scrim).display !== 'none',
      entries: document.querySelectorAll('.qs-quick-entries .qs-entry').length,
      navItems: document.querySelectorAll('.nav .nav-item').length,
    }
  })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)
  const afterQsEsc = await active()
  // 直达行必须与站头导航同一份清单（不是「至少 4 项」）：数值漂移即说明两处清单脱钩
  add(
    'kb-mobile-search-entries',
    qsMobile.open && qsMobile.entries > 0 && qsMobile.entries === qsMobile.navItems && afterQsEsc.includes('search-toggle'),
    JSON.stringify({ ...qsMobile, focus: afterQsEsc }),
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
