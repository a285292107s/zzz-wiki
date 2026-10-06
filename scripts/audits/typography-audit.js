/* ============================================================
 * typography-audit.js — 排印合规审计（playwright-cli run-code）
 *
 * 设计系统只在「渲染结果」上才算数。本脚本逐页核对三件事：
 *   1) 字号：所有带文字的元素，其计算字号是否都来自 --fs-* 令牌尺度
 *      （浏览器默认 16px 之类「没被样式覆盖」的漏网之鱼会在这里现形）
 *   2) 字体族：是否都落在三套栈内（--serif / --sans / --mono）
 *   3) 行宽（measure）：长文本块的每行字数——中文正文理想 25–45 字/行，
 *      超过 50 字/行阅读时容易串行。用 Range 实际数行盒，而非估算。
 *
 * 用法：playwright-cli open http://localhost:4175 && \
 *       playwright-cli run-code --filename=scripts/audits/typography-audit.js
 * 基线：字号越轨 0 / 字体族越轨 0 / 长文本行宽均在区间内
 * ============================================================ */

async (page) => {
  const routes = ['/', '/agents', '/agents/1011', '/w-engines/14162', '/disks/34200', '/formulas', '/about']
  const out = []

  for (const route of routes) {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('http://localhost:4175' + route, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1800)

    const r = await page.evaluate(async () => {
      // 令牌尺度：从主 CSS 文本里解析 --fs-* 声明，再逐个探测其计算值。
      // 注意：CSSOM 迭代（for…of rule.style）拿不到自定义属性——首版据此发现
      // 令牌集为空，导致 1342 条假阳性（审计自身的 bug 冒充成「发现」）。
      const probe = (css) => {
        const el = document.createElement('span')
        el.style.cssText = `position:absolute;visibility:hidden;${css}`
        document.body.appendChild(el)
        const v = getComputedStyle(el).fontSize
        el.remove()
        return v
      }
      const mainCss = [...document.querySelectorAll('link[rel="stylesheet"]')]
        .map((l) => l.getAttribute('href') || '')
        .find((h) => h.includes('/assets/'))
      const tokenNames = new Set()
      if (mainCss) {
        const text = await fetch(mainCss).then((r) => r.text())
        for (const m of text.matchAll(/--fs-[a-z0-9-]+/g)) tokenNames.add(m[0])
      }
      const tokenSizes = new Set([...tokenNames].map((n) => probe(`font-size: var(${n})`)))
      const family = (v) => String(v).split(',')[0].replace(/["']/g, '').trim()
      const rootStyle = getComputedStyle(document.documentElement)
      const stacks = new Set([
        family(rootStyle.getPropertyValue('--serif')),
        family(rootStyle.getPropertyValue('--sans')),
        family(rootStyle.getPropertyValue('--mono')),
      ])

      const sizeViolations = []
      const familyViolations = []
      const longText = []

      // 行内元素按**相对字号**是刻意的排印做法（行内 code/kbd 随上下文缩放，
      // 硬套绝对令牌反而破坏其与所在正文的比例），故不计入越轨。
      const RELATIVE_OK = new Set(['CODE', 'KBD', 'SMALL', 'SUB', 'SUP'])

      for (const el of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(el)
        if (cs.display === 'none' || cs.visibility === 'hidden') continue
        // 只看直接含文字的元素
        const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
        if (!own) continue
        const rect = el.getBoundingClientRect()
        if (!rect.width || !rect.height) continue

        if (!tokenSizes.has(cs.fontSize) && !RELATIVE_OK.has(el.tagName))
          sizeViolations.push({ sel: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : ''), size: cs.fontSize })
        if (!stacks.has(family(cs.fontFamily))) familyViolations.push({ sel: el.tagName.toLowerCase(), family: family(cs.fontFamily) })

        // 长文本块行宽：用 Range 数实际行盒
        const text = el.textContent.trim()
        if (text.length >= 120 && el.children.length <= 2) {
          const range = document.createRange()
          range.selectNodeContents(el)
          const lines = range.getClientRects().length
          if (lines > 1) longText.push({ sel: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : ''), chars: text.length, lines, perLine: Math.round(text.length / lines) })
        }
      }

      return {
        tokenSizeCount: tokenSizes.size,
        sizeViolations: sizeViolations.slice(0, 6),
        sizeViolationCount: sizeViolations.length,
        familyViolationCount: familyViolations.length,
        familyViolations: familyViolations.slice(0, 4),
        longText: longText.slice(0, 6),
      }
    })
    out.push({ route, ...r })
  }

  const totalSize = out.reduce((n, x) => n + x.sizeViolationCount, 0)
  const totalFamily = out.reduce((n, x) => n + x.familyViolationCount, 0)
  const wideLines = out.flatMap((x) => x.longText.filter((t) => t.perLine > 50).map((t) => ({ route: x.route, ...t })))
  return JSON.stringify({ routes: out.length, totalSizeViolations: totalSize, totalFamilyViolations: totalFamily, overWideLines: wideLines.length, detail: out }, null, 1)
}
