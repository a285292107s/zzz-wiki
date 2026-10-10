/* ============================================================
 * viewTransition/config — 共享元素过渡的路由判据与落定等待（纯逻辑，可单测）
 *
 * 只有一个过渡对：首页「今日角色」卡 ↔ 代理人详情页头图（两块同用
 * Mindscape_{id}_2.webp，故共享元素是**同一个画面**在两次转场里换个框，不是两张图对切）。
 * 其余导航（名录 ↔ 详情、同类目详情之间、任何别的路由）一律不参与：
 * 判据收在这里，运行时（./index.ts）与视图（FeaturedDeck/AgentHead）读同一份，
 * 免得路由改名时一半生效一半静默失效。
 * ============================================================ */

import { catalogEntry } from '@/domain/catalog'
import type { RouteLocationNormalized } from 'vue-router'

/** 起飞端路由名（首页） */
export const HOME_ROUTE_NAME = 'home'

/** 降落端路由名：`{类目}-detail` 的代理人一支 */
export const AGENT_DETAIL_ROUTE_NAME = 'agents-detail'

/** 「今日角色」卡的目标路径（详情路由 `‹path›/:id` 的前缀） */
export function deckTargetPath(): string {
  // catalog 缺条目会让路由表构造先抛错；这里再兜一层，只为让判据不做非空断言
  return catalogEntry('/agents')?.path ?? '/agents'
}

/** 详情 id 与卡下标一致（FeaturedDeck 的 `to` 由卡片自己的 id 拼出） */
export function isAgentDetailOf(to: RouteLocationNormalized, id: string | number): boolean {
  return to.name === AGENT_DETAIL_ROUTE_NAME && String(to.params.id ?? '') === String(id)
}

/** 起飞：首页 → 该代理人详情（点卡进详情） */
export function isDeckToAgentDetail(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
): boolean {
  return (
    from.name === HOME_ROUTE_NAME &&
    to.name === AGENT_DETAIL_ROUTE_NAME &&
    to.path.startsWith(`${deckTargetPath()}/`)
  )
}

/** 降落：该代理人详情 → 首页（返回时同一张卡接住画面） */
export function isAgentDetailToDeck(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
): boolean {
  return (
    from.name === AGENT_DETAIL_ROUTE_NAME &&
    to.name === HOME_ROUTE_NAME &&
    from.path.startsWith(`${deckTargetPath()}/`)
  )
}

/** 过渡期间的根标记：兼作「本帧禁用 Vue 页面过渡」的开关（见 App.vue / base.css）。
 *  **在起飞前就挂上**，故它也会进旧状态的快照 —— 只放「两端都该生效」的规则（页面过渡让位）。 */
export const VT_ROOT_CLASS = 'vt-active'

/** 降落标记：在更新回调里、**新状态采样之前**挂上 —— 于是只作用于目的页那一端，
 *  旧状态（起飞端）不受影响。组件用它把文字层挡在新快照之外（飞行里只留画）。 */
export const VT_LANDING_CLASS = 'vt-landing'

/** 落地标记：**采样之后**才挂上（挂早了会把编排动画一起拍进新状态）。
 *  组件用它做「文字层在飞行落地前后逐条就位」的编排，见 base.css 的 vt-chrome-in。 */
export const VT_LANDED_CLASS = 'vt-landed'

/** 起飞标记：整页区块依次退场（标记由 chrome 收集器写在区块上，见 base.css 的 vt-chrome-out） */
export const VT_EXIT_CLASS = 'vt-exit'

/** 中断回滚标记：退场演到一半被取消时，把区块按同一份错峰索引放回去 */
export const VT_RESTORE_CLASS = 'vt-restore'

/** 共享元素名（两个方向共用）：首页挂在活动卡的 .deck-item、详情挂在 .hero-bg。
 *  两端都是**画的可视裁切容器**（各自 overflow: hidden，快照=可见画面）。
 *  名字只在 `startViewTransition` 采样期间起作用，常驻声明安全；
 *  但同一时刻同名元素必须唯一，四张卡都挂会让整个过渡被浏览器跳过。 */
export const VT_SHARED_NAME = 'deck-frame'

/** 共享元素端点的 DOM 标记（两端各挂一个**不同的值**）：过渡的运行时要找到
 *  **新状态那端的画**并等它可绘制（否则新快照是空画布 —— 实测的「中段黑场」）。
 *
 *  值必须区分两端：新旧两页都有这个标记，只按属性选择器找会命中**还在场上的旧页**
 *  —— 于是「等新页的画」在旧页上立刻满足、回调提前放行，新状态采样到的还是旧页面，
 *  两端几何完全相同、飞行冻在起飞盒（实测：连续点刻度后点卡，约一半概率退化成硬切）。
 *  与 VT_SHARED_NAME 分开：名字是浏览器读的，标记是我们读的。 */
