/* ============================================================
 * interaction-states.js — 交互态完整性审计（playwright-cli run-code）
 *
 * 「看起来可点」和「真的给了反馈」是两回事。本脚本对每个可交互元素用 CDP 强制
 * :hover / :active（CSS.forcePseudoState），比较元素**及其子树**的视觉指纹
 * （颜色/背景/边框/透明度/变换/阴影/下划线/滤镜）：
 *   - 无 hover 反馈 → 鼠标用户不知道这里可点
 *   - 无 active 反馈 → 按下时没有确认感
 *
 * 定位方式：给元素打临时属性 data-audit-idx → DOM.querySelector 拿 nodeId →
 * CSS.forcePseudoState（比 objectId 直传稳）。测完移除属性。
 *
 * 用法：playwright-cli open http://localhost:4175 && \
 *       playwright-cli run-code --filename=scripts/audits/interaction-states.js
 * 基线：所有可交互元素至少有 hover 或 active 之一的可见反馈
 * ============================================================ */

async (page) => {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('DOM.enable')
  await cdp.send('CSS.enable')

  const SELECTOR = 'a[href], button, [role="button"], summary, input[type="range"]'
  const routes = ['/', '/agents', '/agents/1011', '/atlas', '/formulas', '/about', '/compare']
  const report = []

  /** 指纹：自身 + 最多 12 个后代 + 滑条伪元素的视觉相关计算值。
   *  伪元素（::-webkit-slider-thumb）的样式不在元素自身的 computed style 里——
   *  首版据此把「滑条 hover 有反馈」误报成缺失（审计局限，非真实缺口）。 */
  const fpExpr = `(() => {
    const pick = (el) => {
      const cs = getComputedStyle(el)
      const parts = [cs.color, cs.backgroundColor, cs.borderTopColor, cs.borderBottomColor,
              cs.opacity, cs.transform, cs.boxShadow, cs.textDecorationLine, cs.filter].join(',')
      try {
        const thumb = getComputedStyle(el, '::-webkit-slider-thumb')
        return parts + '#' + [thumb.backgroundColor, thumb.borderTopColor, thumb.transform, thumb.boxShadow].join(',')
      } catch { return parts }
    }
    return (el) => {
      const out = [pick(el)]
      let n = 0
      for (const d of el.querySelectorAll('*')) { out.push(pick(d)); if (++n >= 12) break }
      return out.join('~')
    }
  })()`

  /** 仅聚焦时可见的跳转链接：hover 反馈对它没有意义（键盘专用入口） */
  const SKIP_HOVER = (sel) => sel.includes('skip-link')
  /** range 滑条：反馈写在 ::-webkit-slider-thumb 上，CDP 的 matchedStyles 与
   *  getComputedStyle(el,'::-webkit-slider-thumb') 都看不到（后者实测返回元素自身
   *  样式）。故单独用样式表文本判定，见下方 sliderThumbHover。 */
  const IS_RANGE = (sel) => sel.startsWith('input.level-range')

  /** 在页面里取第 idx 个可见可交互元素 */
  const pickExpr = (idx) => `(() => {
    const sel = ${JSON.stringify(SELECTOR)}
    return [...document.querySelectorAll(sel)].filter((x) => {
      const cs = getComputedStyle(x); const r = x.getBoundingClientRect()
      return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0 && !x.disabled
    })[${idx}] || null
  })()`

  for (const route of routes) {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('http://localhost:4175' + route, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1800)

    const count = await page.evaluate(
      (sel) =>
        [...document.querySelectorAll(sel)].filter((x) => {
          const cs = getComputedStyle(x)
          const r = x.getBoundingClientRect()
          return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0 && !x.disabled
        }).length,
      SELECTOR,
    )
    const limit = Math.min(count, 26)

    const noHover = []
    const noActive = []
    for (let i = 0; i < limit; i++) {
      const meta = await page.evaluate((expr) => {
        const el = eval(expr)
        if (!el) return null
        el.setAttribute('data-audit-idx', 'x')
        el.scrollIntoView({ block: 'center' })
        return {
          sel: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : ''),
          text: (el.textContent || '').trim().slice(0, 14),
        }
      }, pickExpr(i))
      if (!meta) continue
      await page.waitForTimeout(80)

      const base = await page.evaluate(`(${fpExpr})(${pickExpr(i)})`)
      const { root } = await cdp.send('DOM.getDocument', { depth: -1 })
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '[data-audit-idx="x"]' })
      if (!nodeId) {
        await page.evaluate(`(${pickExpr(i)})?.removeAttribute('data-audit-idx')`)
        continue
      }

      const changed = {}
      let declared = { hover: false, active: false }
      for (const pseudo of ['hover', 'active']) {
        await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [pseudo] })
        await page.waitForTimeout(60)
        const now = await page.evaluate(`(${fpExpr})(${pickExpr(i)})`)
        changed[pseudo] = now !== base
        await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] })
      }

      // 第二路信号：是否**声明**了匹配该元素的 :hover/:active 规则。
      // 需要它是因为伪元素（::-webkit-slider-thumb）的样式 Chrome 不通过
      // getComputedStyle 暴露——滑条 hover 有反馈却被指纹判成「无变化」。
      try {
        const matched = await cdp.send('CSS.getMatchedStylesForNode', { nodeId })
        const selectors = [
          ...(matched.matchedCSSRules ?? []).map((m) => m.rule.selectorList.text),
          ...(matched.pseudoElements ?? []).flatMap((p) => (p.matches ?? []).map((m) => m.rule.selectorList.text)),
        ].join(' ')
        declared = { hover: selectors.includes(':hover'), active: selectors.includes(':active') }
      } catch {
        /* 拿不到就只按指纹判定 */
      }

      if (!changed.hover && !declared.hover && !SKIP_HOVER(meta.sel) && !IS_RANGE(meta.sel)) noHover.push(meta)
      if (!changed.active && !declared.active && !IS_RANGE(meta.sel)) noActive.push(meta)
      await page.evaluate(`(${pickExpr(i)})?.removeAttribute('data-audit-idx')`)
    }

    report.push({
      route,
      checked: limit,
      noHoverCount: noHover.length,
      noActiveCount: noActive.length,
      noHover: noHover.slice(0, 8),
      noActive: noActive.slice(0, 8),
    })
  }

  const totalNoHover = report.reduce((n, r) => n + r.noHoverCount, 0)
  const totalNoActive = report.reduce((n, r) => n + r.noActiveCount, 0)
  const noEither = report.flatMap((r) =>
    r.noHover.filter((h) => r.noActive.some((a) => a.sel === h.sel)).map((x) => ({ route: r.route, ...x })),
  )

  // 滑条 thumb 的 hover 反馈：只能在样式表文本里确认（见 IS_RANGE 说明）
  await page.goto('http://localhost:4175/agents/1011', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  const sliderThumbHover = await page.evaluate(async () => {
    const href = [...document.querySelectorAll('link[rel="stylesheet"]')]
      .map((l) => l.getAttribute('href') || '')
      .find((h) => h.includes('/assets/'))
    if (!href) return false
    const text = await fetch(href).then((r) => r.text())
    // scoped 样式编译后属性插在 class 与 :hover 之间
    // （.level-range[data-v-x]:hover::-webkit-slider-thumb），故中间允许任意字符
    return /\.level-range[^{}]*:hover[^{}]*::-webkit-slider-thumb/.test(text)
  })

  return JSON.stringify(
    {
      routes: report.length,
      totalNoHover,
      totalNoActive,
      noFeedbackAtAll: noEither.length,
      sliderThumbHoverDeclared: sliderThumbHover,
      detail: report,
    },
    null,
    1,
  )
}
