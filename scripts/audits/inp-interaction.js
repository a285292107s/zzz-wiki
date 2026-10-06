/* ============================================================
 * inp-interaction.js — 交互响应延迟（INP 代理指标）
 *
 * 为什么需要：Core Web Vitals 三项里我们此前只测了 LCP 与 CLS——**INP 从未测量**，
 * 而它在 Awwwards「可用性 30%」与 Webby「Functionality」里都是硬指标
 * （官方「良好」阈值：75 分位 ≤200ms；获奖者水平 <100ms）。
 *
 * 方法：用 Event Timing API（PerformanceObserver type:'event'）采集真实交互的
 * `duration`（从输入到下一帧绘制），在 **4× CPU 节流**下跑一组典型交互，取
 * 「最差交互」与「98 分位」作为 INP 代理（实验室无法取真实 75 分位，故从严）。
 *
 * 覆盖交互：筛选下拉（开→选）、名录检索输入、等级滑条拖动、快速检索开/输入、
 * 翻页键盘、复制链接、回到顶部。
 *
 * 用法：playwright-cli open http://localhost:4175 && \
 *       playwright-cli run-code --filename=scripts/audits/inp-interaction.js
 * 基线：最差交互 <200ms（良好），力争 <100ms（获奖者水平）
 * ============================================================ */

async (page) => {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })

  await page.addInitScript(() => {
    window.__events = []
    window.__long = []
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.interactionId) {
          window.__events.push({
            name: e.name,
            dur: Math.round(e.duration),
            t: Math.round(e.startTime),
            id: e.interactionId,
          })
        }
      }
    }).observe({ type: 'event', buffered: true, durationThreshold: 0 })
    // 长任务：交互期间的主线程阻塞（>50ms）——INP 的直接成因
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        window.__long.push({
          dur: Math.round(e.duration),
          t: Math.round(e.startTime),
          // 归因：containerName 通常是脚本 URL，containerType 说明是脚本/布局/自身
          who: (e.attribution ?? []).map((a) => `${a.containerType}:${(a.containerName || '').split('/').slice(-1)[0]}`).join(','),
        })
    }).observe({ type: 'longtask', buffered: true })
  })

  const steps = []
  const mark = (label, t0) => steps.push({ label, at: Math.round(t0) })

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('http://localhost:4175/agents', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1800)
  mark('筛选下拉：开', await page.evaluate(() => performance.now()))
  await page.click('.filter-dropdown .trigger')
  await page.waitForTimeout(400)
  await page.click('.popover [role=option]:nth-child(2)')
  await page.waitForTimeout(900)
  mark('筛选选中', await page.evaluate(() => performance.now()))

  await page.evaluate(() => document.querySelector('.search input')?.focus())
  // 真实键入（insertText 是合成事件，不产生 event-timing 条目）
  await page.keyboard.type('安', { delay: 60 })
  await page.waitForTimeout(900)
  mark('检索输入', await page.evaluate(() => performance.now()))

  await page.goto('http://localhost:4175/agents/1011', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2200)
  // 滑条拖动：连按 8 次方向键（每次都是一次真实交互）
  await page.evaluate(() => document.querySelector('.level-range')?.focus())
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(120)
  }
  mark('滑条连按 8 次', await page.evaluate(() => performance.now()))

  await page.keyboard.press('Control+k')
  await page.waitForTimeout(600)
  await page.keyboard.type('猫又', { delay: 60 })
  await page.waitForTimeout(900)
  mark('快速检索', await page.evaluate(() => performance.now()))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)

  await page.evaluate(() => window.scrollTo(0, 1500))
  await page.waitForTimeout(300)
  await page.evaluate(() => document.querySelector('.back-top')?.focus())
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1200)
  mark('回到顶部', await page.evaluate(() => performance.now()))

  const out = await page.evaluate(() => {
    // 归一化：playwright-cli 复用同一页面，**addInitScript 会累积**——同一数组里
    // 可能混入本脚本历史版本推入的裸数字。不做归一化会得到 NaN（JSON 里变 null）。
    const normLong = (v) => (typeof v === 'number' ? { dur: v, t: 0, who: 'legacy' } : v)
    const longRaw = window.__long.map(normLong)
    const evs = window.__events.slice().sort((a, b) => a.dur - b.dur)
    const p = (q) => (evs.length ? evs[Math.min(evs.length - 1, Math.floor(evs.length * q))].dur : null)
    const long = longRaw.slice().sort((a, b) => a.dur - b.dur)
    // 总阻塞时间：每个长任务超出 50ms 的部分之和（TBT 口径）
    const tbt = longRaw.reduce((n, x) => n + Math.max(0, (Number(x.dur) || 0) - 50), 0)
    return {
      count: evs.length,
      worst: evs.length ? evs[evs.length - 1] : null,
      p98: p(0.98),
      p75: p(0.75),
      median: p(0.5),
      longTasks: {
        count: long.length,
        longest: long.at(-1)?.dur ?? 0,
        tbt,
        list: long.slice(-3).map((x) => ({ dur: x.dur, at: x.t, who: x.who })),
      },
      byName: Object.entries(
        evs.reduce((acc, e) => {
          acc[e.name] = acc[e.name] ?? { n: 0, max: 0 }
          acc[e.name].n++
          acc[e.name].max = Math.max(acc[e.name].max, e.dur)
          return acc
        }, {}),
      ).map(([name, v]) => ({ name, ...v })),
    }
  })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  return JSON.stringify(out, null, 1)
}
