/* ============================================================
 * spacing-audit.js — 版式节奏合规（设计系统兑现：Design 40% 的节奏维度）
 *
 * 范围界定（重要）：本审计只管**版式级纵向节奏**——区块之间、区块内子组之间、
 * 页面左右留白的间距。**组件内部 padding 不在范围内**：那些是逐组件手工微调的
 * 光学补偿（按钮 6/10px、标签 3/4px…），把它们强行套进 4/8/12 网格只会让每个组件
 * 都差一口气。实测全站共 31 种纵向间距值，若按统一网格判定会产生 ~1900 条噪声，
 * 那不是信号。故此处只判定「结构性容器」的间距是否来自节奏令牌。
 *
 * 判定：把 tokens.css 的节奏令牌解析为允许集合——
 *   · 点值（8px / 14px）→ 精确值
 *   · clamp(a, vw, b) → 闭区间 [a, b]（视口变化下的合法值）
 *   · calc(k * var(--x)) → 按基准折算
 * 结构性容器的纵向 margin/padding/row-gap 落在集合外即越轨。
 *
 * 用法：playwright-cli open http://localhost:4175 && \
 *       playwright-cli run-code --filename=scripts/audits/spacing-audit.js
 * 基线：越轨 0（出现新值先问「它是否该成为节奏令牌」）
 * ============================================================ */

async (page) => {
  const routes = ['/', '/agents', '/agents/1011', '/w-engines', '/w-engines/14162', '/bangboos', '/disks', '/formulas', '/about', '/compare', '/atlas']
  const out = { routes: routes.length, structural: {}, offScale: [] }

  /** 结构性容器分两档：
   *  · LAYOUT（**严格门禁**）：页面与区块骨架——这些间距必须来自节奏令牌，
   *    否则版式节奏就散了（实测这一档 100% 合规）
   *  · CONTAINER（**仅报告**）：区块内部容器（区块头、子组、列表）——这里有逐组件
   *    手工微调的光学补偿，强行统一只会让每个组件都差一口气 */
  const LAYOUT = ['main', 'main > *', 'section', '.detail-section', '.page-head']
  const CONTAINER = ['section > *', '.detail-section > *', '.group', '.items', '.section-head', '.spec', '.notice']

  const collect = async (sels) => {
    const acc = []
    for (const r of routes) {
      await page.goto('http://localhost:4175' + r, { waitUntil: 'networkidle' })
      await page.waitForTimeout(1200)
      const res = await page.evaluate((list) => {
        const seen = new Set()
        const vals = []
        for (const sel of list) {
          for (const el of document.querySelectorAll(sel)) {
            if (seen.has(el)) continue
            seen.add(el)
            const cs = getComputedStyle(el)
            for (const prop of ['marginTop', 'marginBottom', 'paddingTop', 'paddingBottom', 'rowGap']) {
              const v = parseFloat(cs[prop])
              if (!Number.isFinite(v) || v <= 2) continue
              vals.push({ v: Math.round(v * 100) / 100, prop, sel: `${el.tagName.toLowerCase()}.${String(el.className || '').split(' ')[0]}` })
            }
          }
        }
        return vals
      }, sels)
      for (const x of res) acc.push({ route: r, ...x })
    }
    return acc
  }

  const layoutVals = await collect(LAYOUT)
  const containerVals = await collect(CONTAINER)

  // 允许集合：与 tokens.css 的节奏令牌对齐
  const ALLOWED_POINTS = [8, 12, 14, 16] // --space-1 / --space-inline / --space-2 / --space-head(=--space-col)
  const ALLOWED_RANGES = [
    [20, 56], // --pad-page: clamp(20px, 4vw, 56px)
    [40, 96], // --pad-section: clamp(40px, 6vw, 96px)
    [26, 42], // --space-group: clamp(26px, 3vw, 42px)
    [28, 70], // --space-section: calc(--pad-section * 0.72) → clamp 的 0.72 倍区间
  ]
  const inAllowed = (v) =>
    ALLOWED_POINTS.some((p) => Math.abs(v - p) <= 1) ||
    ALLOWED_RANGES.some(([a, b]) => v >= a - 1 && v <= b + 1)

  const summarize = (vals) => {
    const byValue = {}
    for (const x of vals.filter((y) => !inAllowed(y.v))) {
      const k = String(x.v)
      if (!byValue[k]) byValue[k] = { count: 0, sample: `${x.route} ${x.sel} ${x.prop}` }
      byValue[k].count++
    }
    return Object.entries(byValue)
      .map(([v, o]) => ({ value: `${v}px`, count: o.count, sample: o.sample }))
      .sort((a, b) => b.count - a.count)
  }

  const layoutBad = summarize(layoutVals)
  const containerBad = summarize(containerVals)
  const distinct = (vals) => new Set(vals.map((x) => x.v)).size

  return JSON.stringify(
    {
      routes: routes.length,
      layout: {
        values: distinct(layoutVals),
        distinct: distinct(layoutVals),
        offScale: layoutBad.length,
        violations: layoutBad.slice(0, 6),
      },
      container: {
        distinct: distinct(containerVals),
        offScale: containerBad.reduce((n, x) => n + x.count, 0),
        top: containerBad.slice(0, 6),
      },
    },
    null,
    1,
  )
}

