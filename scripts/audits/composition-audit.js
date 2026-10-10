/* ============================================================
 * composition-audit.js — 构图断点审计（两栏/窄栏各自的表现）
 *
 * 为什么单列一项：现有的排版/节奏/溢出审计都是**逐元素属性**检查（字号是否在尺度内、
 * 间距是否来自令牌、有没有横向溢出），看不出一类只有「元素之间关系」才暴露的缺陷：
 *   · 一行的内容只用掉三分之一栏宽，箭头被孤悬在 315px 之外（首页目录）
 *   · 390px 下外壳三列各只有 83px，每条都被挤成两行（页脚出处行）
 *   · 标本签四项挤在 nowrap 的一行里，24px 的中文名只分到 159px、断成两行
 *   · CJK 长句折行后末行只剩一个字（每个字都是断点，浏览器不会自动避免）
 * 这四类都是「单看任一元素都合规」的缺陷，故必须按**关系**测，且两个断点各测一遍
 * （同一份内容在 390 与 1440 下的表现完全不同——这正是本审计存在的理由）。
 *
 * 四类判据（均为 0 才算通过）：
 *   1. stranded  行内空洞：flex/grid 行里相邻两项之间空出 ≥240px，且该行**不是**
 *                space-between 布局（那是刻意的两端对齐，不是空洞）
 *   2. cramped   窄列挤压：nowrap 的 **flex** 行已被塞满（子项宽之和 ≥95% 行宽），
 *                且其中有 **两个以上** 子项在内部折成 ≥2 行 —— 一行内容被挤到没有余量。
 *                （单个文本块占满剩余宽度后折行是正常排版，不算；grid 行不计，
 *                  因为跨轨子项的宽度会重叠，「填满度」无从计算）
 *   3. orphan    末行孤字：折成 2–6 行的文本块，末行宽度 ≤2 个字。
 *                >6 行的只**报告不判失败**：`text-wrap: balance` 在 Chrome 有 6 行上限
 *                （见 base.css「正文断行均衡」），超限时退回普通断行，属已知技术上限。
 *   4. stacked   叠线：两条水平发丝线 y 相差 ≤3px 且横向重叠 —— 同一条边界被画了两次，
 *                叠成 2px（而板的顶缘只有 1px，上下缘就差一倍重量）。横向不重叠的不算：
 *                两栏账册里左右两格同 y 的线其实接成了一条连续的线。
 *                ⚠ 只认**元素**上的线（上下边框 + 背景充当的细线）；伪元素（如吸顶横条
 *                当前项那条刻意的下刻线）不在扫描范围 —— 那条本来就该压在横条下缘线上。
 *                同一判据还带一条**结构性**检查：区块标题行的延伸线（.rule）若失去右端英文
 *                标签（.en），它就和本元素的 border-top 成为两条几乎等长的平行线 ——
 *                那是两条线做同一件事（首页原本如此）。泛化到全站会命中引导点线/夹持线/
 *                控件自身边框，噪声不可判读，故只认 section-head 这一族语法。
 *
 * 两个实现选择（都为了确定性）：
 *   · 自持一个 `serviceWorkers: 'block'` 的新上下文 —— 审计箱跑在同一个浏览器会话上，
 *     前面的 offline-check 会注册 SW，命中缓存时读到的是上一版 CSS（实测踩过）。
 *   · 不滚动页面、直接把 `.reveal` 标为已显现 —— v-reveal 只改 opacity/transform，
 *     不影响任何被测几何（宽度/间隙/折行）；滚动触发反而会引入时序竞态。
 *     全站最长的名录页滚动一遍要数秒，本审计的 10 路由 × 3 视口因此能压到半分钟内。
 *
 * 判据声明见 scripts/audit-all.mjs 的 RULES。
 * ============================================================ */

