/* ============================================================
 * axe-a11y.js — axe-core 全量无障碍规则审计（playwright-cli run-code）
 *
 * 用行业标准 axe-core（4.x）跑**全部**规则（Lighthouse 只用其子集 + 我们的人工
 * ARIA/landmark/keyboard 审计），覆盖对比度、重复 id、非法 ARIA 组合、
 * 表单标签、landmark 结构等自动可判类目。
 *
 * 输出：按路由聚合的 violations（规则 id / impact / 命中数 / 首个目标选择器），
 * 仅列 serious+critical 之外的也一并给出（含 moderate/minor 以便判断）。
 *
 * 覆盖面（2026-10 扩到 12 路由 × 2 视口 = 24 组合）：四个名录页 + 各类目一个详情
 * + 首页 + 图表页 + 出处页 + 404。**扩大覆盖本身就会抓到问题**——/disks 页此前
 * 不在清单里，首次纳入即暴露两处（套装标签 4.40:1 差一点、磁盘图标 alt 冗余）。
 *
 * 用法：
 *   playwright-cli open http://localhost:4175 && \
 *   playwright-cli run-code --filename=scripts/audits/axe-a11y.js
 * 依赖：axe-core（devDependency，经 addScriptTag 注入本地文件，无需外网）
 * 基线：全路由 0 violations（0 serious/critical）
 * ============================================================ */

async (page) => {
  // 四个名录页 + 各类目一个详情 + 图表页 + 出处页 + 404（覆盖全部页面类型）
  const routes = [
    '/',
    '/agents',
    '/agents/1011',
    '/w-engines',
    '/w-engines/14162',
    '/bangboos',
    '/bangboos/54023',
    '/disks',
    '/disks/34200',
    '/atlas',
    '/formulas',
    '/agents/9999', // 详情 404 态（无效编号）：h1/标题/返回出路
  '/about',
    '/none',
  ]
  const viewports = [
    [1920, 1080],
    [390, 844],
  ]
  const report = []

  for (const [w, h] of viewports) {
    await page.setViewportSize({ width: w, height: h })
    for (const route of routes) {
      await page.goto('http://localhost:4175' + route, { waitUntil: 'networkidle' })
      await page.waitForTimeout(1400)
      await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' })
      const res = await page.evaluate(async () => {
        const r = await window.axe.run(document, {
          resultTypes: ['violations'],
          rules: { region: { enabled: true } },
        })
        return r.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.length,
          target: v.nodes[0]?.target?.join(' ').slice(0, 60),
          help: v.help.slice(0, 60),
        }))
      })
      if (res.length) report.push({ vp: `${w}x${h}`, route, violations: res })
    }
  }
  await page.setViewportSize({ width: 1920, height: 1080 })
  const serious = report.reduce(
    (n, r) => n + r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').length,
    0,
  )
  return JSON.stringify({ routesChecked: routes.length * viewports.length, groups: report.length, serious, report }, null, 1)
}
