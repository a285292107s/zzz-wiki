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
 * 五类判据（除 orphan 外均为 0 才算通过；orphan 只报告）：
 *   1. stranded  行内空洞：flex/grid 行里相邻两项之间空出 ≥240px，且该行**不是**
 *                space-between 布局、末项也没有 `margin-left:auto`（两者都是刻意的两端对齐，
 *                不是空洞；区块头标题与右端英文注记就是后者）
 *   2. cramped   窄列挤压：nowrap 的 **flex** 行已被塞满（子项宽之和 ≥95% 行宽），
 *                且其中有 **两个以上** 子项在内部折成 ≥2 行 —— 一行内容被挤到没有余量。
 *                （单个文本块占满剩余宽度后折行是正常排版，不算；grid 行不计，
 *                  因为跨轨子项的宽度会重叠，「填满度」无从计算）
 *   3. orphan    末行孤字：折成 ≥2 行的文本块，末行宽度 ≤2 个字。**只报告、不判失败**：
 *                正文已改回浏览器默认断行（决策记录 0023），CJK 末行 1–3 字是断行的正常
 *                结果，靠改文案处理或接受；本项留作逐轮基线，防止孤字泛滥而无人察觉。
 *   4. stacked   叠线：两条水平发丝线 y 相差 ≤3px 且横向重叠 —— 同一条边界被画了两次，
 *                叠成 2px（而板的顶缘只有 1px，上下缘就差一倍重量）。横向不重叠的不算：
 *                两栏账册里左右两格同 y 的线其实接成了一条连续的线。
 *                ⚠ 只认**元素**上的线（上下边框 + 背景充当的细线）；伪元素（如吸顶横条
 *                当前项那条刻意的下刻线）不在扫描范围 —— 那条本来就该压在横条下缘线上。
 *   5. headRule  章节刻线：区块头不得再画边界线（那会与上一区块的收尾线成对，也会压在
 *                标题上）；区块之间的分隔交给留白 + 编号 + 标题，只有断层（`.seam`）才画
 *                `.section-mark` 的 SVG 花饰，画在空隙中线上（见 `docs/decisions/0024`）。
 *                判据：头部 `border-top = 0`；`.seam` 区块必须带花饰；花饰若存在则是窄带
 *                （8–40px 高）、宽度在 120px 与头部宽度 80% 之间、水平居中、`aria-hidden`；
 *                单页花饰 ≤ 2（再密就等于退回「每块一条」）；有 `.en` 的头部 `.leader`
 *                下边线为 dotted（`docs/decisions/0019`）。一个 `.section-head` 或一个花饰
 *                都扫不到时同样判失败，禁止空转。
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
    '/about',
    '/settings',
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
  // 两条水平发丝线 y 相差 ≤3px 且横向有重叠 → 同一条边界画了两条（叠成 2px）
  const STACK_PX = 3

  const probe = (opts) => {
    const { rules, strandedPx, crampedFill, orphanEm, stackPx } = opts
    const out = {
      stranded: [],
      cramped: [],
      orphan: [],
      stacked: [],
      headRule: [],
      sectionHeads: 0,
      seamBlocks: 0,
      marks: 0,
    }
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
    /** 末项 margin-left:auto（或首项 margin-right:auto）= 与 space-between 同义的刻意两端对齐
     *  （区块头的标题与右端英文注记就靠它收尾），不算空洞 */
    const autoPushed = (el) => {
      const kids = [...el.children].filter((k) => getComputedStyle(k).position === 'static')
      if (kids.length < 2) return false
      return (
        (parseFloat(getComputedStyle(kids[kids.length - 1]).marginLeft) || 0) > 0 ||
        (parseFloat(getComputedStyle(kids[0]).marginRight) || 0) > 0
      )
    }

    // ---------- 1. 行内空洞 ----------
    if (rules.includes('stranded')) {
      const seen = new Set()
      for (const row of document.querySelectorAll('*')) {
        // 先按子元素个数粗筛（每行 2–8 项），避免对整棵树做布局测量
        if (row.childElementCount < 2 || row.childElementCount > 8) continue
        if (seen.has(row) || !visible(row) || !isRow(row) || spaceBetween(row) || autoPushed(row)) continue
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
        out.orphan.push({
          el: label(el),
          text: brief(el),
          lines: w.length,
          lastLinePx: Math.round(last),
          widestLinePx: Math.round(widest),
          fontSizePx: Math.round(fs),
        })
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
        // 背景充当的细线（如 .dossier 的网格线）同样计入
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

    // ---------- 5. 章节刻线：边界不画在区块头上，只有断层才画雕刻花饰 ----------
    // 花饰降频到「每页 ≤2」（见 docs/decisions/0024）：多数区块之间的边界只靠留白 + 编号 +
    // 标题，花饰只标注换册处的断层。判据：
    //   · 头部 border-top = 0（全宽线会与上一区块的收尾线成对，见 0017/0018）；
    //   · 带 .seam 的区块必须画花饰；**没有花饰的区块头不判失败**（降频是设计），
    //     但只要有花饰，形态仍要合规：窄带 8–40px 高、宽 120px–头部 80%、水平居中、aria-hidden；
    //   · 单页花饰 > 2 判失败（否则等于退回「每块一条」）；
    //   · 有右端英文注记的头部必须有 .leader，且其下边线为 dotted（0019）。
    // 整轮一个花饰都没扫到同样判失败 —— 判据不能靠「找不到就通过」空转。
    if (rules.includes('stacked')) {
      out.seamBlocks = document.querySelectorAll('.block.seam').length
      out.marks = document.querySelectorAll('.section-head .section-mark').length
      for (const head of document.querySelectorAll('.section-head')) {
        const hr = head.getBoundingClientRect()
        if (hr.width <= 0) continue
        out.sectionHeads++
        const border = parseFloat(getComputedStyle(head).borderTopWidth) || 0
        const mark = head.querySelector('.section-mark')
        const mr = mark ? mark.getBoundingClientRect() : null
        const markW = mr ? mr.width : 0
        const markH = mr ? mr.height : 0
        const centered = !!mr && Math.abs(mr.left + mr.width / 2 - (hr.left + hr.width / 2)) < 1.5
        const decorative = mark ? mark.getAttribute('aria-hidden') === 'true' : false
        const hasEn = !!head.querySelector('.en')
        const leader = head.querySelector('.leader')
        const leaderStyle = leader ? getComputedStyle(leader).borderBottomStyle : 'missing'
        const badLeader = hasEn && leaderStyle !== 'dotted'
        const seam = !!head.closest('.block')?.classList.contains('seam')
        const badMark =
          !!mark &&
          (markW < 120 || markW > hr.width * 0.8 || markH < 8 || markH > 40 || !centered || !decorative)
        const bad = border > 0 || badMark || (seam && !mark) || badLeader
        if (!bad) continue
        out.headRule.push({
          title: (head.querySelector('h2')?.textContent || '').trim().slice(0, 12),
          seam,
          headBorderTop: border,
          mark: !!mark,
          markW: Math.round(markW * 10) / 10,
          markH: Math.round(markH * 10) / 10,
          centered,
          decorative,
          leader: leaderStyle,
        })
      }
      if (out.marks > 2) {
        out.headRule.push({ reason: 'mark-over-cap（每页花饰上限 2）', marks: out.marks })
      }
    }
    return out
  }

  const failedItems = []
  const informational = []
  const summary = []
  let headsTotal = 0
  let marksTotal = 0

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
          stackPx: STACK_PX,
        })
        const where = `${vp.name} ${route}`
        summary.push({
          where,
          stranded: r.stranded.length,
          cramped: r.cramped.length,
          orphan: r.orphan.length,
          stacked: r.stacked.length,
          headRule: r.headRule.length,
          sectionHeads: r.sectionHeads,
          seamBlocks: r.seamBlocks,
          marks: r.marks,
        })
        headsTotal += r.sectionHeads
        marksTotal += r.marks
        for (const item of r.stranded) failedItems.push({ where, kind: 'stranded', ...item })
        for (const item of r.cramped) failedItems.push({ where, kind: 'cramped', ...item })
        for (const item of r.orphan) informational.push({ where, kind: 'orphan', ...item })
        for (const item of r.stacked) failedItems.push({ where, kind: 'stacked', ...item })
        for (const item of r.headRule) failedItems.push({ where, kind: 'head-rule', ...item })
      }
    }
  } finally {
    await ctx.close()
  }

  if (headsTotal === 0) {
    failedItems.push({
      where: '(all)',
      kind: 'head-rule',
      reason: '页面里一个 .section-head 都没扫到，章节刻线判据空转',
    })
  }

  if (marksTotal === 0) {
    failedItems.push({
      where: '(all)',
      kind: 'head-rule',
      reason: '整轮没扫到一个 .section-mark，断层花饰判据空转',
    })
  }

  const byKind = (kind) => failedItems.filter((f) => f.kind === kind).length
  const infoByKind = (kind) => informational.filter((f) => f.kind === kind).length
  return JSON.stringify(
    {
      total: summary.length,
      failed: failedItems.length,
      stranded: byKind('stranded'),
      cramped: byKind('cramped'),
      orphan: infoByKind('orphan'),
      stacked: byKind('stacked'),
      headRule: byKind('head-rule'),
      sectionHeads: headsTotal,
      marks: marksTotal,
      informationalTotal: informational.length,
      failedItems: failedItems.slice(0, 40),
      informational: informational.slice(0, 20),
      summary,
    },
    null,
    1,
  )
}
