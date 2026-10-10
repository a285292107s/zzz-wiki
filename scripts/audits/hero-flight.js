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
 *   6. 起飞前编排：退场启动且错峰、取景在起飞前变形到目的地
 *      —— 第 6 项的变形量是 |zoom − 1|，故采样前会先切到「四卡里 zoom 偏离 1 最大」的那张：
 *      首卡 zoom≈1 时「已变形」与「没变形」不可区分，属采样前提不成立（详见第 6 节注释）。
 *   7. 起飞端不在屏上时**不飞**（第 9/10 项）：详情页滚到底部再返回，头图位于视口上方
 *      近万像素，飞行 91% 的路程在屏幕外、67% 的时间画面完全不可见 —— 观感是「一张画从
 *      视口上缘凭空滑进来」。故此时只做页面交叉溶解、不做几何飞行。
 *      **这一项是被上一条漏掉的**：原脚本只测「首页顶部点卡」与「先换卡再点」，
 *      恰好都在起飞端完整可见的位置，所以那套「从屏外飞进来」一直绿着通过。
 *      第 9 项测「滚到底不飞」，第 10 项反向测「滚 300px（头图仍过半可见）照常飞」，
 *      防止门槛把正常路径一起关掉。
 *   8. 起飞前取景变形**只在宽屏做**（第 11 项）：窄屏（≤860）详情头图复用同一份
 *      pos/zoom/originY，目的地取景本就等于卡片自己的取景 —— 变形到中性态反而把画推离
 *      目的地，交接口凭空多出 1/zoom ≈ 1.295× 的纵向错位（正是它本要消除的那个「换个大小」）。
 *   9. **装裱壳不得给透明包装层凭空涂色**（第 12/13 项）：`.vt-chrome-case` 是按「共享元素的
 *      所有祖先」标记的（首页 13 层，一路到 body），其中多数本身完全透明。若 `vt-case-*`
 *      关键帧把起点/终点写死成 --bg-0，这些层会被涂上一层整页底色 —— `.home` 一被涂就盖住
 *      固定层的拼贴壁纸、`#app` 一被涂就盖住 body::before 的页面壁纸，退场淡出、落地又淡入，
 *      观感是「飞行前后背景闪了好几下」（实测 4 次跳变：点卡瞬间 / 退场淡出 / 落地淡入 / 摘类）。
 *      第 12 项查「包装层是否被涂」，第 13 项反向查「真正带框的壳仍在退色」（别把壳一起关掉）。
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

  /** transform 矩阵 → { x, y }（伪元素几何一律是 matrix/无） */
  const parseT = (t) => {
    const m = /matrix\(([^)]+)\)/.exec(t ?? '')
    if (!m) return { x: 0, y: 0 }
    const p = m[1].split(',').map((v) => parseFloat(v.trim()))
    return { x: p[4] ?? 0, y: p[5] ?? 0 }
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
    const landing = await page.evaluate(() => {
      const r = document.querySelector('.hero-bg')?.getBoundingClientRect()
      return r ? { w: Math.round(r.width), h: Math.round(r.height) } : null
    })
    // 「结束后不留 vt 标记」要**等标记真的落定**，不能用固定延时：
    // 落地编排的起点是「新状态采样之后」，而采样要等详情 JSON 到位 —— 数据慢时整段编排会整体后移，
    // 固定 2600ms 会读在编排中途（实测偶发 landed:true，与实现无关的采样竞态）。
    // 判据仍是「最终撤净」，只是把「最终」定义成确定性条件：三个标记全空，上限 8s。
    await page
      .waitForFunction(
        () => {
          const r = document.documentElement
          return (
            !r.classList.contains('vt-active') &&
            !r.classList.contains('vt-landing') &&
            !r.classList.contains('vt-landed')
          )
        },
        null,
        { timeout: 8000 },
      )
      .catch(() => undefined) // 超时不算错误：下面照常读一次，由断言给出结论
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

  // —— 采样前提：把活动卡换到「取景明显偏离 1」的那一张 ——
  // 本项判据是「变形在起飞前落定」，而变形量 = |zoom − 1|（zoom 来自 featured-pool.json）。
  // 活动卡恰好 zoom≈1 时，「已变形到 1」与「从未变形」在几何上**不可区分** ——
  // 那是采样前提不成立，不该报成实现失败。池内 zoom 跨 1.05–1.49，
  // 实测 730 天里有 30 天（4.1%）首卡落在 zoom≤1.08（1201 / 1511 / 1611），
  // 这一项于是会**按日期偶发误报**（2026-01-17 即其一，首卡 1201 的 zoom=1.05）。
  // 四张卡的 <img> 都在 DOM 里且各带自己的 scale，故直接读、挑偏离最大的一张来采样：
  // 实测每天至少有一张 |zoom−1| > 0.1（730/730），采样因此变成确定性的。
  const zoomPick = await page.evaluate(() => {
    const scaleOf = (img) => {
      const t = img ? getComputedStyle(img).transform : ''
      const m = /matrix\(([^)]+)\)/.exec(t)
      return m ? parseFloat(m[1].split(',')[0]) : 1
    }
    const slides = Array.from(document.querySelectorAll('.deck-slide'))
    const scales = slides.map((s) => scaleOf(s.querySelector('img')))
    let best = 0
    for (let i = 1; i < scales.length; i++) {
      if (Math.abs(scales[i] - 1) > Math.abs(scales[best] - 1)) best = i
    }
    return {
      scales,
      best,
      active: slides.findIndex((s) => s.querySelector('[data-vt-shared]')),
    }
  })
  if (zoomPick.best !== zoomPick.active) {
    await page.locator('.deck-tick').nth(zoomPick.best).click()
    await page.waitForTimeout(500)
  }

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
    `起手 scale=${startScale.toFixed(3)} → 离场前 ${endScale.toFixed(3)}（末次 transform=${lastDeckMorph || 'n/a'}）` +
      ` · 采样卡 #${zoomPick.best + 1}，四卡 zoom=[${zoomPick.scales.map((s) => s.toFixed(3)).join(', ')}]`,
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

  // 9/10. 起飞端不在屏上：不飞（只换页）—— 用户报的「从页面最上方飞下来」
  // ⚠ 判据一律用**逐帧几何**，不看有没有动画类：摘名之后 ::view-transition-group(deck-frame)
  //   仍会被读到几何（值恒等于落点盒），只看「有没有 animation」分不出来（同文件头的教训）。
  // ⚠ 采样必须**每次一个独立 evaluate**（同第 6 节）：这段时间里会发生一次导航，
  //   把整段循环塞进一个 evaluate 会撞上「Execution context was destroyed」（实测踩过）。
  /** 从详情页的指定滚动位置返回首页，采飞行几何。
   *  `scroll: 'max'` = 滚到底（头图完全在视口上方）；数字 = 指定 scrollY。 */
  const returnFrom = async (label, scroll) => {
    await page.goto(`${ORIGIN}${switched.href}`, { waitUntil: 'load' })
    // 先等正文长到全高（详情 JSON 到位），**再**等 hero 挂上：
    // 骨架态既没有 .hero-bg，页面也只有 ~2600px —— 此时「滚到底」滚不出头图之外（实测）
    await page.waitForFunction(() => document.documentElement.scrollHeight > 6000, null, { timeout: 15000 })
    await page.waitForSelector('[data-vt-shared="hero"]')
    await page.waitForTimeout(600)

    const start = await page.evaluate((sc) => {
      window.scrollTo({ top: 0, behavior: 'instant' })
      const max = document.documentElement.scrollHeight
      window.scrollTo({ top: sc === 'max' ? max : Math.min(sc, max), behavior: 'instant' })
      const r = document.querySelector('.hero-bg').getBoundingClientRect()
      const visible = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0))
      return {
        scrollY: Math.round(window.scrollY),
        docH: max,
        heroVTop: Math.round(r.top),
        heroVisibleRatio: +(visible / r.height).toFixed(2),
      }
    }, scroll)
    await page.waitForTimeout(300)
    await page.addStyleTag({ content: SLOW_CSS })

    // 起跳 + 分步采样（绝不把循环塞进一个 evaluate）
    await page.evaluate(() => {
      const home = [...document.querySelectorAll('header a')].find((a) => a.getAttribute('href') === '/')
      home.click()
    })
    const frames = []
    for (let i = 0; i < 90; i++) {
      await page.waitForTimeout(40)
      try {
        frames.push(
          await page.evaluate(() => {
            const root = document.documentElement
            const g = getComputedStyle(root, '::view-transition-group(deck-frame)')
            return {
              w: parseFloat(g.width) || 0,
              h: parseFloat(g.height) || 0,
              t: g.transform,
              noFlight: root.getAttribute('data-vt-no-flight') || '',
              vt: root.classList.contains('vt-active'),
              path: location.pathname,
            }
          }),
        )
      } catch {
        // 导航落定的那一帧上下文会被换掉：跳过这一帧，不影响判据（几何来自伪元素）
      }
    }

    // 同第 1 项：等三个标记真的撤净（确定性条件），不用固定延时
    await page
      .waitForFunction(
        () => {
          const r = document.documentElement
          return (
            !r.classList.contains('vt-active') &&
            !r.classList.contains('vt-landing') &&
            !r.classList.contains('vt-landed')
          )
        },
        null,
        { timeout: 8000 },
      )
      .catch(() => undefined)
    const after = await page.evaluate(() => ({
      path: location.pathname,
      scrollY: Math.round(window.scrollY),
      vt: document.documentElement.classList.contains('vt-active'),
      landing: document.documentElement.classList.contains('vt-landing'),
      landed: document.documentElement.classList.contains('vt-landed'),
      noFlight: document.documentElement.hasAttribute('data-vt-no-flight'),
    }))

    const geo = frames.filter((f) => f.w).map((f) => ({ ...f, ...parseT(f.t) }))
    const delta = geo.length
      ? {
          dw: Math.round(Math.abs(geo[0].w - geo.at(-1).w)),
          dh: Math.round(Math.abs(geo[0].h - geo.at(-1).h)),
          dy: Math.round(Math.abs(geo[0].y - geo.at(-1).y)),
        }
      : null
    const invisible = geo.filter((f) => f.y + f.h <= 0).length
    return {
      label,
      start,
      frames: geo.length,
      first: geo[0] ? { w: Math.round(geo[0].w), h: Math.round(geo[0].h), y: Math.round(geo[0].y) } : null,
      delta,
      invisibleShare: geo.length ? +(invisible / geo.length).toFixed(2) : null,
      noFlightDuringFlight: [...new Set(frames.map((f) => f.noFlight))],
      vtActive: frames.some((f) => f.vt),
      after,
    }
  }

  // 9. 滚到底返回：头图完全不可见 → 不该有几何飞行
  const fromBottom = await returnFrom('I滚到底返回', 'max')
  check(
    'I·滚到底：起飞端确实不可见（采样前提成立）',
    fromBottom.start.heroVisibleRatio === 0,
    JSON.stringify(fromBottom.start),
  )
  check(
    'I·滚到底：不做几何飞行（起飞盒≈落点盒，无「从屏外飞入」）',
    !!fromBottom.delta && Math.max(fromBottom.delta.dw, fromBottom.delta.dh, fromBottom.delta.dy) <= TOL,
    `delta=${JSON.stringify(fromBottom.delta)} 阈值 ${TOL}px 首帧=${JSON.stringify(fromBottom.first)}`,
  )
  check(
    'I·滚到底：全程没有画面停在视口外',
    fromBottom.invisibleShare === 0,
    `视口外帧占比=${fromBottom.invisibleShare}`,
  )
  check(
    'I·滚到底：降级期间挂对了标记，收尾撤净',
    fromBottom.noFlightDuringFlight.includes('hero') && !fromBottom.after.noFlight,
    `飞行中标记=${JSON.stringify(fromBottom.noFlightDuringFlight)} 收尾=${JSON.stringify(fromBottom.after)}`,
  )
  check(
    'I·滚到底：仍是共享元素过渡（vt-active 起过、结束后不留标记）',
    fromBottom.vtActive && !fromBottom.after.vt && !fromBottom.after.landing && !fromBottom.after.landed,
    JSON.stringify(fromBottom.after),
  )

  // 10. 反向：起飞端仍看得见时**必须照常飞**（门槛别误伤正常路径）
  const fromShallow = await returnFrom('J滚300返回', 300)
  check(
    'J·滚 300px：起飞端仍看得见（采样前提成立）',
    fromShallow.start.heroVisibleRatio > 0.1,
    JSON.stringify(fromShallow.start),
  )
  check(
    'J·滚 300px：照常有几何飞行（门槛没有误伤正常路径）',
    !!fromShallow.delta && Math.max(fromShallow.delta.dw, fromShallow.delta.dh, fromShallow.delta.dy) > TOL,
    `delta=${JSON.stringify(fromShallow.delta)} 首帧=${JSON.stringify(fromShallow.first)}`,
  )
  check(
    'J·滚 300px：没有挂降级标记',
    !fromShallow.noFlightDuringFlight.some((v) => v !== ''),
    `飞行中标记=${JSON.stringify(fromShallow.noFlightDuringFlight)}`,
  )
  check('J·滚 300px：返回到了首页', fromShallow.after.path === '/', fromShallow.after.path)

  // 11. 起飞前取景变形只在宽屏做（窄屏做了反而错位）
  // 判据：窄屏点卡后，起飞端那张画的 scale 应**保持该图校准值**（不是 1）；
  //      且交接那一刻它与目的地那张画的尺度比 ≈ 1（无错位）。
  // 采样前提：该卡 zoom 必须明显偏离 1，否则「保持校准」与「已变形到 1」不可区分
  // （同第 6 节的采样前提说明）。
  const savedViewport = page.viewportSize()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${ORIGIN}/`, { waitUntil: 'load' })
  await page.waitForSelector('[data-vt-shared="deck"] img')
  await page.waitForTimeout(900)

  // 挑 zoom 偏离 1 最大的一张（与第 6 节同一套理由）
  const narrowPick = await page.evaluate(() => {
    const scaleOf = (img) => {
      const t = img ? getComputedStyle(img).transform : ''
      const m = /matrix\(([^)]+)\)/.exec(t)
      return m ? parseFloat(m[1].split(',')[0]) : 1
    }
    const slides = Array.from(document.querySelectorAll('.deck-slide'))
    const scales = slides.map((s) => scaleOf(s.querySelector('img')))
    let best = 0
    for (let i = 1; i < scales.length; i++) {
      if (Math.abs(scales[i] - 1) > Math.abs(scales[best] - 1)) best = i
    }
    return { scales, best, active: slides.findIndex((s) => s.querySelector('[data-vt-shared]')) }
  })
  if (narrowPick.best !== narrowPick.active) {
    await page.evaluate((i) => document.querySelectorAll('.deck-tick')[i]?.click(), narrowPick.best)
    await page.waitForTimeout(500)
  }
  const narrowBefore = await page.evaluate(() => {
    const img = document.querySelector('[data-vt-shared="deck"] img')
    return img ? getComputedStyle(img).transform : ''
  })
  await page.evaluate(() => document.querySelector('[data-vt-shared="deck"]').click())
  const narrowSamples = []
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(40)
    try {
      narrowSamples.push(
        await page.evaluate(() => {
          const img = document.querySelector('[data-vt-shared="deck"] img')
          return img ? getComputedStyle(img).transform : ''
        }),
      )
    } catch {
      /* 导航那一帧 */
    }
  }
  await page.waitForTimeout(2000)
  const narrowAfter = await page.evaluate(() => {
    const img = document.querySelector('[data-vt-shared="hero"] img')
    return { transform: img ? getComputedStyle(img).transform : '', path: location.pathname }
  })
  if (savedViewport) await page.setViewportSize(savedViewport)

  const scaleOfMatrix = (t) => {
    const m = /matrix\(([^)]+)\)/.exec(t ?? '')
    return m ? parseFloat(m[1].split(',')[0]) : t === 'none' ? 1 : null
  }
  const nScale0 = scaleOfMatrix(narrowBefore)
  // 起飞端最后一次可见的 scale（进快照那一刻）
  const nTakeoff = [...narrowSamples].reverse().map(scaleOfMatrix).find((v) => v != null) ?? null
  const nDest = scaleOfMatrix(narrowAfter.transform)
  // 只认确实是「窄屏那张卡」的采样：scale 仍等于该卡校准值（未变形成 1）
  check(
    'K·窄屏：采样前提成立（该卡 zoom 明显偏离 1）',
    nScale0 != null && Math.abs(nScale0 - 1) > 0.1,
    `四卡 zoom=[${narrowPick.scales.map((s) => s.toFixed(3)).join(', ')}] 采样卡 #${narrowPick.best + 1} 起手 scale=${nScale0?.toFixed(3)}`,
  )
  check(
    'K·窄屏：起飞前**不做**取景变形（画保持自己的校准 zoom，而非降到 1）',
    nTakeoff != null && Math.abs(nTakeoff - 1) > 0.1,
    `起手 ${nScale0?.toFixed(3)} → 离场前 ${nTakeoff?.toFixed(3)}（窄屏若变形会变成 1.000）`,
  )
  check(
    'K·窄屏：交接处无尺度错位（起飞端与目的地同尺度）',
    nTakeoff != null && nDest != null && Math.abs(nTakeoff / nDest - 1) < 0.02,
    `起飞端 ${nTakeoff?.toFixed(3)} / 目的地 ${nDest?.toFixed(3)} = ${nTakeoff && nDest ? (nTakeoff / nDest).toFixed(4) : 'n/a'}`,
  )
  check('K·窄屏：照常飞到详情页', /^\/agents\/\d+$/.test(narrowAfter.path), narrowAfter.path)

  // 12/13. 装裱壳不得给「透明包装层」凭空涂色（否则整页壁纸被盖住又淡回 = 背景闪几下）
  // 采样：点卡后逐帧读「本身透明」的包装层是否被涂上底色；同时确认真正带框的壳仍在退色。
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${ORIGIN}/`, { waitUntil: 'load' })
  await page.waitForSelector('[data-vt-shared="deck"]')
  await page.waitForTimeout(1100)

  const caseSample = () =>
    page.evaluate(() => {
      const alphaOf = (sel) => {
        const el = document.querySelector(sel)
        if (!el) return null
        const m = /rgba?\(([^)]+)\)/.exec(getComputedStyle(el).backgroundColor)
        const p = m ? m[1].split(',').map((v) => parseFloat(v.trim())) : []
        return p.length === 4 ? p[3] : p.length ? 1 : 0
      }
      // 本身完全透明的包装层（实测：首页这五层的自然 alpha 恒为 0）
      const WRAPPERS = ['#app', '.shell', '#main', '.home', '.eb-root']
      // 真正带框的壳：牌堆装裱框（自然带 1px 边线 + 不透明底色）
      const FRAME = '.deck-frame'
      const root = document.documentElement
      return {
        phase: `${root.classList.contains('vt-exit') ? 'E' : '-'}${root.classList.contains('vt-landed') ? 'D' : '-'}`,
        painted: WRAPPERS.map((s) => [s, alphaOf(s)]).filter(([, a]) => a != null && a > 0.01),
        frameAlpha: alphaOf(FRAME),
        caseCount: document.querySelectorAll('.vt-chrome-case').length,
      }
    })

  const caseFrames = []
  await page.evaluate(() => document.querySelector('[data-vt-shared="deck"]').click())
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(25)
    try {
      caseFrames.push(await caseSample())
    } catch {
      /* 导航那一帧 */
    }
  }
  await page.waitForTimeout(1500)
  // 落地相：返回首页再看一遍（这一趟的入场编排由 beforeresolve 的落地分支负责）
  await page.goto(`${ORIGIN}/`, { waitUntil: 'load' })
  await page.waitForSelector('[data-vt-shared="deck"]')
  await page.waitForTimeout(900)
  await page.evaluate(() => {
    const a = [...document.querySelectorAll('a')].find((x) => x.getAttribute('href')?.startsWith('/agents/'))
    a?.click()
  })
  await page.waitForTimeout(1800)
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(25)
    try {
      caseFrames.push(await caseSample())
    } catch {
      /* ignore */
    }
  }

  const paintedFrames = caseFrames.filter((f) => f.painted.length > 0)
  const maxPainted = paintedFrames.reduce((m, f) => Math.max(m, f.painted.length), 0)
  // 真正带框的壳：起飞端退场期间它的底色应被退到近乎透明（说明壳还在工作）
  const frameFaded = caseFrames.some((f) => f.phase.startsWith('E') && f.frameAlpha != null && f.frameAlpha < 0.5)

  check(
    'L·装裱壳不给透明包装层凭空涂色（否则整页壁纸被盖住 = 背景闪）',
    maxPainted === 0,
    `被涂帧数=${paintedFrames.length}/${caseFrames.length}，单帧最多 ${maxPainted} 层` +
      (paintedFrames[0] ? ` 例：${JSON.stringify(paintedFrames[0])}` : ''),
  )
  check(
    'M·反向：真正带框的装裱壳仍在退色（壳没被一起关掉）',
    frameFaded,
    `退场期 .deck-frame 底色最低值=${Math.min(...caseFrames.filter((f) => f.phase.startsWith('E') && f.frameAlpha != null).map((f) => f.frameAlpha), 1)}`,
  )

  return {
    total,
    failed: failedItems.length,
    failedItems,
    detail: {
      direct: { frames: direct.frames.length, delta: direct.delta },
      switched: { frames: switched.frames.length, delta: switched.delta, href: switched.href },
      back,
      preflight: { ...pre0, exitSeen, cascade, lastDeckMorph, startScale, endScale, zoomPick },
      modifiedClick: mod,
      interrupt,
      fromBottom,
      fromShallow,
      narrow: { pick: narrowPick, before: nScale0, takeoff: nTakeoff, dest: nDest, path: narrowAfter.path },
      casePaint: { paintedFrames: paintedFrames.length, maxPainted, frameFaded },
    },
  }
}
