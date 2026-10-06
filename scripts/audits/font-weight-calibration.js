/* ============================================================
 * font-weight-calibration.js — CJK 衬线实际渲染字重标定（playwright-cli run-code）
 *
 * 背景（Round 49 实证）：Google Fonts 的 Noto Serif SC 分片是**可变字体**，
 * 其内部 family 名固定为 "Noto Serif SC ExtraLight"（默认实例 wght=200）。
 * 因此 CDP CSS.getPlatformFontsForNode 报出的字体名**不代表实际渲染字重**，
 * 容易误判为「站点全用 ExtraLight 渲染」。
 *
 * 本探针用同分片对照法标定真实字重：
 *   1) 从 noto-serif-sc.css 找覆盖「绳」(U+7EF3) 的 500 分片
 *   2) 用同一文件注册 T200/T400/T500/T700 四个测试字族（单值权重描述符
 *      → 浏览器把 wght 轴钉到该值），画布墨量建立「声明权重 → 墨量」标尺
 *   3) 测生产字族「Noto Serif SC」在 weight 400/500 的墨量，与标尺对表
 *
 * 判定：生产墨量 == T500 墨量 → 渲染字重为 500（描述符生效，符合预期）；
 *       == T200 墨量 → 说明 wght 轴未被钉住（才是真缺陷）。
 *
 * 基线（2026-10 · Chrome 桌面）：同上分片 200/400/500/700 → 290/354/403/515；
 * 生产 400 与 500 均 = 403（= wght 500 实例）。
 * ============================================================ */

async (page) => {
  await page.goto('http://localhost:4175/agents/1011', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2400)
  return await page.evaluate(async () => {
    await document.fonts.ready
    const css = await (await fetch('/fonts/noto-serif-sc.css')).text()
    const blocks = css.split('@font-face').slice(1)
    let url = null
    for (const b of blocks) {
      if (!/font-weight:\s*500/.test(b)) continue
      const range = b.match(/unicode-range:\s*([^;]+)/)?.[1] ?? ''
      const hit = range.split(',').some((part) => {
        const mm = part.trim().match(/^U\+([0-9A-Fa-f]+)(?:-([0-9A-Fa-f]+))?$/)
        if (!mm) return false
        const lo = parseInt(mm[1], 16)
        const hi = mm[2] ? parseInt(mm[2], 16) : lo
        return 0x7ef3 >= lo && 0x7ef3 <= hi
      })
      if (hit) {
        url = b.match(/url\('([^']+)'\)/)[1]
        break
      }
    }
    if (!url) return JSON.stringify({ error: '未找到覆盖 U+7EF3 的 500 分片' })

    const style = document.createElement('style')
    style.textContent = [200, 400, 500, 700]
      .map(
        (w) =>
          `@font-face{font-family:'T${w}';src:url('${url}') format('woff2');font-weight:${w};font-display:block}`,
      )
      .join('\n')
    document.head.appendChild(style)
    await Promise.all(
      [200, 400, 500, 700].map((w) => document.fonts.load(`${w} 72px T${w}`, '绳')),
    )

    const ink = (styleCss) => {
      const c = document.createElement('canvas')
      c.width = 160
      c.height = 160
      const ctx = c.getContext('2d')
      ctx.fillStyle = '#000'
      ctx.font = styleCss
      ctx.fillText('绳', 10, 110)
      const d = ctx.getImageData(0, 0, c.width, c.height).data
      let s = 0
      for (let i = 3; i < d.length; i += 4) s += d[i]
      return Math.round(s / 1000)
    }

    const scale = [200, 400, 500, 700].map((w) => ({ declared: w, ink: ink(`${w} 72px T${w}`) }))
    const prod = [400, 500].map((w) => ({ weight: w, ink: ink(`${w} 72px "Noto Serif SC"`) }))
    const t500 = scale.find((s) => s.declared === 500).ink
    return JSON.stringify(
      {
        scale,
        prod,
        verdict: prod.every((p) => p.ink === t500)
          ? 'OK：生产渲染落在 wght 500 实例（描述符生效）'
          : 'CHECK：生产墨量与 T500 不符——wght 轴可能未被钉住',
      },
      null,
      1,
    )
  })
}
