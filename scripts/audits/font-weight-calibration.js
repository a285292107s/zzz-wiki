/* ============================================================
 * font-weight-calibration.js — CJK 衬线「是否走了我们自托管的字」标定
 * （playwright-cli run-code）
 *
 * 背景（Round 49 起、Round 56 更新）：
 *   Google 的 CSS 交付里 family 内部名一直是 "Noto Serif SC ExtraLight…"，
 *   而 CDP CSS.getPlatformFontsForNode 报的就是内部名——**不代表实际渲染字重**。
 *   自 2026-10 起官方分片是**静态实例**（无 fvar 轴，OS/2 usWeightClass=500），
 *   本站再经 subset-cjk-fonts.mjs 按字符集裁剪后自托管。
 *
 * 因此本审计的判据改为「来源 + 字重一致性」：
 *   取覆盖「绳」(U+7EF3) 的本站分片，将它注册为测试字族 TESTCJK，
 *   用同一字符分别经生产字族「Noto Serif SC」与 TESTCJK 画布渲染，
 *   墨量必须相等 —— 相等即证明生产用的是我们交付的分片（而非机器上的本地字体），
 *   且两者字重一致（同一个文件）。
 *
 * 若生产墨量 != TESTCJK 墨量：说明生产命中了别的字体（本地安装的同名字体、
 * 或分片未生效而回退系统字体），需要排查字体交付链路。
 *
 * 用法：playwright-cli open http://localhost:4175 && \
 *       playwright-cli run-code --filename=scripts/audits/font-weight-calibration.js
 * 基线（2026-10，静态 500 分片）：两侧墨量相等（实测 403）
 * ============================================================ */

async (page) => {
  await page.goto('http://localhost:4175/agents/1011', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2200)
  return await page.evaluate(async () => {
    await document.fonts.ready
    const css = await (await fetch('/fonts/noto-serif-sc.css')).text()
    const blocks = css.split('@font-face').slice(1)
    // 找覆盖「绳」U+7EF3 的分片
    let url = null
    for (const b of blocks) {
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
    if (!url) return JSON.stringify({ error: '未找到覆盖 U+7EF3 的分片' })

    const w = blocks.find((b) => b.includes(url))?.match(/font-weight:\s*(\d+)/)?.[1] ?? '500'
    const style = document.createElement('style')
    style.textContent = `@font-face{font-family:'TESTCJK';src:url('${url}') format('woff2');font-weight:${w};font-display:block}`
    document.head.appendChild(style)
    await document.fonts.load(`${w} 72px TESTCJK`, '绳')

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

    const prod = ink('500 72px "Noto Serif SC"')
    const ours = ink(`500 72px TESTCJK`)
    const prodFaces = [...document.fonts].filter((f) => f.family.includes('Noto Serif')).length
    const loaded = [...document.fonts].filter((f) => f.family.includes('Noto Serif') && f.status === 'loaded').length
    return JSON.stringify(
      {
        fragment: url.split('/').pop().slice(0, 22),
        declaredWeight: w,
        prodInk: prod,
        shippedFileInk: ours,
        declaredFaces: prodFaces,
        loadedFaces: loaded,
        verdict:
          prod === ours && prod > 0
            ? 'OK：生产渲染 = 自托管分片（未被本地字体顶替），字重一致'
            : 'CHECK：生产墨量与自托管分片不一致——排查字体交付链',
      },
      null,
      1,
    )
  })
}
