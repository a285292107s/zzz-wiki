/* ============================================================
 * hero-flight.js — 首页「今日角色」→ 代理人详情的**共享元素飞行**是否真的发生
 *
 * 为什么单列一项：这段过渡曾经**静默空转**了很久 —— `vt-active` 挂着、
 * `getAnimations()` 也不为空，唯独两端几何完全相同，观感上是「首页硬切到详情页」。
 * 「有没有动画类 / 有没有动画对象」都验不出来，**只有读 `::view-transition-group` 的
 * 逐帧几何**才分辨得出飞没飞。
 *
 * 两条路径都要测（第二条抓到的正是最隐蔽的那个 bug）：
 *   A. 直接点活动卡
 *   B. **先换卡再点**（点刻度 → 再点跳转）：新旧两页都带端点标记，若「等新页就位」时
 *      只按属性名找，就会命中的还在场上的旧页、回调提前放行 —— 新状态采样到的仍是旧页面，
 *      整段飞行冻在起飞盒。约一半概率复现，只有逐帧几何能稳定抓到。
 *
 * 判据：
 *   1. 起跳：点击后出现 `vt-active`
 *   2. 真的在动：首帧与末帧几何至少一项差异 > TOL（阈值 20px）
 *   3. 收敛：末帧几何 ≈ 目的地 `.hero-bg` 的盒子
 *   4. 收尾干净：结束后 html 上不留 vt-active / vt-landing / vt-landed
 *   5. 回程落回起飞的那张卡（否则 A 的画会飞进 B 的框里）
 *
 * 复跑：playwright-cli open http://localhost:4175 && \
 *       playwright-cli run-code --filename=scripts/audits/hero-flight.js
 * 前置：npm run build:ci && npm run preview（:4175）
 * ============================================================ */

