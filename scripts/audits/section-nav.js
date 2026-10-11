async (page) => {
  /* ============================================================
   * section-nav 审计——窄屏吸顶横条的「出口提示」契约
   *
   * 为什么单独立项：这块的失败模式全是**静默**的。按钮位置对、颜色对、
   * 点下去也不报错，但只要 .at-start / .at-end 认错一次，提示就会在
   * 「还有内容」时消失、或在「没有内容」时赖着不走——两种都是凭肉眼
   * 一眼看不出、却让导航失去可信度的错。故逐状态断言。
   * ============================================================ */
  const routes = ['/agents/1541', '/formulas']
  const problems = []

  /* 显式复位媒体模拟：浏览器 profile 跨脚本复用，上一个脚本留下的
     forced-colors / reduced-motion 会让本脚本读到完全不同的渲染结果
     （实测踩过：一次 HCM 探针之后，横条在全套审计里被判「无淡出蒙版」）。
     审计必须自己钉死前提，不能信环境。 */
  await page.emulateMedia({ forcedColors: 'none', reducedMotion: 'no-preference', media: null })

  /* 确定性等待，不用固定 timeout：详情页的横条要等数据到达才渲染
     （v-if="nav?.length"），冷缓存 + 全套审计连跑时 1500ms 会读到一个还没挂上的
     页面，于是判「找不到 .section-nav .sn-list」——单跑能过、全套里挂，
     正是竞态。README 的规矩：偶发失败要查竞态或改确定性等待，不能靠重跑蒙过去。
     等两件事：结构在位 + 字体已加载（行高/宽度这类测量依赖字体度量）。 */
  async function waitForNav(timeout = 20000) {
    const deadline = Date.now() + timeout
    for (;;) {
      const ok = await page.evaluate(async () => {
        if (!document.querySelector('.section-nav .sn-list')) return false
        if (document.fonts && document.fonts.status !== 'loaded') return false
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
        return true
      })
      if (ok) return true
      if (Date.now() > deadline) return false
      await page.waitForTimeout(200)
    }
  }

  for (const route of routes) {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('http://localhost:4175' + route, { waitUntil: 'networkidle' })
    const ready = await waitForNav()
    if (!ready)
      problems.push({ route, issue: '等到超时也没等到 .section-nav .sn-list（页面没起来或结构契约变了）' })

    const present = await page.$('.section-nav .sn-list')
    if (!present) {
      problems.push({ route, issue: '找不到 .section-nav .sn-list（结构契约变了）' })
      continue
    }

    const read = () =>
      page.evaluate(() => {
        const nav = document.querySelector('.section-nav')
        const list = document.querySelector('.sn-list')
        const btn = document.querySelector('.sn-scroll-btn')
        const active = document.querySelector('.sn-child.active') || document.querySelector('.sn-item.active')
        const lb = list.getBoundingClientRect()
        const nb = nav.getBoundingClientRect()
        const bb = btn ? btn.getBoundingClientRect() : null
        const cs = getComputedStyle(list)
        const bcs = btn ? getComputedStyle(btn) : null
        const visible = (el) =>
          !!el && (() => {
            const r = el.getBoundingClientRect()
            return r.right > lb.left + 1 && r.left < lb.right - 1
          })()
        /* 右端淡出蒙版的「全透明尾窗」宽度 vs 按钮宽度。
           条目盒**必然**与按钮矩形相交（内容一直滑到右缘），故几何相交不是问题；
           真正的不变量是「按钮底下的那一带已经被渐隐到全透明」——否则白字压在
           雪佛龙上，就回到原先那个方块压住「03 基础属…」的观感。 */
        const tailPx = parseFloat(cs.getPropertyValue('--sn-tail-r')) || 0
        const rampPx = parseFloat(cs.getPropertyValue('--sn-ramp-r')) || 0
        return {
          cls: list.className,
          scrollable: list.classList.contains('scrollable'),
          atStart: list.classList.contains('at-start'),
          atEnd: list.classList.contains('at-end'),
          scrollLeft: Math.round(list.scrollLeft),
          max: Math.round(list.scrollWidth - list.clientWidth),
          btnDisplay: bcs ? bcs.display : 'none',
          btnVis: bcs ? bcs.visibility : 'hidden',
          btnW: bb ? Math.round(bb.width) : 0,
          btnH: bb ? Math.round(bb.height) : 0,
          btnInView: bb ? bb.right <= innerWidth + 1 && bb.left >= -1 : false,
          tailPx,
          rampPx,
          navH: Math.round(nb.height),
          mask: (cs.maskImage || cs.webkitMaskImage || 'none').slice(0, 40),
          activeText: active ? active.textContent.trim().replace(/\s+/g, '') : null,
          activeVisible: visible(active),
          // 首屏/末屏都不能有横向溢出
          docOverflow: document.documentElement.scrollWidth > innerWidth + 1,
        }
      })

    const start = await read()

    /* **正向**断言优先：几何上真的放不下（scrollWidth > clientWidth）就必须被判定为可横滑。
       只写「若 scrollable 则…」会让整段在结构回归时被整体跳过——例如位置类又挂回外层
       .section-nav、或 ref 挂错元素，此时 scrollable 恒为假，所有子断言静默跳过，
       **旧构建也能全绿**。这条就是那次假绿的成因，故必须由几何反推状态，不信状态类。 */
    const geo = await page.evaluate(() => {
      const l = document.querySelector('.sn-list')
      const r = l.getBoundingClientRect()
      return { scrollW: l.scrollWidth, clientW: l.clientWidth, boxW: Math.round(r.width), boxH: Math.round(r.height) }
    })
    const trulyOverflows = geo.scrollW > geo.clientW + 1
    if (geo.clientW === 0 || geo.boxH === 0)
      problems.push({ route, issue: '.sn-list 没有盒（多半 display:contents 之类的旧结构尚未重构）', geo })
    else if (!trulyOverflows)
      problems.push({ route, issue: '本页横条未超宽（导航项太少的 route 会让审计失去意义，需换路由）', geo })
    if (trulyOverflows && !start.scrollable)
      problems.push({ route, issue: '轨道实际超宽，却没被标为 .scrollable（结构/引用点回归）' })

    if (start.scrollable) {
      if (!start.atStart) problems.push({ route, issue: '可横滑但起点未标 .at-start', cls: start.cls })
      if (start.atEnd) problems.push({ route, issue: '起点即被标为 .at-end（提示会错误消失）' })
      if (start.btnDisplay === 'none') problems.push({ route, issue: '可横滑但出口按钮未显示' })
      if (start.btnVis === 'hidden') problems.push({ route, issue: '起点出口按钮不可见' })
      if (start.btnW < 24 || start.btnH < 24)
        problems.push({ route, issue: '出口按钮命中区不足 24×24', w: start.btnW, h: start.btnH })
      if (!start.btnInView) problems.push({ route, issue: '出口按钮超出视口' })
      // 按钮底下必须是**已渐隐到全透明**的一带：尾窗宽度不得小于按钮宽度
      if (!/gradient/.test(start.mask)) problems.push({ route, issue: '可横滑但两端无淡出蒙版' })
      else if (start.tailPx + 1 < start.btnW)
        problems.push({
          route,
          issue: '出口按钮底下未渐隐到全透明（文字会压在雪佛龙上）',
          tailPx: start.tailPx,
          btnW: start.btnW,
        })
    }
    if (start.docOverflow) problems.push({ route, issue: '文档出现横向溢出' })

    // 中段：点一次出口按钮，按钮必须仍在（没到边）
    if (start.scrollable) {
      await page.click('.sn-scroll-btn')
      await page.waitForTimeout(900)
      const mid = await read()
      if (mid.atStart) problems.push({ route, issue: '点过出口按钮后仍标 .at-start' })
      if (mid.scrollLeft <= start.scrollLeft) problems.push({ route, issue: '出口按钮点击后未向右滚动', from: start.scrollLeft, to: mid.scrollLeft })
      if (mid.atEnd && mid.btnVis === 'visible') problems.push({ route, issue: '.at-end 时按钮仍可见（应撤下）' })

      // 末段：滚到底，按钮必须撤下且退出无障碍树
      await page.evaluate(() => {
        const l = document.querySelector('.sn-list')
        l.scrollLeft = l.scrollWidth
      })
      await page.waitForTimeout(800)
      const end = await read()
      if (!end.atEnd) problems.push({ route, issue: '滚到底未标 .at-end' })
      if (end.btnVis === 'visible')
        problems.push({ route, issue: '到底后出口按钮仍留在无障碍树（键盘会停在看不见的按钮上）' })
      /* 到底后右端两段蒙版都应收到 0：留着的话末尾几个字会被平白削淡，
         而那时右侧根本没有内容可提示。（mask-image 本身始终是 gradient，
         变的只是宽度，故要断言宽度而不是「有没有 gradient」。） */
      if (end.tailPx > 0 || end.rampPx > 0)
        problems.push({ route, issue: '到底后右端淡出未撤（末尾文字被无故削掉）', tailPx: end.tailPx, rampPx: end.rampPx })
      if (end.atStart) problems.push({ route, issue: '已滚到底却仍标 .at-start' })
    }

    // 页面滚动换段：横条内的当前项必须被带进视野
    await page.evaluate(() => {
      const l = document.querySelector('.sn-list')
      if (l) l.scrollLeft = 0
      window.scrollTo(0, 0)
    })
    await page.waitForTimeout(400)
    const before = await read()
    await page.evaluate(() => window.scrollTo(0, Math.round(document.documentElement.scrollHeight * 0.62)))
    await page.waitForTimeout(1800)
    const after = await read()
    if (after.scrollable && after.activeText && after.activeText !== before.activeText && !after.activeVisible)
      problems.push({ route, issue: '页面滚动换了当前区块，但它没被带进横条视野', active: after.activeText })
  }

  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('http://localhost:4175/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const wide = await page.evaluate(() => {
    const btn = document.querySelector('.sn-scroll-btn')
    return { btnDisplay: btn ? getComputedStyle(btn).display : 'absent' }
  })
  if (wide.btnDisplay !== 'none' && wide.btnDisplay !== 'absent')
    problems.push({ route: '(宽屏)', issue: '宽屏侧栏模式下出口按钮仍渲染', display: wide.btnDisplay })

  /* 高对比度：HCM 用户要看清每个字，故两端蒙版必须撤掉；
     但撤掉后文字会压到雪佛龙上，所以出口按钮必须有不透明实底把文字挡开。
     两条是一对——只做前者（本脚本首版即如此）会让雪佛龙叠在「基础属性」上。 */
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:4175/agents/1541', { waitUntil: 'networkidle' })
  await waitForNav()
  await page.emulateMedia({ forcedColors: 'active' })
  await page.waitForTimeout(600)
  const hc = await page.evaluate(() => {
    const list = document.querySelector('.sn-list')
    const btn = document.querySelector('.sn-scroll-btn')
    /* 拿不到结构就**报出来**，不要在这里抛：run-code 的回调里抛异常会把整个
       playwright-cli 会话打掉，后续审计全变成「Command failed」——
       一处探针的健壮性缺口会伪装成整套审计崩溃（实测踩过）。 */
    if (!list || !btn) return { missing: { list: !list, btn: !btn } }
    const chev = btn.querySelector('svg')
    if (!chev) return { missing: { chevron: true }, btnHTML: btn.outerHTML.slice(0, 160) }
    const cs = getComputedStyle(list)
    const bcs = getComputedStyle(btn)
    const cb = chev.getBoundingClientRect()
    const lb = list.getBoundingClientRect()
    // 有文字矩形横跨雪佛龙左缘，且按钮实底不透明时，文字会被挡开
    let crossing = 0
    for (const el of document.querySelectorAll('.sn-item, .sn-child')) {
      const r = el.getBoundingClientRect()
      if (r.right <= lb.left || r.left >= lb.right) continue
      if (r.left < cb.left && r.right > cb.left) crossing++
    }
    const alpha = (() => {
      const m = /rgba?\(([^)]+)\)/.exec(bcs.backgroundColor)
      if (!m) return 1
      const parts = m[1].split(',').map((s) => s.trim())
      return parts.length > 3 ? parseFloat(parts[3]) : 1
    })()
    return {
      mask: cs.maskImage === 'none' && cs.webkitMaskImage === 'none',
      bgAlpha: alpha,
      bg: bcs.backgroundColor,
      borderW: parseFloat(bcs.borderInlineStartWidth || bcs.borderLeftWidth) || 0,
      crossing,
      chevronVisible: cb.width > 0 && cb.height > 0,
    }
  })
  if (hc && hc.missing) {
    problems.push({ route: '(HCM)', issue: '高对比度块拿不到横条结构', missing: hc.missing, btnHTML: hc.btnHTML })
  } else if (hc) {
    if (!hc.mask) problems.push({ route: '(HCM)', issue: '高对比度下两端蒙版未撤（文字被渐隐掉）', mask: hc.mask })
    if (!hc.chevronVisible) problems.push({ route: '(HCM)', issue: '高对比度下雪佛龙不可见' })
    if (hc.crossing > 0 && hc.bgAlpha < 1)
      problems.push({
        route: '(HCM)',
        issue: '高对比度下文字压在雪佛龙上（出口按钮缺不透明实底）',
        crossing: hc.crossing,
        bg: hc.bg,
      })
  }
  await page.emulateMedia({ forcedColors: 'none' })

  return JSON.stringify({ routesChecked: routes.length, problems }, null, 1)
}