export const VT_SHARED_ATTR = 'data-vt-shared'

/** 标记的取值：牌堆端（首页）/ 头图端（详情页） */
export type VtEnd = 'deck' | 'hero'

/** 起飞端不在视口里时的根标记：值即**该端点**（'deck' / 'hero'）。
 *  名字只在 `startViewTransition` 采样期间起作用，故起飞前挂、收尾即撤。
 *
 *  为什么需要它：浏览器把带名元素**在文档里的盒子**直接映射到视口坐标，不看它在不在屏幕上。
 *  详情页滚到底部时 `.hero-bg` 位于视口上方约 9800px（1440×900 实测），飞行 91% 的路程
 *  发生在屏幕外、按时间算 67% 的画面完全不可见 —— 观感就是「一张画从视口上缘凭空滑进来」。
 *  摘掉起飞端的名字之后不再生成 `::view-transition-group(deck-frame)`，也就没有几何插值，
 *  只剩落点那张画的一次淡入 + 根交叉溶解（见 base.css 的本标记规则）。 */
export const VT_NO_FLIGHT_ATTR = 'data-vt-no-flight'

/** 起飞端至少要露出自身高度的这个比例才值得飞。
 *
 *  判据的语义是「**基本看不见**」，不是「没看全」——取值被实测的两条约束夹住：
 *   · **上限（别误伤）**：常见视口的比例下界是 0.19（320×568 的牌堆只露一角）、
 *     0.40（844×390 横屏牌堆贴顶边）、0.48（844×390 详情页头图）。这些位置上人正看着那张画，
 *     取 0.25 以上会把它们**永久**判成不飞：横屏牌堆高达 968px、视口仅 390px，
 *     任何阈值 > 0.5 都等于把横屏的去程飞行整个关掉。
 *   · **下限（必须拦住）**：起飞端完全滚出视口（比例 0）时，飞行有 39%–91% 的路程在屏幕外
 *     （详情页滚到底：头图在视口上方 9650px，91% 的路程、按时间算 67% 的画面完全不可见）
 *     —— 那正是「一张画从视口上缘凭空滑进来」。
 *  0.1 卡在「只露一角」（0.19）之下：**只有基本看不见才降级**，全部常见视口照飞。 */
export const FLIGHT_MIN_VISIBLE_RATIO = 0.1

/** 量测所需的最小矩形（只用 top/bottom/height）：不带 DOM 依赖，node 环境可单测 */
export interface ViewportRect {
  top: number
  bottom: number
  height: number
}

/** 矩形在视口里露出的高度占自身高度的比例（0–1）。
 *  量不出来（无矩形 / 零高 / 视口高为 0）记 0，不做除法。 */
export function visibleRatio(rect: ViewportRect | null | undefined, viewportHeight: number): number {
  if (!rect || viewportHeight <= 0 || rect.height <= 0) return 0
  const visible = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0)
  return Math.max(0, Math.min(1, visible / rect.height))
}

/** 起飞端还够不够看得见（共享元素过渡要不要真的飞）。
 *
 *  **量不出来时按「飞」处理**：元素缺失 / 无 DOM 环境一律放行。宁可多飞一次，也不要因为
 *  一次量测失败就把正常飞行静默关掉 —— 那正是本站 2026-10 那次「静默空转」（vt-active 挂着、
 *  两端几何完全相同、观感即硬切）同类的事故形态。 */
export function flightSourceVisible(end: VtEnd): boolean {
  if (typeof document === 'undefined') return true
  const el = document.querySelector(`[${VT_SHARED_ATTR}="${end}"]`)
  if (!el) return true
  return visibleRatio(el.getBoundingClientRect(), window.innerHeight) >= FLIGHT_MIN_VISIBLE_RATIO
}

/** 起飞登记：本次从牌堆点开的是哪张卡（回程时首页牌堆据此把同一张画接回原位）。
 *  模块级一格足够：一次导航只可能有一个起飞端，且消费方（牌堆挂载）立即取走。 */
let deckCardId: number | null = null

/** 登记起飞卡（首页 → 代理人详情时由路由守卫调用） */
export function rememberDeckCard(id: number): void {
  deckCardId = Number.isFinite(id) ? id : null
}

