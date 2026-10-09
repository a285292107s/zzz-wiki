/* ============================================================
 * focus-visible.js — 焦点可见性系统审计（playwright-cli run-code）
 *
 * WCAG 2.4.7：键盘焦点必须有可见指示。站内用全局
 * `:focus-visible { outline: 1px solid var(--focus) }` 兜底，另有组件自绘
 * （如搜索框用 :focus-within 改边框色）——但组件也可能 `outline: none`
 * 覆盖掉兜底，故逐 Tab 位实测：
 *   1) 模拟真实键盘遍历（page.keyboard.press('Tab')），记录每个停靠点
 *   2) 判定该元素是否有可见指示：自身 outline / box-shadow，或**祖先**的
 *      边框色变化（组件自绘常见形态，需与未聚焦基线比较）
 *   3) 输出无指示的停靠点（含选择器），供人工确认是否真的缺失
 *
 * 用法：playwright-cli open http://localhost:4175 && \
 *       playwright-cli run-code --filename=scripts/audits/focus-visible.js
 * 基线：所有停靠点均有可见指示（0 处缺失）
 * ============================================================ */

async (page) => {
  const routes = ['/', '/agents', '/agents/1011', '/atlas', '/formulas', '/about']
  const report = []

  for (const route of routes) {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('http://localhost:4175' + route, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1800)
    // 从正文开始遍历（跳过跳转链接之外的页面级元素也可，这里完整走一遍）
    await page.evaluate(() => document.body.focus?.())

    const missing = []
    const seen = []
    // 静止态边框令牌值（用于判定祖先自绘：边框色偏离静止令牌即视为聚焦指示）
    const resting = await page.evaluate(() => {
      const probe = document.createElement('span')
      probe.style.cssText = 'position:absolute;visibility:hidden;border:1px solid var(--line-1)'
      document.body.appendChild(probe)
      const line1 = getComputedStyle(probe).borderTopColor
      probe.style.borderColor = 'var(--line-0)'
      const line0 = getComputedStyle(probe).borderTopColor
      probe.style.borderColor = 'var(--focus)'
      const focus = getComputedStyle(probe).borderTopColor
      probe.remove()
      return { line0, line1, focus }
    })

    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab')
      await page.waitForTimeout(60)
      const stop = await page.evaluate((rest) => {
        const el = document.activeElement
        if (!el || el === document.body) return { end: true }
        const cls = (x) => (x ? `${x.tagName.toLowerCase()}${x.className ? '.' + String(x.className).split(' ')[0] : ''}` : '')
        const st = getComputedStyle(el)
        const selfOutline = st.outlineStyle !== 'none' && parseFloat(st.outlineWidth) > 0
        const selfShadow = st.boxShadow !== 'none'
        // 祖先自绘：焦点态常改父容器边框色（如搜索框 wrapper 转琥珀）
        let ancestorIndicator = false
        let ancestor = ''
        let node = el.parentElement
        for (let d = 0; d < 3 && node; d++, node = node.parentElement) {
          const ps = getComputedStyle(node)
          if (ps.borderTopStyle === 'none' || ps.borderTopWidth === '0px') continue
          const c = ps.borderTopColor
          if (c === rest.line0 || c === rest.line1) continue // 仍是静止色 → 无指示
          ancestorIndicator = true
          ancestor = `${cls(node)} border ${c}`
          break
        }
        return {
          el: cls(el),
          id: el.id || '',
          outline: `${st.outlineStyle} ${st.outlineWidth} ${st.outlineColor}`,
          selfOutline,
          shadow: selfShadow,
          ancestor,
          hasIndicator: selfOutline || selfShadow || ancestorIndicator,
        }
      }, resting)
      if (stop.end) break
      seen.push(stop.el)
      if (!stop.hasIndicator) missing.push(stop)
    }
    report.push({ route, stops: seen.length, missingCount: missing.length, missing: missing.slice(0, 6) })
  }

  const totalMissing = report.reduce((n, r) => n + r.missingCount, 0)
  return JSON.stringify({ routes: report.length, totalMissing, report }, null, 1)
}
