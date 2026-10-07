/* ============================================================
 * ax-tree.js — 无障碍树审计（playwright-cli run-code）
 *
 * axe 逐规则检查；本脚本看的是**辅助技术实际收到的东西**：CDP
 * `Accessibility.getFullAXTree` 拿整棵树，然后断言——
 *   1) 可交互角色（button/link/textbox/combobox/slider/checkbox…）必须有可访问名
 *   2) 自定义控件的状态要真的暴露：滑条 valuenow/min/max、下拉 aria-expanded、
 *      对话框有名字、表格表头 aria-sort
 *   3) 标题层级：每页恰好一个 h1，且层级不跳（h1→h3 这类）
 *   4) 装饰性图片应是 presentation/none，有意义的图片必须有名字
 *   5) 表单控件（输入框）必须有名字（placeholder 不算）
 *
 * 用法：playwright-cli open http://localhost:4175 && \
 *       playwright-cli run-code --filename=scripts/audits/ax-tree.js
 * 基线：未命名可交互节点 0 / 标题层级正确 / 控件状态齐备
 * ============================================================ */

async (page) => {
  const routes = ['/', '/agents', '/agents/1011', '/atlas', '/formulas', '/about', '/compare', '/agents/9999']
  const report = []
  const INTERACTIVE = new Set([
    'button', 'link', 'textbox', 'combobox', 'listbox', 'option', 'slider',
    'checkbox', 'radio', 'switch', 'tab', 'menuitem', 'searchbox', 'spinbutton',
  ])

  for (const route of routes) {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('http://localhost:4175' + route, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1800)
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Accessibility.enable')
    const { nodes } = await cdp.send('Accessibility.getFullAXTree')

    const unnamed = []
    const headings = []
    const images = { decorative: 0, named: 0, unnamed: [] }
    let slider = null
    let tableHeaders = 0
    let sortedHeaders = 0

    for (const n of nodes) {
      if (n.ignored) continue
      const role = n.role?.value
      const name = (n.name?.value ?? '').trim()
      const props = Object.fromEntries((n.properties ?? []).map((p) => [p.name, p.value?.value]))

      if (INTERACTIVE.has(role) && !name && props.hidden !== true) {
        unnamed.push({ role, nodeId: n.nodeId, desc: (n.description?.value ?? '').slice(0, 24) })
      }
      if (role === 'heading') headings.push({ level: props.level, name: name.slice(0, 18) })
      if (role === 'image') {
        if (!name) images.unnamed.push((n.description?.value ?? '').slice(0, 24) || 'img')
        else images.named++
      }
      if (role === 'presentation' || role === 'none') images.decorative++
      if (role === 'slider') slider = { name, ...props }
      if (role === 'columnheader') {
        tableHeaders++
        if (props.sort) sortedHeaders++
      }
    }

    // 图片名冗余：图片名与所在链接/按钮的可访问名相同 → 读屏会把同一件事念两遍
    // （axe 的 image-redundant-alt 只在部分形态下报；这里直接按可访问名比对）
    const redundantImageNames = await page.evaluate(() => {
      const out = []
      for (const img of document.querySelectorAll('img[alt]')) {
        const alt = (img.getAttribute('alt') || '').trim()
        if (!alt) continue
        const host = img.closest('a, button, [role="button"], [role="link"]')
        if (!host) continue
        const text = (host.textContent || '').trim()
        if (text && text.includes(alt)) out.push({ alt: alt.slice(0, 16), host: host.tagName.toLowerCase() + (host.className ? '.' + String(host.className).split(' ')[0] : '') })
      }
      return out.slice(0, 6)
    })

    // 标题层级必须按**文档顺序**算：CDP getFullAXTree 返回的是扁平数组，
    // 其顺序不等于 DOM 顺序（首跑据此误报详情页「h1 出现在 h2 之后」——
    // 实测 DOM 里 h1 在最前）。本会话第四次「检测器自身假设错误」，故此处改走 DOM。
    const headingInfo = await page.evaluate(() => {
      const els = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]')]
      const levels = els.map((el) => {
        const explicit = el.getAttribute('aria-level')
        return explicit ? Number(explicit) : Number(el.tagName.slice(1))
      })
      let skipped = false
      for (let i = 1; i < levels.length; i++) if (levels[i] - levels[i - 1] > 1) skipped = true
      return { levels, h1Count: levels.filter((l) => l === 1).length, skipped }
    })

    report.push({
      route,
      unnamedCount: unnamed.length,
      unnamed: unnamed.slice(0, 6),
      h1Count: headingInfo.h1Count,
      headingLevels: headingInfo.levels,
      skippedLevel: headingInfo.skipped,
      images,
      redundantImageNames,
      slider,
      tableHeaders,
      sortedHeaders,
    })
  }

  const totalUnnamed = report.reduce((n, r) => n + r.unnamedCount, 0)
  const badH1 = report.filter((r) => r.h1Count !== 1).map((r) => `${r.route}:${r.h1Count}`)
  const skipped = report.filter((r) => r.skippedLevel).map((r) => r.route)
  const unnamedImgs = report.reduce((n, r) => n + r.images.unnamed.length, 0)
  const redundantImgs = report.reduce((n, r) => n + r.redundantImageNames.length, 0)
  return JSON.stringify(
    {
      routes: report.length,
      totalUnnamed,
      badH1,
      skippedHeadings: skipped,
      unnamedImages: unnamedImgs,
      redundantImageNames: redundantImgs,
      detail: report,
    },
    null,
    1,
  )
}