async (page) => {
  const ROUTES = [
    '/',
    '/agents',
    '/agents/1011',
    '/w-engines',
    '/w-engines/14162',
    '/bangboos',
    '/disks',
    '/formulas',
    '/atlas',
    '/about',
  ]
  // 每个视口只跑它真能暴露问题的判据：空洞在宽视口才成立，挤压只在窄视口成立。
  // 1024 与 320 是两道**边界**而非凑数：1024 落在「单栏桌面行」这段窄带里（1180 起才转
  // 两栏账册），那正是空洞最容易悄悄回来而无人测的地方；320 是 WCAG 重排下限，挤压最紧。
  const VIEWPORTS = [
    { name: 'mobile-320', w: 320, h: 740, rules: ['cramped', 'orphan', 'stacked'] },
    { name: 'mobile-390', w: 390, h: 844, rules: ['cramped', 'orphan', 'stacked'] },
    { name: 'desktop-1024', w: 1024, h: 768, rules: ['stranded', 'orphan', 'stacked'] },
    { name: 'desktop-1440', w: 1440, h: 900, rules: ['stranded', 'orphan', 'stacked'] },
    { name: 'wide-1920', w: 1920, h: 1080, rules: ['stranded', 'stacked'] },
  ]
  const STRANDED_PX = 240
  const CRAMPED_FILL = 0.95
  // 末行 ≤2 个字即判孤字（1.2 个字太松：两字尾巴在 500px 行宽下同样扎眼）
  const ORPHAN_EM = 2
  const BALANCE_LINE_CAP = 6
  // 两条水平发丝线 y 相差 ≤3px 且横向有重叠 → 同一条边界画了两条（叠成 2px）
  const STACK_PX = 3

  const probe = (opts) => {
    const { rules, strandedPx, crampedFill, orphanEm, balanceCap, stackPx } = opts
    const out = { stranded: [], cramped: [], orphan: [], orphanOverCap: [], stacked: [] }
    const visible = (el) => {
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') return false
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    }
    const label = (el) => {
      const cls = String(el.className || '').split(' ').filter(Boolean).slice(0, 2).join('.')
      return el.tagName.toLowerCase() + (cls ? '.' + cls : '')
    }
    const brief = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40)
    /** 行盒（Range 逐行聚合）：数行数与每行宽 */
    const lineBoxes = (el) => {
      const range = document.createRange()
      range.selectNodeContents(el)
      const rects = [...range.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5)
      const lines = []
      for (const r of rects) {
        const hit = lines.find((l) => Math.abs(l.top - r.top) < 4)
        if (hit) {
          hit.left = Math.min(hit.left, r.left)
          hit.right = Math.max(hit.right, r.right)
        } else lines.push({ top: r.top, left: r.left, right: r.right })
      }
      return lines.map((l) => l.right - l.left)
    }
    /** 文本块：自身没有块级子元素（行内子元素如富文本图标不算） */
    const isTextBlock = (el) => {
      const t = (el.textContent || '').trim()
      if (t.length < 8) return false
      if (el.classList.contains('sr-only')) return false
      return [...el.children].every((c) => getComputedStyle(c).display.startsWith('inline'))
    }
    const rowStyle = (el) => getComputedStyle(el)
    const isRow = (el) => {
      const d = rowStyle(el).display
      return d === 'flex' || d === 'grid' || d === 'inline-flex'
    }
    const spaceBetween = (el) => {
      const jc = getComputedStyle(el).justifyContent
      return jc === 'space-between' || jc === 'space-around' || jc === 'space-evenly'
    }

    // ---------- 1. 行内空洞 ----------
    if (rules.includes('stranded')) {
      const seen = new Set()
      for (const row of document.querySelectorAll('*')) {
        // 先按子元素个数粗筛（每行 2–8 项），避免对整棵树做布局测量
        if (row.childElementCount < 2 || row.childElementCount > 8) continue
        if (seen.has(row) || !visible(row) || !isRow(row) || spaceBetween(row)) continue
        const kids = [...row.children].filter(
          (k) => visible(k) && getComputedStyle(k).position === 'static',
        )
        if (kids.length < 2 || kids.length > 8) continue
        const rowR = row.getBoundingClientRect()
        if (rowR.width < 420) continue
        seen.add(row)
        for (let i = 0; i < kids.length - 1; i++) {
          const a = kids[i].getBoundingClientRect()
          const b = kids[i + 1].getBoundingClientRect()
          const gap = b.left - a.right
          if (gap >= strandedPx) {
            out.stranded.push({
              row: label(row),
              rowWidth: Math.round(rowR.width),
              between: `${label(kids[i])} → ${label(kids[i + 1])}`,
              gapPx: Math.round(gap),
              trailingText: brief(kids[i]),
            })
            break
          }
        }
      }
    }

    // ---------- 2. 窄列挤压 ----------
    if (rules.includes('cramped')) {
      for (const row of document.querySelectorAll('*')) {
        if (row.childElementCount < 2 || row.childElementCount > 12) continue
        if (!visible(row) || !isRow(row)) continue
        const cs = rowStyle(row)
        // 只测 flex 行：grid 子项可以跨轨（宽度相加重叠），「填满度」失去意义
        if (cs.display !== 'flex' && cs.display !== 'inline-flex') continue
        if (cs.flexDirection !== 'row' || cs.flexWrap !== 'nowrap') continue
        const kids = [...row.children].filter((k) => visible(k))
        if (kids.length < 2) continue
        const rowW = row.getBoundingClientRect().width
        if (rowW < 280) continue
        const gap = parseFloat(cs.columnGap) || 0
        const sum =
          kids.reduce((s, k) => s + k.getBoundingClientRect().width, 0) + gap * (kids.length - 1)
        if (sum < rowW * crampedFill) continue
        const wrapped = kids.filter((k) => isTextBlock(k) && lineBoxes(k).length >= 2)
        // 单个文本块占满剩余宽度后折行是正常排版（如「序号 + 说明」）；**两个以上**子项
        // 在同一 nowrap 行里同时被折行，才是这一行被挤到没有余量（页脚三列、标本签四件）
        if (wrapped.length < 2) continue
        for (const k of wrapped) {
          const r = k.getBoundingClientRect()
          out.cramped.push({
            row: label(row),
            rowWidth: Math.round(rowW),
            rowFillPct: Math.round((sum / rowW) * 100),
            el: label(k),
            text: brief(k),
            boxWidthPx: Math.round(r.width),
            fontSizePx: Math.round(parseFloat(getComputedStyle(k).fontSize)),
            lines: lineBoxes(k).length,
          })
        }
      }
    }

    // ---------- 3. 末行孤字 ----------
    if (rules.includes('orphan')) {
      for (const el of document.querySelectorAll('p, li, dd, dt, blockquote, figcaption, span, strong, em, td')) {
        if (!visible(el) || !isTextBlock(el)) continue
        // 只测**块级**文本：行内元素（<strong>/<em>）的折行由所在段落决定，
        // 单独量它会把「段落末尾恰好跨行的两字」误判成该元素自己的孤字
        if (getComputedStyle(el).display === 'inline') continue
        const fs = parseFloat(getComputedStyle(el).fontSize)
        if (!(fs > 0)) continue
        const w = lineBoxes(el)
        if (w.length < 2) continue
        const widest = Math.max(...w)
        const last = w[w.length - 1]
        if (last > orphanEm * fs) continue
        const rec = {
          el: label(el),
          text: brief(el),
          lines: w.length,
          lastLinePx: Math.round(last),
          widestLinePx: Math.round(widest),
          fontSizePx: Math.round(fs),
        }
        if (w.length > balanceCap) out.orphanOverCap.push(rec)
        else out.orphan.push(rec)
      }
    }

    // ---------- 4. 叠线：同一条边界画了两条水平发丝线 ----------
    if (rules.includes('stacked')) {
      const h = []
      for (const el of document.querySelectorAll('body *')) {
        // 不做子元素个数粗筛：ul.card-grid 有 30 个子项却正是带边框的那个元素
        const cs = getComputedStyle(el)
        if (cs.display === 'none' || cs.visibility === 'hidden') continue
        const r = el.getBoundingClientRect()
        if (r.width < 80 || r.height <= 0) continue
        const bw = parseFloat(cs.borderTopWidth) || 0
        const bh = parseFloat(cs.borderBottomWidth) || 0
        if (bw > 0 && cs.borderTopStyle !== 'none') h.push({ y: r.top, x0: r.left, x1: r.right, el: label(el), side: 'top' })
        if (bh > 0 && cs.borderBottomStyle !== 'none') h.push({ y: r.bottom - bh, x0: r.left, x1: r.right, el: label(el), side: 'bottom' })
        // 背景充当的细线（如 .section-head .rule）同样计入
        if (r.height <= 2.5 && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') {
          h.push({ y: r.top, x0: r.left, x1: r.right, el: label(el), side: 'bg' })
        }
      }
      h.sort((a, b) => a.y - b.y)
      const seen = new Set()
      for (let i = 0; i < h.length; i++) {
        for (let j = i + 1; j < h.length; j++) {
          const a = h[i]
          const b = h[j]
          if (b.y - a.y > stackPx) break
          // 横向要真重叠：两栏账册里左右两格的线同 y 但不重叠，那是一条连续的线
          if (Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) < 40) continue
          const key = `${a.side}:${a.el}|${b.side}:${b.el}|${Math.round(a.y)}`
          if (seen.has(key)) continue
          seen.add(key)
          out.stacked.push({
            a: `${a.side}:${a.el}`,
            b: `${b.side}:${b.el}`,
            gapPx: Math.round((b.y - a.y) * 10) / 10,
            atY: Math.round(a.y),
            overlapPx: Math.round(Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)),
          })
        }
      }
    }

    // ---------- 5. 平行重复线：延伸线失去右端锚点 ----------
    // 与 stacked 的分工：stacked 管「同一条边界画两次」（≤3px 相叠）；这里管「两条平行线做
    // 同一件事」（8–64px 相距）。判据**只认 section-head 这一族语法**，不做全站泛化 ——
    // 实测全站泛化会命中 .leader 引导点线、区块夹持线、控件自身的上下框（那些是结构边框，
    // 不是装饰性重复），噪声多到不可判读。这里的规则是结构性的：
    // 延伸线（.rule）的职责是把标题与**右端英文标签**连起来；缺了标签，它就和本元素的
    // border-top 变成两条几乎等长、同为 --line-1 的平行线（首页「今日角色 / 目录」原本
    // 就是全站 54 处里唯一没有标签的两处）。
    if (rules.includes('stacked')) {
      for (const head of document.querySelectorAll('.section-head')) {
        const cs = getComputedStyle(head)
        if ((parseFloat(cs.borderTopWidth) || 0) <= 0) continue
        // 有右端标签 → 延伸线有收尾锚点，正常
        if (head.querySelector('.en')) continue
        const rule = head.querySelector('.rule')
        if (!rule) continue
        const hr = head.getBoundingClientRect()
        const rr = rule.getBoundingClientRect()
        if (hr.width <= 0) continue
        out.stacked.push({
          a: 'section-head(border-top)',
          b: 'section-head .rule',
          reason: '延伸线无右端锚点（该行缺 .en 标签）→ 与基线成为两条平行线',
          gapPx: Math.round(rr.top - hr.top),
          ruleToHeadWidthRatio: Math.round((rr.width / hr.width) * 100) / 100,
          title: (head.querySelector('h2')?.textContent || '').trim().slice(0, 12),
        })
      }
    }
    return out
  }

  const failedItems = []
  const informational = []
  const summary = []

  const ctx = await page.context().browser().newContext({ serviceWorkers: 'block' })
  const p = await ctx.newPage()
  try {
    for (const vp of VIEWPORTS) {
      await p.setViewportSize({ width: vp.w, height: vp.h })
      for (const route of ROUTES) {
        await p.goto('http://localhost:4175' + route)
        await p.evaluate(async () => {
          if (document.fonts && document.fonts.ready) await document.fonts.ready
          // 不滚动：直接把 reveal 标为已显现（只改 opacity/transform，不影响被测几何）
          for (const el of document.querySelectorAll('.reveal')) el.classList.add('revealed')
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
        })
        await p.waitForTimeout(220)
        const r = await p.evaluate(probe, {
          rules: vp.rules,
          strandedPx: STRANDED_PX,
          crampedFill: CRAMPED_FILL,
          orphanEm: ORPHAN_EM,
          balanceCap: BALANCE_LINE_CAP,
          stackPx: STACK_PX,
        })
        const where = `${vp.name} ${route}`
        summary.push({
          where,
          stranded: r.stranded.length,
          cramped: r.cramped.length,
          orphan: r.orphan.length,
          stacked: r.stacked.length,
          orphanOverCap: r.orphanOverCap.length,
        })
        for (const item of r.stranded) failedItems.push({ where, kind: 'stranded', ...item })
        for (const item of r.cramped) failedItems.push({ where, kind: 'cramped', ...item })
        for (const item of r.orphan) failedItems.push({ where, kind: 'orphan', ...item })
        for (const item of r.stacked) failedItems.push({ where, kind: 'stacked', ...item })
        for (const item of r.orphanOverCap)
          informational.push({ where, kind: 'orphan-over-balance-cap', ...item })
      }
    }
  } finally {
    await ctx.close()
  }

  const byKind = (kind) => failedItems.filter((f) => f.kind === kind).length
  return JSON.stringify(
    {
      total: summary.length,
      failed: failedItems.length,
      stranded: byKind('stranded'),
      cramped: byKind('cramped'),
      orphan: byKind('orphan'),
      stacked: byKind('stacked'),
      orphanOverCap: informational.length,
      failedItems: failedItems.slice(0, 40),
      informational: informational.slice(0, 20),
      summary,
    },
    null,
    1,
  )
}
