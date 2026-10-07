/* ============================================================
 * color-audit.js — 色彩系统与对比度审计（playwright-cli run-code）
 *
 * 三件事：
 *   1) **调色板合规**：页面上出现的每个颜色（文字/背景/边框）是否都能对应到
 *      设计令牌（--ink-* / --bg-* / --line-* / --amber* / --danger 等）。游离的
 *      硬编码色或浏览器默认色（UA 蓝/黑）会在这里现形。
 *   2) **文本对比度**：正文/小字对有效背景的对比度（axe 已覆盖大部分，这里做
 *      全量复核并给出最低值，便于追踪回归）。
 *   3) **非文本对比度（WCAG 1.4.11，axe 覆盖不全）**：**交互控件**的边界线与
 *      填充是否 ≥3:1——纯装饰分隔线（表格行线、区块分隔）豁免，故只查
 *      button/input/select/[role=button] 这类「边界即控件本身」的元素。
 *
 * 用法：playwright-cli open http://localhost:4175 && \
 *       playwright-cli run-code --filename=scripts/audits/color-audit.js
 * 基线：调色板越轨 0 / 文本最低对比度 ≥4.5 / 控件边界 ≥3
 * ============================================================ */

async (page) => {
  const routes = ['/', '/agents', '/agents/1011', '/atlas', '/formulas', '/about', '/compare']
  const report = []

  for (const route of routes) {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('http://localhost:4175' + route, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1800)

    const r = await page.evaluate(async () => {
      /* ---------- 令牌色值：从主 CSS 全量解析（不硬编码名单——首版只列了 15 个，
         漏掉 --rank-* / --violet / --ok / --amber-dim，把真令牌误报成越轨） ---------- */
      const probe = (css) => {
        const el = document.createElement('span')
        el.style.cssText = `position:absolute;visibility:hidden;${css}`
        document.body.appendChild(el)
        const cs = getComputedStyle(el)
        const v = `${cs.color}|${cs.backgroundColor}|${cs.borderTopColor}`
        el.remove()
        return v
      }
      const mainCss = [...document.querySelectorAll('link[rel="stylesheet"]')]
        .map((l) => l.getAttribute('href') || '')
        .find((h) => h.includes('/assets/'))
      const tokenColors = new Set()
      if (mainCss) {
        const text = await fetch(mainCss).then((r) => r.text())
        const names = new Set()
        for (const m of text.matchAll(/--([a-z0-9-]+)\s*:\s*([^;}]+)/g)) {
          if (/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(m[2])) names.add('--' + m[1])
        }
        for (const n of names) {
          for (const part of probe(`color: var(${n}); background: var(${n}); border-color: var(${n})`).split('|')) {
            tokenColors.add(part)
          }
        }
      }

      /* ---------- 对比度工具 ---------- */
      const parse = (c) => {
        const m = /rgba?\(([^)]+)\)/.exec(c)
        if (!m) return null
        const [r, g, b, a = '1'] = m[1].split(',').map((x) => parseFloat(x))
        return { r, g, b, a }
      }
      const lum = ({ r, g, b }) => {
        const f = (v) => {
          const s = v / 255
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
        }
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
      }
      const ratio = (a, b) => {
        const la = lum(a)
        const lb = lum(b)
        return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
      }
      /** 元素的有效背景：向上找第一个不透明背景 */
      const bgOf = (el) => {
        let n = el
        while (n && n !== document.documentElement) {
          const c = parse(getComputedStyle(n).backgroundColor)
          if (c && c.a > 0.5) return c
          n = n.parentElement
        }
        return { r: 13, g: 15, b: 17, a: 1 }
      }

      /* ---------- 1) 调色板合规 ---------- */
      const offPalette = new Map()
      const dataDriven = new Map()
      /* ---------- 2) 文本对比度 ---------- */
      let minText = { ratio: 99, sel: '', color: '', bg: '' }
      /* ---------- 3) 控件边界对比度 ---------- */
      const lowControl = []
      const labeledLowControl = []

      /** 元素或其祖先是否带内联 color / 自定义属性（富文本 <color=#…> 渲染的游戏数据色，
       *  以及按行注入的属性色 var(--attr-…)，都属数据驱动，不算调色板越轨） */
      const isDataDriven = (el) => {
        let n = el
        for (let d = 0; d < 4 && n; d++, n = n.parentElement) {
          const s = n.getAttribute?.('style')
          if (s && /(^|;)\s*(color|--[a-z0-9-]+)\s*:/i.test(s)) return true
        }
        return false
      }
      /** 元素或其祖先是否对读屏隐藏（纯装饰文本豁免对比度要求） */
      const isDecorative = (el) => {
        let n = el
        for (let d = 0; d < 4 && n; d++, n = n.parentElement) {
          if (n.getAttribute?.('aria-hidden') === 'true') return true
        }
        return false
      }

      for (const el of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(el)
        if (cs.display === 'none' || cs.visibility === 'hidden') continue
        const rect = el.getBoundingClientRect()
        if (!rect.width && !rect.height) continue
        const sel = el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : '')

        // 颜色收集（文字色/背景色/四边框色）
        for (const [prop, val] of [
          ['color', cs.color],
          ['bg', cs.backgroundColor],
          ['border', cs.borderTopColor],
          ['border', cs.borderBottomColor],
          ['border', cs.borderLeftColor],
          ['border', cs.borderRightColor],
        ]) {
          const p = parse(val)
          if (!p || (p.a === 0 && prop !== 'color')) continue
          if (!tokenColors.has(val)) {
            const bucket = isDataDriven(el) ? dataDriven : offPalette
            bucket.set(val, (bucket.get(val) ?? 0) + 1)
          }
        }

        // 文本对比度：仅直接含文字的元素；装饰文本（aria-hidden）豁免
        const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
        if (own && !isDecorative(el)) {
          const fg = parse(cs.color)
          const bg = bgOf(el)
          if (fg && fg.a > 0.3) {
            const cr = ratio(fg, bg)
            if (cr < minText.ratio) minText = { ratio: Math.round(cr * 100) / 100, sel, color: cs.color, bg: `rgb(${bg.r}, ${bg.g}, ${bg.b})` }
          }
        }

        // 非文本对比度：交互控件。判据分两档——
        //   有可见文字标签的控件：标签本身以 ≥4.5:1 识别控件，边框属框架，记入
        //   labeledLowControl（留档不判违规）；仅图标/无文字的控件：边界即识别依据，
        //   必须 ≥3:1，记入 lowControl。
        const isControl = /^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName) || el.getAttribute('role') === 'button'
        if (isControl) {
          const bw = parseFloat(cs.borderTopWidth) || 0
          const bc = parse(cs.borderTopColor)
          const bg = bgOf(el.parentElement ?? el)
          if (bw > 0 && bc && bc.a > 0.3) {
            const cr = ratio(bc, bg)
            if (cr < 3) {
              const label = (el.textContent || '').trim()
              const hasVisibleLabel = label.length > 0
              const entry = { sel, ratio: Math.round(cr * 100) / 100, border: cs.borderTopColor, bg: `rgb(${bg.r}, ${bg.g}, ${bg.b})`, label: label.slice(0, 12) }
              if (hasVisibleLabel) labeledLowControl.push(entry)
              else lowControl.push(entry)
            }
          }
        }
      }

      return {
        offPalette: [...offPalette.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
        offPaletteCount: offPalette.size,
        dataDrivenCount: dataDriven.size,
        dataDriven: [...dataDriven.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
        tokenColorCount: tokenColors.size,
        minText,
        lowControl: lowControl.slice(0, 8),
        lowControlCount: lowControl.length,
        labeledLowControl: labeledLowControl.slice(0, 5),
        labeledLowControlCount: labeledLowControl.length,
      }
    })
    report.push({ route, ...r })
  }

  return JSON.stringify(
    {
      routes: report.length,
      totalOffPalette: report.reduce((n, x) => n + x.offPaletteCount, 0),
      totalDataDriven: report.reduce((n, x) => n + x.dataDrivenCount, 0),
      tokenColorCount: report[0]?.tokenColorCount ?? 0,
      worstTextRatio: Math.min(...report.map((x) => x.minText.ratio)),
      totalLowControl: report.reduce((n, x) => n + x.lowControlCount, 0),
      totalLabeledLowControl: report.reduce((n, x) => n + x.labeledLowControlCount, 0),
      detail: report,
    },
    null,
    1,
  )
}
