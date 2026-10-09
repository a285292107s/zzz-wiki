/* ============================================================
 * quick-search.js — 快速检索（⌘K）行为验收
 *
 * 四个用例，各有明确断言：
 *   1) 中文子串查询 → 结果行**必须出现高亮**（mark.qs-hit，文本等于命中片段）
 *   2) 罗马字查询（anby）→ 经英文名命中，但**高亮只标在中文 label 上**，故无 mark
 *      ——这一条是「已知且正确」的行为，写下来免得下次误判为缺陷
 *   3) 空查询 → 列出快速入口；**不预激活任何行**（空态不设隐式目标，避免误触回车跳走），
 *      但方向键必须能激活、回车必须能直达（键盘路径完整）；最近访问先钉成确定的一条，
 *      不让浏览器历史决定落点
 *   4) 有查询时首行默认激活（.qs-row.on）→ 回车直达
 *
 * 用法：playwright-cli open http://localhost:4175 && \
 *       playwright-cli run-code --filename=scripts/audits/quick-search.js
 * 基线：4/4
 * ============================================================ */

async (page) => {
  const open = async (query) => {
    await page.goto('http://localhost:4175/agents/1011')
    await page.waitForTimeout(1200)
    await page.keyboard.press('Control+k')
    await page.waitForTimeout(700)
    if (query) await page.keyboard.type(query)
    await page.waitForTimeout(600)
  }
  const read = () =>
    page.evaluate(() => ({
      rows: [...document.querySelectorAll('.qs-row')].map((x) => ({
        name: x.querySelector('.qs-name')?.textContent.trim(),
        marks: [...x.querySelectorAll('mark.qs-hit')].map((m) => m.textContent),
      })),
      activeRow: document.querySelector('.qs-row.on')?.querySelector('.qs-name')?.textContent.trim() ?? '',
    }))

  const probe = async (query) => {
    await open(query)
    const r = await read()
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    return r
  }

  const zh = await probe('安')
  const en = await probe('anby')
  const empty = await probe('')

  // 空态：方向键激活 → 回车直达（键盘路径完整）
  // 「最近访问」由 localStorage 派生，不清空就会读到上一轮审计的残留条目；若其首条恰是
  // 本次所在页，方向键回车等于原地不动，断言将假红。故先种下一条别的详情页，
  // 让方向键的落点确定（页内会再把当前页记到最前，落点即这条种子）。
  await page.goto('http://localhost:4175/agents')
  await page.evaluate(() =>
    localStorage.setItem(
      'zzz-wiki:recent-items',
      JSON.stringify([{ to: '/agents/1021', label: '猫又', catNo: '01' }]),
    ),
  )
  await open('')
  const noPreActive = (await read()).activeRow === ''
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(400)
  const arrowActive = (await read()).activeRow
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1500)
  const afterEnter = await page.evaluate(() => ({
    path: location.pathname,
    panelOpen: !!document.querySelector('.qs-panel'),
  }))
  if (!afterEnter.panelOpen) await page.keyboard.press('Escape')

  const checks = [
    {
      name: 'zh-query-has-marks',
      ok:
        zh.rows.length > 0 &&
        zh.rows.every((r) => r.marks.length > 0) &&
        zh.rows.every((r) => r.marks.join('') === '安'),
      detail: JSON.stringify(zh.rows.slice(0, 3)),
    },
    {
      name: 'roman-query-no-marks-but-matches',
      ok: en.rows.length > 0 && en.rows.every((r) => r.marks.length === 0),
      detail: `${en.rows.map((r) => r.name).join('/')} marks=${en.rows.reduce((n, r) => n + r.marks.length, 0)}`,
    },
    {
      name: 'result-query-first-row-active',
      ok: zh.activeRow.length > 0,
      detail: zh.activeRow || 'none',
    },
    {
      name: 'empty-state-keyboard-path',
      ok: noPreActive && arrowActive.length > 0 && afterEnter.path !== '/agents/1011' && !afterEnter.panelOpen,
      detail: `预激活=${!noPreActive} 方向键激活=${arrowActive || 'none'} 回车后=${afterEnter.path} 面板关闭=${!afterEnter.panelOpen}`,
    },
  ]
  const failed = checks.filter((c) => !c.ok)
  return JSON.stringify({ total: checks.length, failed: failed.length, failedItems: failed, checks }, null, 1)
}
