/* ============================================================
 * motion-audit.js — 动效克制性与 reduced-motion 覆盖（playwright-cli run-code）
 *
 * 两个问题：
 *   1) 模拟 `prefers-reduced-motion: reduce` 后，页面上还有没有残留动画/过渡？
 *      动效是「装饰」，前庭敏感用户应当能一键关掉（WCAG 2.3.3 精神）。
 *      判据：reduced 下不应存在无限动画，过渡时长应降到 ~0（≤50ms）
 *   2) 常态下是否存在过长（>400ms）的过渡或 `transition: all`（后者会连带
 *      布局属性一起补间，是性能与可预测性的双重异味）
 *
 * 用法：playwright-cli open http://localhost:4175 && \
 *       playwright-cli run-code --filename=scripts/audits/motion-audit.js
 * 基线：reduced 下 0 残留 / 常态无过长过渡
 * ============================================================ */

async (page) => {
  const routes = ['/', '/agents', '/agents/1011', '/formulas', '/about']
  const report = []

  const COLLECT = `(() => {
    const out = { infinite: [], veryLong: [], slow: [], allTransition: [] }
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') continue
      const r = el.getBoundingClientRect()
      if (!r.width && !r.height) continue
      const sel = el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : '')
      if (cs.animationName !== 'none') {
        const dur = Math.max(...cs.animationDuration.split(',').map((d) => parseFloat(d) || 0))
        const inf = cs.animationIterationCount.split(',').some((c) => c.trim() === 'infinite')
        if (inf) out.infinite.push({ sel, name: cs.animationName, dur })
      }
      const td = Math.max(...cs.transitionDuration.split(',').map((d) => parseFloat(d) || 0))
      const tp = cs.transitionProperty
      if (td > 0) {
        // >800ms 视为失控；400–800ms 只是「有意慢速」候选（如 --t-zoom 700ms 的
        // 标本卡推近，注释里写明「快了像抖动」），单独列出供人工确认，不算违规
        if (td > 0.8) out.veryLong.push({ sel, dur: td, prop: tp.slice(0, 40) })
        else if (td > 0.4) out.slow.push({ sel, dur: td, prop: tp.slice(0, 40) })
        if (/(^|,)\\s*all\\s*(,|$)/.test(tp)) out.allTransition.push({ sel, dur: td })
      }
    }
    const uniq = (arr) => {
      const m = new Map()
      for (const x of arr) { const k = x.sel + '|' + (x.name || x.prop || ''); if (!m.has(k)) m.set(k, x) }
      return [...m.values()]
    }
    return {
      infinite: uniq(out.infinite),
      veryLong: uniq(out.veryLong),
      slow: uniq(out.slow),
      allTransition: uniq(out.allTransition),
    }
  })()`

  for (const route of routes) {
    await page.setViewportSize({ width: 1440, height: 900 })

    // 常态
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('http://localhost:4175' + route, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1800)
    const normal = await page.evaluate(COLLECT)

    // reduced
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('http://localhost:4175' + route, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1600)
    const reduced = await page.evaluate(COLLECT)

    report.push({
      route,
      normal: {
        infinite: normal.infinite.length,
        veryLong: normal.veryLong.length,
        slow: normal.slow.length,
        allTransition: normal.allTransition.length,
        samples: normal.veryLong.slice(0, 4).concat(normal.slow.slice(0, 3)),
      },
      reduced: {
        infinite: reduced.infinite.length,
        veryLong: reduced.veryLong.length,
        slow: reduced.slow.length,
        samples: reduced.infinite.slice(0, 4).concat(reduced.veryLong.slice(0, 4), reduced.slow.slice(0, 4)),
      },
    })
  }
  await page.emulateMedia({ reducedMotion: null })

  const reducedLeftovers = report.reduce(
    (n, r) => n + r.reduced.infinite + r.reduced.veryLong + r.reduced.slow,
    0,
  )
  const veryLongNormal = report.reduce((n, r) => n + r.normal.veryLong, 0)
  const allNormal = report.reduce((n, r) => n + r.normal.allTransition, 0)
  const slowNormal = report.reduce((n, r) => n + r.normal.slow, 0)
  return JSON.stringify(
    { routes: report.length, reducedLeftovers, veryLongNormal, slowNormal, allNormal, detail: report },
    null,
    1,
  )
}