/** 取走登记值并清空（首页牌堆挂载时调用一次：取到就落在那张卡上，取不到就是第 1 张） */
export function consumeDeckCard(): number | null {
  const v = deckCardId
  deckCardId = null
  return v
}

/** 原生支持（模块加载时判定一次）。供视图层决定「要不要真的发共享元素名」：
 *  不支持的浏览器忽略该属性也无害，但发出来的内联样式是死值，不如不发。 */
export const VT_SUPPORTED = typeof document !== 'undefined' && 'startViewTransition' in document

/** 新状态落定的等待上限（ms）：超时也放行，过渡照常播，只是没等到理想状态。 */
export const NAV_SETTLE_MS = 1200
/** 共享元素的画可绘制的等待上限（ms）：比 NAV_SETTLE 短 —— 宁可让旧画面的停留短一点 */
export const SHARED_READY_MS = 600
/** 起飞前预热降落端头图的等待上限（ms）：只争取「请求已发出并多半已从缓存命中」 */
export const LANDING_PREWARM_MS = 220

/** 轮询等一个条件成立（带上限）：**超时不是错误**，两个消费方（等导航落定、等图画好）
 *  都必须无论如何放行，否则一次失败的导航会把过渡永远挂在 `vt-active` 上。 */
export function waitUntil(
  predicate: () => boolean,
  timeoutMs: number,
  intervalMs = 8,
): Promise<void> {
  if (predicate()) return Promise.resolve()
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs
    const tick = (): void => {
      if (predicate() || Date.now() >= deadline) {
        resolve()
        return
      }
      setTimeout(tick, intervalMs)
    }
    setTimeout(tick, intervalMs)
  })
}

/**
 * 等**新状态那端的共享元素**就位并可绘制：查 `[data-vt-shared="<end>"] img`。
 *
 * 两件事必须都等到，缺一就会退化成一次空转/黑场：
 *   · 元素本身出现 —— 新旧两页都有这个标记，只等「有没有 img」会命中旧页（见 VT_SHARED_ATTR）
 *   · img 可绘制   —— 导航期新页头图才刚开始下载，采样到空画布就是一段黑场
 * 元素不存在/没有 img（候选链耗尽时 HollowImage 整块隐藏）到点放行，不阻塞采样。
 */
export async function awaitSharedEndImage(end: VtEnd, timeoutMs = SHARED_READY_MS): Promise<void> {
  if (typeof document === 'undefined') return
  // 用容器对象包一层：闭包里赋值 + 闭包外读取，直接写 `let img` 会被 TS 收窄成 never
  const found: { el: HTMLImageElement | null } = { el: null }
  await waitUntil(() => {
    found.el = document.querySelector<HTMLImageElement>(`[${VT_SHARED_ATTR}="${end}"] img`)
    return found.el != null && found.el.complete && found.el.naturalWidth > 0
  }, timeoutMs)
  const img = found.el
  if (!img) return
  if (typeof img.decode !== 'function') return
  try {
    await img.decode()
  } catch {
    /* 候选链耗尽 / 已中止：交给 HollowImage 的兜底，不阻塞采样 */
  }
}

/** 等某一端登上舞台（新状态采样前用）：路由落定 ≠ 视图已挂载，
 *  `mode="out-in"` 还会让新视图等旧视图离场 —— 只等路由会把旧页面拍成「新状态」。 */
export function waitSharedEndMounted(end: VtEnd, timeoutMs = NAV_SETTLE_MS): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve()
  return waitUntil(() => document.querySelector(`[${VT_SHARED_ATTR}="${end}"]`) != null, timeoutMs)
}

/**
 * 等「本次更新的 DOM 落定」：让出一个微任务批次后调用 onSettled。
 *
 * **必须是微任务/定时器级别的让出，不能用 requestAnimationFrame**：
 * 浏览器在跑更新回调期间会暂停渲染循环（实测 Chrome：回调里 rAF 整整 4s 不派发，
 * 直到 Chrome 自己的「DOM update timed out」把过渡判废），拿 rAF 等「一帧」会死锁。
 *
 * 一个宏任务批次就够：Vue 的过渡类（enter-from）在 patch 的同一微任务里加上、
 * 同一批里摘掉；快照在回调结束后才拍，此刻类已摘、DOM 已落定。
 * 图片（同 URL，来自缓存）解码上屏是并行的事，不阻塞快照——它照常出现在新状态里。
 */
export function settleAfterPaint(onSettled: () => void): void {
  setTimeout(onSettled, 0)
}
