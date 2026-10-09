/* ============================================================
 * viewTransition/chrome — 起飞前的「整页退场」与降落后的「整页入场」
 *
 * 为什么是**显式标记**而不是自动切分：自动判据（"看着像一块"）在真页面上会把站头拆成
 * 六个标签、把 hero 那排 meta 拆成带点的碎块 —— 实测两页都收到上限件、详情页覆盖率还只有
 * 53%（主内容都没轮到）。编排粒度是**艺术决定**，不该由几何猜：需要退场/入场的区块由组件
 * 用 `data-vt-block` 自己声明，本模块只负责「按视觉顺序编号 + 标记 + 清理」，
 * 并用覆盖率与不嵌套两条性质在测试/审计里守住（漏标一个新区块会被断言抓到）。
 *
 * 三条硬规则（都踩过坑）：
 *   1. **共享元素永不被收集**：`data-vt-skip` 挂在牌堆那张画 / 详情头图上，
 *      含它的祖先记作「装裱壳」（只退边线/底色，不碰子树）—— 退场不能把主角一起淡掉。
 *   2. **只收视口内的区块**：快照只覆盖视口，视口外的区块编排了也没人看见，
 *      收进来只会白涨错峰时长与合成层数量。
 *   3. **常驻外壳（`data-vt-hold`）永不进计划**：站头/站尾跨路由不重建，若让它们退出场、
 *      再被入场藏起，飞行期间两层快照里都是缺的 —— 观感是"整块丢了一下"。标记为 hold 的
 *      子树在原位原样存在（两层快照一致 → 根交叉溶解叠上去等于不变）。
 *   4. **导航只淡不位移（`data-vt-fade`）**：它们仍在计划里（与内容同节奏进出），
 *      但 CSS 侧换成只动 opacity 的关键帧 —— 导航家具跟着上浮会被读成"位置跳了一下"。
 *
 * 时序常量（`VT_TIMING`）是 CSS 与 JS 的**单一来源**：本模块把 `--vt-*` 写到 html 上，
 * JS 侧按同一组数字算出「该等多久」，避免两边各写一份时长然后漂移。
 * ============================================================ */

/** 共享元素（或任何不该参与编排的节点）上的排除标记 */
export const CHROME_SKIP_ATTR = 'data-vt-skip'

/** 常驻外壳标记：跨路由不重建的终端框架（站头/站尾），永不退场、永不入场 */
export const CHROME_HOLD_ATTR = 'data-vt-hold'

/** 只淡不位移标记：导航类区块（详情页「返回」、区块索引）——
 *  它们参与编排（与内容同节奏地淡入淡出），但**不做位移**：导航家具跟着上浮 12px
 *  会被读成"位置跳了一下"（实测 1440 冷加载：nav 的 rect 213 → 201，且入场用强 ease-out，
 *  12px 里 ~70% 挤在头 100ms）。CSS 侧用同名选择器换关键帧，本模块只认它"仍在计划里"。 */
export const CHROME_FADE_ATTR = 'data-vt-fade'

/** 区块声明：组件用它在自己的可视单元上声明「这是一块，按整块退场/入场」 */
export const BLOCK_ATTR = 'data-vt-block'

/** 退场区块标记（起飞端） */
export const CHROME_OUT_CLASS = 'vt-out'
/** 入场区块标记（降落端） */
export const CHROME_IN_CLASS = 'vt-in'
/** 含共享元素的祖先：只退边线/底色 */
export const CHROME_CASE_CLASS = 'vt-chrome-case'
/** 错峰索引的自定义属性（退场与入场共用一份编号） */
export const CHROME_INDEX_PROP = '--vt-i'

/** 单次编排最多收集多少块：再多就要拿合成层数量与错峰总时长去换，不划算 */
const MAX_BLOCKS = 26

/**
 * 编排时序（ms）。写进 html 的 CSS 变量供样式读，JS 侧按同一组数字等落定。
 * 退场总时长 = outDur + outStep × (块数 − 1)：整页「自上而下依次收走」。
 * 入场整体延后 inHold —— 太早会在飞行快照背后白跑完，落地就没有「逐步入场」了。
 */
