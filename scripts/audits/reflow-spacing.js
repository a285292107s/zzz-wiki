/* ============================================================
 * reflow-spacing.js — WCAG 1.4.10 重排 + 1.4.12 文本间距（playwright-cli run-code）
 *
 * 1.4.10 重排：320 CSS px 宽（≈ 1280px 视口 400% 缩放）下**不得出现横向滚动**，
 *   内容应纵向重排。此前只审到 390px，320px 是标准的硬线。
 * 1.4.12 文本间距：用户注入以下覆盖后，内容不得被裁切或重叠——
 *   line-height: 1.5 / letter-spacing: 0.12em / word-spacing: 0.16em /
 *   段落间距 2em（不改字号）。常见破绽：固定高度的容器、overflow:hidden 的单行截断。
 *
 * 用法：playwright-cli open http://localhost:4175 && \
 *       playwright-cli run-code --filename=scripts/audits/reflow-spacing.js
 * 基线：320px 无横向溢出 / 间距覆盖后 0 处裁切
 * ============================================================ */

async (page) => {
  const routes = ['/', '/agents', '/agents/1011', '/w-engines/14162', '/disks/31000', '/formulas', '/about', '/compare']
  const report = []

  for (const route of routes) {
    /* ---------- 1.4.10 重排：320px ---------- */
    await page.setViewportSize({ width: 320, height: 720 })
    // **先预热该路由再测量**：CJK 衬线按 unicode-range 懒加载，冷缓存下（全量审计里
    // offline-check 会清缓存）字体尚未就绪时文本行高偏小 → 命中区被误判 <24px
    // （全量审计偶发 smallTargetsAt320: 3，单独复跑为 0）。预热 + 等字体就绪后再量，
    // 测的是「布局是否合规」这一稳定属性，与缓存冷热无关。
    await page.goto('http://localhost:4175' + route, { waitUntil: 'networkidle' })
    await page.waitForFunction(() => document.fonts?.status === 'loaded', null, { timeout: 15000 }).catch(() => {})
    await page.goto('http://localhost:4175' + route, { waitUntil: 'networkidle' })
    await page.waitForFunction(() => document.fonts?.status === 'loaded', null, { timeout: 15000 }).catch(() => {})
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))),
    )
    await page.waitForTimeout(300)
    const reflow = await page.evaluate(() => {
      const docOverflow = document.documentElement.scrollWidth > window.innerWidth + 1
      // 找出真正超宽的元素（可能是设计内的横向滚动容器，需人工甄别）
      const wide = []
      for (const el of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(el)
        if (cs.display === 'none' || cs.visibility === 'hidden') continue
        if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') continue // 允许的局部横滚
        const r = el.getBoundingClientRect()
        if (r.width > window.innerWidth + 1 && r.height > 0) {
          wide.push(el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : ''))
        }
      }
      // 320px 可用性：不溢出 ≠ 能用。查命中区（≥24px，WCAG 2.5.8 下限）。
      // 豁免：**行内文本链接**（2.5.8 的 inline 例外——尺寸受行高约束，不是独立目标）。
      const small = []
      for (const el of document.querySelectorAll('a[href], button, input, select, [role="button"]')) {
        const cs = getComputedStyle(el)
        if (cs.display === 'none' || cs.visibility === 'hidden') continue
        if (el.tagName === 'A' && cs.display.startsWith('inline')) continue // 行内链接豁免
        const r = el.getBoundingClientRect()
        if (!r.width || !r.height) continue
        if (r.height < 24 || r.width < 24) {
          small.push({
            sel: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : ''),
            w: Math.round(r.width),
            h: Math.round(r.height),
          })
        }
      }
      return {
        docOverflow,
        scrollW: document.documentElement.scrollWidth,
        vw: window.innerWidth,
        wide: [...new Set(wide)].slice(0, 6),
        smallTargets: small.slice(0, 8),
        smallTargetCount: small.length,
      }
    })

    /* ---------- 1.4.12 文本间距 ---------- */
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('http://localhost:4175' + route, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)
    const spacing = await page.evaluate(() => {
      const style = document.createElement('style')
      style.id = 'wcag-text-spacing'
      style.textContent = `* {
        line-height: 1.5 !important;
        letter-spacing: 0.12em !important;
        word-spacing: 0.16em !important;
      }
      p { margin-bottom: 2em !important; }`
      document.head.appendChild(style)
      // 强制重排后检测裁切
      const clipped = []
      for (const el of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(el)
        if (cs.display === 'none' || cs.visibility === 'hidden') continue
        // .sr-only 是「1px 盒 + overflow hidden」的视觉隐藏技法，本就裁切——
        // 间距放大后它必然「溢出」，属预期而非缺陷（首跑 5 处全在此）
        if (el.classList.contains('sr-only')) continue
        const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
        if (!own) continue
        // 垂直裁切：内容高于可视高度且不允许溢出
        const verticalClip = el.scrollHeight > el.clientHeight + 2 && /hidden|clip/.test(cs.overflowY)
        // 水平裁切：单行省略（white-space:nowrap + overflow hidden）在字距放大后会截断更多
        const horizontalClip = el.scrollWidth > el.clientWidth + 2 && /hidden|clip/.test(cs.overflowX)
        if (verticalClip || horizontalClip) {
          clipped.push({
            sel: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : ''),
            kind: verticalClip ? 'v' : 'h',
            over: verticalClip ? el.scrollHeight - el.clientHeight : el.scrollWidth - el.clientWidth,
          })
        }
      }
      // 相邻文本重叠检测（间距放大后最常见的破绽）。
      // 必须排除**祖先-后代**：首跑 8 处「重叠」全是 li.row × 其内部的 p.desc / h3.title
      // ——包含关系不是重叠（审计自身的坑，先修检测再下结论）。
      const overlaps = []
      const nodes = [...document.querySelectorAll('p, li, dd, h1, h2, h3')].slice(0, 400)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          if (nodes[i].contains(nodes[j]) || nodes[j].contains(nodes[i])) continue
          const a = nodes[i].getBoundingClientRect()
          const b = nodes[j].getBoundingClientRect()
          if (a.width === 0 || b.width === 0) continue
          const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
          const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left)
          if (overlapY > 4 && overlapX > 4) {
            const sel = (el) => el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : '')
            overlaps.push(`${sel(nodes[i])} × ${sel(nodes[j])}`)
          }
        }
      }
      document.getElementById('wcag-text-spacing')?.remove()
      return {
        clipped: clipped.slice(0, 8),
        clippedCount: clipped.length,
        overlaps: [...new Set(overlaps)].slice(0, 5),
        overlapCount: new Set(overlaps).size,
      }
    })

    report.push({ route, reflow, spacing })
  }

  // 触屏档位验证：CDP 的 setTouchEmulationEnabled 能真正翻转 (pointer: coarse)
  // / (hover: none)（Emulation.setEmulatedMedia 不行——本会话早前据此误判「无法验证」）。
  // 滑条在触屏档应放大拇指并加高命中带。
  const cdp = await page.context().newCDPSession(page)
  await page.goto('http://localhost:4175/agents/1011', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1800)
  const readSlider = () =>
    page.evaluate(() => {
      const el = document.querySelector('input.level-range')
      return {
        coarse: matchMedia('(pointer: coarse)').matches,
        thumb: parseFloat(getComputedStyle(el).getPropertyValue('--thumb-size')) || 0,
        boxH: Math.round(el.getBoundingClientRect().height),
      }
    })
  const desktop = await readSlider()
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
  await page.waitForTimeout(300)
  const touch = await readSlider()
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false })

  return JSON.stringify(
    {
      routes: report.length,
      reflowOverflow: report.filter((r) => r.reflow.docOverflow).length,
      smallTargetsAt320: report.reduce((n, r) => n + r.reflow.smallTargetCount, 0),
      spacingClipped: report.reduce((n, r) => n + r.spacing.clippedCount, 0),
      spacingOverlaps: report.reduce((n, r) => n + r.spacing.overlapCount, 0),
      // 失败必须自带定位信息（脚本内已记 route/sel/尺寸），否则下一轮要重新考古
      smallTargetDetail: report.flatMap((r) => (r.reflow.smallTargets ?? []).map((s) => ({ route: r.route, ...s }))),
      touch: { desktop, touch, thumbGrows: touch.thumb > desktop.thumb, hitBandOk: touch.boxH >= 24 && desktop.boxH >= 24 },
      detail: report,
    },
    null,
    1,
  )
}