async page => {
  const ORIGIN = 'http://localhost:4175'
  /** 几何差异阈值（CSS px）：低于它就算「没动」—— 正是这套审计要抓的那类空转 */
  const TOL = 20
  /** 慢放：真实 400ms 在 headless 下采不到足够中间帧 */
  const SLOW_CSS = `
::view-transition-group(deck-frame){animation-duration:2400ms !important}
::view-transition-old(deck-frame){animation-duration:1200ms !important}
::view-transition-new(deck-frame){animation-duration:1200ms !important}
::view-transition-old(root){animation-duration:1400ms !important}
::view-transition-new(root){animation-duration:1400ms !important}`

  const failedItems = []
  let total = 0
  const check = (name, ok, detail) => {
    total += 1
    if (!ok) failedItems.push({ name, detail })
  }

  const home = async () => {
    await page.goto(`${ORIGIN}/`, { waitUntil: 'load' })
    await page.waitForSelector('[data-vt-shared]')
    await page.waitForTimeout(900)
  }

  /** 跑一趟飞行并采几何。`tick` 非空时先换卡（路径 B）。 */
  const fly = async (label, tick) => {
    await home()
    if (tick != null) {
      await page.locator('.deck-tick').nth(tick).click()
      await page.waitForTimeout(500)
    }
    await page.addStyleTag({ content: SLOW_CSS })

    const trace = await page.evaluate(async () => {
      const root = document.documentElement
      const read = () => {
        const g = getComputedStyle(root, '::view-transition-group(deck-frame)')
        return { w: parseFloat(g.width) || 0, h: parseFloat(g.height) || 0, t: g.transform }
      }
      const out = []
      const named = document.querySelector('[data-vt-shared]')
      const href = named?.getAttribute('href') ?? ''
      named.click()
      for (let i = 0; i < 90; i++) {
        await new Promise((r) => setTimeout(r, 40))
        out.push({ ...read(), vt: root.classList.contains('vt-active'), path: location.pathname })
      }
      return { href, out }
    })

    // 中间帧：有几何的采样（过渡结束后伪元素消失 → width 归 0/auto）
    const frames = trace.out.filter((f) => f.w)
    const first = frames[0]
    const last = frames[frames.length - 1]
    const parseT = (t) => {
      const m = /matrix\(([^)]+)\)/.exec(t ?? '')
      if (!m) return { x: 0, y: 0 }
      const p = m[1].split(',').map((v) => parseFloat(v.trim()))
      return { x: p[4] ?? 0, y: p[5] ?? 0 }
    }
    const landing = await page.evaluate(() => {
      const r = document.querySelector('.hero-bg')?.getBoundingClientRect()
      return r ? { w: Math.round(r.width), h: Math.round(r.height) } : null
    })
    await page.waitForTimeout(2600)
    const after = await page.evaluate(() => ({
      path: location.pathname,
      vt: document.documentElement.classList.contains('vt-active'),
      landing: document.documentElement.classList.contains('vt-landing'),
      landed: document.documentElement.classList.contains('vt-landed'),
    }))

    const a = first ? { ...first, ...parseT(first.t) } : null
    const b = last ? { ...last, ...parseT(last.t) } : null
    const delta =
      a && b
        ? {
            dw: Math.round(Math.abs(a.w - b.w)),
            dh: Math.round(Math.abs(a.h - b.h)),
            dx: Math.round(Math.abs(a.x - b.x)),
            dy: Math.round(Math.abs(a.y - b.y)),
          }
        : null

    check(`${label}·vt-active 出现`, trace.out.some((f) => f.vt), `采样数=${trace.out.filter((f) => f.vt).length}`)
    check(`${label}·采到 ≥3 个中间帧`, frames.length >= 3, `frames=${frames.length}`)
    check(
      `${label}·飞行有几何位移（不是纯交叉溶解）`,
      !!delta && Math.max(delta.dw, delta.dh, delta.dx, delta.dy) > TOL,
      `delta=${JSON.stringify(delta)} 阈值 ${TOL}px`,
    )
    check(
      `${label}·终点几何 = 目的地 .hero-bg`,
      !!landing && !!b && Math.abs(b.w - landing.w) <= 2 && Math.abs(b.h - landing.h) <= 2,
      `末帧=${b ? `${Math.round(b.w)}×${Math.round(b.h)}` : 'n/a'} 目的地=${landing ? `${landing.w}×${landing.h}` : 'n/a'}`,
    )
    check(`${label}·导航落到代理人详情`, /^\/agents\/\d+$/.test(after.path), after.path)
    check(`${label}·结束后不留 vt 标记`, !after.vt && !after.landing && !after.landed, JSON.stringify(after))
    return { href: trace.href, frames, delta, landing, after }
  }

  // A：直接点活动卡（第 1 张）
  const direct = await fly('A直接点', null)

  // B：先换到第 3 张再点（新旧标记必须分得开，否则此处退化成硬切）
  const switched = await fly('B先换卡', 2)

  // 5. 回程：落回起飞的那张卡
  const back = await page.evaluate(async () => {
    history.back()
    await new Promise((r) => setTimeout(r, 1800))
    return {
      path: location.pathname,
      href: document.querySelector('[data-vt-shared]')?.getAttribute('href') ?? '',
    }
  })
  check('回程落回同一张卡', back.path === '/' && back.href === switched.href, JSON.stringify({ ...back, expected: switched.href }))

  // 6. 起飞前编排：整页退场 + 原地取景变形，两者落定才起跳
  // ⚠ 采样必须**每次一个独立 evaluate**：这段时间里会发生一次导航，
  //   把整段循环塞进一个 evaluate 会撞上「Execution context was destroyed」（实测）。
  await home()
  const pre0 = await page.evaluate(() => {
    const img = document.querySelector('[data-vt-shared] img')
    const visible = Array.from(document.querySelectorAll('[data-vt-block]')).filter((el) => {
      const r = el.getBoundingClientRect()
      return r.bottom > 0 && r.top < innerHeight && el.getClientRects().length
    })
    const start = img ? getComputedStyle(img).transform : ''
    document.querySelector('[data-vt-shared]').click()
    return { blocks: visible.length, transform0: start }
  })
  let exitSeen = false
  let cascade = 0
  let lastDeckMorph = ''
  for (let i = 0; i < 50; i++) {
    await page.waitForTimeout(40)
    const s = await page.evaluate(() => {
      const root = document.documentElement
      const ops = Array.from(document.querySelectorAll('.vt-out')).map((el) => Number(getComputedStyle(el).opacity))
      // 只认**起飞端**那张画（data-vt-shared="deck"）：导航后同名标记会换成详情端，
      // 用属性名泛查会读到目的地那张（transform: none），把结论读成"已变形"（实测踩过）
      const img = document.querySelector('[data-vt-shared="deck"] img')
      return {
        exit: root.classList.contains('vt-exit'),
        cascade: ops.length ? Math.max(...ops) - Math.min(...ops) : 0,
        morph: img ? getComputedStyle(img).transform : '',
      }
    })
    if (s.exit) {
      exitSeen = true
      // 错峰要**在整个退场过程中取最大值**：退场用 ease-in，头 40ms 各块还没拉开，
      // 只采「第一次看到 vt-exit 的那一刻」会读到 0.01 而误判（实测踩过）
      cascade = Math.max(cascade, s.cascade)
    }
    if (s.morph) lastDeckMorph = s.morph // 记录起飞端最后一次可见的取景
  }
  await page.waitForTimeout(2600)
  const startScale = (() => {
    const m = /matrix\(([^)]+)\)/.exec(pre0.transform0)
    return m ? parseFloat(m[1].split(',')[0]) : 1
  })()
  const endScale = (() => {
    const m = /matrix\(([^)]+)\)/.exec(lastDeckMorph)
    return m ? parseFloat(m[1].split(',')[0]) : lastDeckMorph === 'none' ? 1 : 0
  })()
  check('起飞前：整页退场启动', exitSeen && pre0.blocks >= 5, `blocks=${pre0.blocks} exitSeen=${exitSeen}`)
  check('起飞前：退场是错峰级联（不是同时消失）', cascade > 0.2, `opacity 极差峰值=${cascade.toFixed(2)}`)
  check(
    '起飞前：取景已变形到目的地（离场前 img 尺度回到 1）',
    Math.abs(startScale - endScale) > 0.1 && Math.abs(endScale - 1) < 0.02,
    `起手 scale=${startScale.toFixed(3)} → 离场前 ${endScale.toFixed(3)}（末次 transform=${lastDeckMorph || 'n/a'}）`,
  )

  // 7. 修饰键（⌘/Ctrl 点击「新标签打开」）：必须放行、不接管、不做编排
  // ⚠ 不能直接 `link.dispatchEvent(click)` 就走：合成事件**没有**「新标签」语义，
  //   浏览器会真的导航当前帧 → 后续 evaluate 全部撞上「context destroyed」（实测踩过）。
  //   改在 window 冒泡阶段读 `defaultPrevented`（此刻我们的捕获处理器已跑完）并自己兜住默认动作。
  await home()
  const mod = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const link = document.querySelector('[data-vt-shared]')
        const img = document.querySelector('[data-vt-shared] img')
        const before = img ? getComputedStyle(img).transform : ''
        const onBubble = (e) => {
          window.removeEventListener('click', onBubble)
          e.preventDefault() // 审计自己兜住默认导航：这一项测的是"我们有没有接管"
          resolve({
            defaultPrevented: e.defaultPrevented,
            exit: document.documentElement.classList.contains('vt-exit'),
            outs: document.querySelectorAll('.vt-out').length,
            morphBefore: before,
          })
        }
        window.addEventListener('click', onBubble)
        link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, metaKey: true }))
      }),
  )
  // 判据只看**可观察的接管征兆**：没有整页退场、没有区块入列、取景没被改。
  // 不去断言 defaultPrevented：浏览器对 ⌘-点击本身也会置位（打开新标签），读它会把
  // 「放行」误判成「被拦」（实测）。
  check(
    '修饰键点击放行（不接管、不编排）',
    !mod.exit && mod.outs === 0,
    JSON.stringify(mod),
  )

  // 8. 中途改主意：编排进行中点了别的链接 —— 用户的新去向必须赢，且不留任何标记
  await home()
  await page.evaluate(() => document.querySelector('[data-vt-shared]').click())
  await page.waitForTimeout(120)
  await page.evaluate(() => {
    const a = [...document.querySelectorAll('a')].find((x) => x.getAttribute('href') === '/agents')
    a?.click()
  })
  await page.waitForTimeout(1800)
  const interrupt = await page.evaluate(() => ({
    path: location.pathname,
    exit: document.documentElement.classList.contains('vt-exit'),
    restore: document.documentElement.classList.contains('vt-restore'),
    outs: document.querySelectorAll('.vt-out').length,
    ins: document.querySelectorAll('.vt-in').length,
  }))
  check(
    '中途改主意：新去向优先且标记撤净',
    interrupt.path === '/agents' &&
      !interrupt.exit &&
      !interrupt.restore &&
      interrupt.outs === 0 &&
      interrupt.ins === 0,
    JSON.stringify(interrupt),
  )

  return {
    total,
    failed: failedItems.length,
    failedItems,
    detail: {
      direct: { frames: direct.frames.length, delta: direct.delta },
      switched: { frames: switched.frames.length, delta: switched.delta, href: switched.href },
      back,
      preflight: { ...pre0, exitSeen, cascade, lastDeckMorph, startScale, endScale },
      modifiedClick: mod,
      interrupt,
    },
  }
}