export const VT_TIMING = {
  /** 退场：每块 200ms + 每块错峰 20ms（12 块 ≈ 420ms）。
   *  错峰要**读得出来**（6ms 级的小步长在 60fps 下几乎同时发生，等于没有编排），
   *  但也不能拖成"漫长清空"——它和取景变形是**同一拍**，两者必须同时结束（见 exitSettleMs）。 */
  outDur: 200,
  outStep: 20,
  inDur: 320,
  inStep: 18,
  /** 入场整体延后到飞行尾段：太早会在飞行快照背后白跑完、落地就没有「逐步入场」；
   *  调飞行时长时要回来对一眼 —— 飞行 460ms + 延后 300ms ⇒ 落地时首块约 50%、末块刚开始，
   *  于是「落地即有形、余下续入」。 */
  inHold: 300,
  /** 取景变形时长的**兜底值**：起飞前编排会按实际区块数把它提到与退场同长
   *  （见 armDeckFlight 写 --vt-morph），保证"画一直在动，直到起跳"。 */
  morph: 300,
} as const

/** 把时序写到 html 上（CSS 读 var(--vt-*)），返回本次编排该等多久（含一档余量） */
export function applyTimingVars(root: HTMLElement = document.documentElement): void {
  const t = VT_TIMING
  root.style.setProperty('--vt-out-dur', `${t.outDur}ms`)
  root.style.setProperty('--vt-out-step', `${t.outStep}ms`)
  root.style.setProperty('--vt-in-dur', `${t.inDur}ms`)
  root.style.setProperty('--vt-in-step', `${t.inStep}ms`)
  root.style.setProperty('--vt-in-hold', `${t.inHold}ms`)
  root.style.setProperty('--vt-morph', `${t.morph}ms`)
}

/** 退场错峰走完所需时长（起飞前编排按它决定起跳时刻，并让取景变形与之同步收尾） */
export function exitCascadeMs(blocks: number, step: number = VT_TIMING.outStep): number {
  return VT_TIMING.outDur + step * Math.max(0, blocks - 1)
}

/** 起飞前编排的**总时长上限**：区块再多也不把准备期拖长 —— 超出就压小错峰步长。
 *  没有它时，16 块的页面准备期会到 500ms+（观感是"清空得很久，然后才飞"）。 */
export const EXIT_CASCADE_CAP_MS = 420

/** 按区块数求出本次退场实际可用的错峰步长（≤ VT_TIMING.outStep，且不短于 8ms 保住可读性） */
export function exitStepFor(blocks: number): number {
  const room = EXIT_CASCADE_CAP_MS - VT_TIMING.outDur
  const n = Math.max(1, blocks - 1)
  return Math.max(8, Math.min(VT_TIMING.outStep, Math.round(room / n)))
}

/** 起飞前编排该等多久：错峰走完 + 一档余量。
 *  **不再与 morph 取 max** —— 变形时长会被 armDeckFlight 提到与错峰同长，
 *  于是"最后一笔动画"与起跳之间只剩这点余量，消掉此前实测的 ~140ms 死档。 */
export function exitSettleMs(blocks: number, step: number = VT_TIMING.outStep): number {
  return exitCascadeMs(blocks, step) + 40
}

/** 入场编排走完所需时长（从落地标记挂上算起） */
export function enterSettleMs(blocks: number): number {
  return VT_TIMING.inHold + VT_TIMING.inDur + VT_TIMING.inStep * Math.max(0, blocks - 1) + 80
}

export interface ChromePlan {
  /** 逐条退场/入场的可视区块（已按视觉顺序编号） */
  blocks: HTMLElement[]
  /** 含共享元素的容器：只退边线/底色，子树（含共享元素）不动 */
  cases: HTMLElement[]
}

function isVisible(el: HTMLElement): boolean {
  const cs = getComputedStyle(el)
  if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return false
  // opacity 取空值（环境不支持计算样式时）按可见处理：Number('') === 0 会把整页判成不可见
  if (cs.opacity && Number(cs.opacity) === 0) return false
  return el.getClientRects().length > 0
}

/** 视口相交：只编排「看得见的那一屏」 */
function inViewport(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect()
  return r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth
}

function coversSharedElement(el: HTMLElement): boolean {
  return el.matches(`[${CHROME_SKIP_ATTR}]`) || el.querySelector(`[${CHROME_SKIP_ATTR}]`) != null
}

