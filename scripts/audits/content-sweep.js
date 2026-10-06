/* ============================================================
 * content-sweep.js — 全站内容完整性扫描（playwright-cli run-code）
 *
 * 逐页检查「渲染异常」——只在真的打开每一页时才会暴露的问题：
 *   1) 未渲染/未解析的泄漏：文本出现 undefined / null / NaN / [object Object] / {{ }}
 *   2) 空区块：section[id] 除标题外没有内容（数据缺失时的静默空白）
 *   3) 断图：<img> 已结束加载但 naturalWidth 为 0（候选链与 CDN 全失败）
 *   4) 页元信息：title 为空或仍是静态兜底、description 缺失
 *   5) 统计信息：内容过短（< 200 字）的详情页——可能是数据缺失的弱页面
 *
 * 页面清单取自 /sitemap.xml（与搜索引擎看到的一致，238 条）。
 * 用法：playwright-cli open http://localhost:4175 && \
 *       playwright-cli run-code --filename=scripts/audits/content-sweep.js
 * 基线：泄漏 0 / 空区块 0 / 断图 0 / 元信息齐全
 * ============================================================ */

async (page) => {
  const res = await page.request.get('http://localhost:4175/sitemap.xml')
  const xml = await res.text()
  const paths = [...xml.matchAll(/<loc>https?:\/\/[^/]+([^<]*)<\/loc>/g)].map((m) => m[1] || '/')
  const LEak = /undefined|null|NaN|\[object Object\]|\{\{/
  const anomalies = []
  let checked = 0
  const stats = { thin: [], missingDesc: [], placeholders: [] }

  for (const p of paths) {
    await page.goto('http://localhost:4175' + p, { waitUntil: 'domcontentloaded' })
    // 详情页要等数据到达（h1 出现）；列表页等表格行
    await page
      .waitForFunction(
        () => !!document.querySelector('h1, .page-title, tbody tr, .disk-card'),
        null,
        { timeout: 6000 },
      )
      .catch(() => {})
    await page.waitForTimeout(350)
    checked++

    const r = await page.evaluate((LEakSrc) => {
      const re = new RegExp(LEakSrc)
      const text = document.body.innerText || ''
      const leaks = []
      // 只在可见文本里找泄漏（含常见误渲染形态）
      for (const m of text.matchAll(new RegExp(LEakSrc, 'g'))) {
        const i = Math.max(0, (m.index ?? 0) - 24)
        leaks.push(text.slice(i, (m.index ?? 0) + 24).replace(/\s+/g, ' '))
        if (leaks.length >= 3) break
      }
      const emptySections = [...document.querySelectorAll('section[id]')]
        .map((s) => {
          const clone = s.cloneNode(true)
          clone.querySelectorAll('h1,h2,h3,.section-head,.sr-only').forEach((h) => h.remove())
          const rest = (clone.textContent || '').replace(/\s+/g, ' ').trim()
          return { id: s.id, rest }
        })
        // 真空白才报：阈值 4 字。曾用 8 字导致误报——「阵营 狡兔屋」「暴击率+8%。」
        // 这类合法最简内容被当空块（2026-10 首跑 7 处全是误报）。阈值只能定在
        // 「确实什么都没有」附近，其余交给人工看文本判断。
        .filter((x) => x.rest.length < 4)
        .map((x) => `${x.id}${x.rest ? '「' + x.rest + '」' : ''}`)
      // 仅占位符（全是 —）的区块：不算失败，但值得人工确认是否为数据缺口
      const placeholderSections = [...document.querySelectorAll('section[id]')]
        .filter((s) => {
          const clone = s.cloneNode(true)
          clone.querySelectorAll('h1,h2,h3,.section-head,.sr-only').forEach((h) => h.remove())
          const rest = (clone.textContent || '').replace(/\s+/g, ' ').trim()
          return rest.length >= 4 && /^[—\s]+$/.test(rest)
        })
        .map((s) => s.id)
      const brokenImgs = [...document.querySelectorAll('img')]
        .filter((i) => i.complete && i.naturalWidth === 0 && i.getAttribute('src'))
        .map((i) => (i.getAttribute('src') || '').split('/').slice(-1)[0])
      return {
        title: document.title,
        desc: document.querySelector('meta[name=description]')?.getAttribute('content') ?? '',
        textLen: text.length,
        leaks,
        emptySections,
        placeholderSections,
        brokenImgs,
        isDetail: !!document.querySelector('.detail, .page-title'),
      }
    }, LEak.source)

    const probs = []
    if (r.leaks.length) probs.push(`泄漏: ${r.leaks.join(' ⏐ ')}`)
    if (r.emptySections.length) probs.push(`空区块: ${r.emptySections.join(',')}`)
    if (r.brokenImgs.length) probs.push(`断图: ${r.brokenImgs.slice(0, 2).join(',')}`)
    if (!r.title || r.title === '绳网档案 · 绝区零数据图鉴') probs.push(`title 兜底/为空: ${r.title}`)
    if (!r.desc) probs.push('缺 description')
    if (r.placeholderSections.length) stats.placeholders.push(`${p}: ${r.placeholderSections.join(',')}`)
    if (r.isDetail && r.textLen < 200) stats.thin.push(`${p}(${r.textLen})`)
    if (probs.length) anomalies.push({ path: p, probs })
  }

  return JSON.stringify(
    {
      pagesChecked: checked,
      pagesWithAnomalies: anomalies.length,
      thinPages: stats.thin.length,
      placeholderOnlySections: stats.placeholders.length,
      anomalySummary: anomalies,
      placeholders: stats.placeholders.slice(0, 10),
      thin: stats.thin.slice(0, 12),
    },
    null,
    1,
  )
}