/** 常驻外壳（站头/站尾这类跨路由不重建的终端框架）——**永不参与编排**：
 *  它们不退出场、不被入场藏起，于是两层快照里都以原样在原位存在，
 *  根交叉溶解叠上去等于不变（观感：终端不动，只有页面内容在换）。
 *  与 `data-vt-skip` 的区别：skip 是"这块让位给装裱壳（边线动、内容不动）"，
 *  hold 是"这块根本不进计划"。 */
function isHeld(el: HTMLElement): boolean {
  return el.matches(`[${CHROME_HOLD_ATTR}]`) || el.closest(`[${CHROME_HOLD_ATTR}]`) != null
}

/**
 * 收集一份编排计划：只认声明（`data-vt-block`），按视觉顺序编号。
 *   · 声明嵌套时**只收最内层**（近端优先，避免同一个位置被淡两次）
 *   · 含共享元素的声明整块让位给「装裱壳」
 *   · 常驻外壳（`data-vt-hold`）整棵子树跳过
 *   · 装裱壳 = 共享元素的所有祖先（去重；CSS 只动边线/底色，嵌套无害）
 */
export function collectChrome(root: ParentNode = document.body): ChromePlan {
  const declared = Array.from(root.querySelectorAll<HTMLElement>(`[${BLOCK_ATTR}]`))
  const blocks: HTMLElement[] = []

  for (const el of declared) {
    if (blocks.length >= MAX_BLOCKS) break
    if (isHeld(el) || coversSharedElement(el)) continue
    if (!isVisible(el) || !inViewport(el)) continue
    // 别的声明块在它里面 → 它在结构上是容器，交给内层各自入列
    if (declared.some((d) => d !== el && el.contains(d))) continue
    blocks.push(el)
  }

  const cases = new Set<HTMLElement>()
  for (const skip of Array.from(root.querySelectorAll<HTMLElement>(`[${CHROME_SKIP_ATTR}]`))) {
    let p = skip.parentElement
    while (p && p !== document.documentElement) {
      // 装裱壳也不碰常驻外壳：否则会去动站头的边线/底色
      if (!isHeld(p)) cases.add(p)
      p = p.parentElement
    }
  }

  // 视觉顺序：自上而下、自左而右 —— 错峰读起来才是「从上往下依次收走」
  blocks.sort((a, b) => {
    const ra = a.getBoundingClientRect()
    const rb = b.getBoundingClientRect()
    return ra.top - rb.top || ra.left - rb.left
  })
  return { blocks, cases: Array.from(cases) }
}

/** 给区块写错峰索引与阶段标记（`out` = 起飞端退场，`in` = 降落端入场） */
export function stampChrome(plan: ChromePlan, phase: 'out' | 'in'): void {
  const cls = phase === 'out' ? CHROME_OUT_CLASS : CHROME_IN_CLASS
  plan.blocks.forEach((el, i) => {
    el.classList.add(cls)
    el.style.setProperty(CHROME_INDEX_PROP, String(i))
  })
  for (const el of plan.cases) el.classList.add(CHROME_CASE_CLASS)
}

/** 擦掉某一阶段的痕迹（正常收尾与中断回滚共用；两阶段分开擦，互不误伤） */
export function clearChrome(phase: 'out' | 'in', root: ParentNode = document.body): void {
  const cls = phase === 'out' ? CHROME_OUT_CLASS : CHROME_IN_CLASS
  for (const el of Array.from(root.querySelectorAll<HTMLElement>(`.${cls}`))) {
    el.classList.remove(cls)
    // `--vt-i` 只属于一个阶段，另一阶段还可能在用；两阶段都摘掉才算干净
    if (!el.classList.contains(CHROME_OUT_CLASS) && !el.classList.contains(CHROME_IN_CLASS)) {
      el.style.removeProperty(CHROME_INDEX_PROP)
    }
  }
}

/** 擦掉装裱壳标记：只在一趟编排**彻底结束**（或整段撤销）时调用 ——
 *  它同时服务退场与入场两侧的边框/底色，早擦会让后一段编排失去壳的动作。 */
export function clearChromeCases(root: ParentNode = document.body): void {
  for (const el of Array.from(root.querySelectorAll<HTMLElement>(`.${CHROME_CASE_CLASS}`))) {
    el.classList.remove(CHROME_CASE_CLASS)
  }
}
