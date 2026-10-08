/* ============================================================
 * viewTransition — 首页「今日角色」卡 → 代理人详情页头图的共享元素过渡
 *
 * 与 flutter Hero 同构：`view-transition-name` 即 tag，两端同名即合并成一次飞行。
 * 浏览器负责起飞/飞行/降落（旧状态截图 → DOM 更新 → 新状态截图 → 在
 * `::view-transition-*` 伪元素上插值），本文件只负责**谈判时机**：
 *
 *   1. 靠 vue-router 的 beforeResolve 起跳，用**双向闸门**卡住导航（本文件最反直觉的一处）：
 *      浏览器在「下一次渲染时机」才拍旧状态，然后才跑更新回调；而 vue-router 的 DOM 更新
 *      发生在微任务里，永远早于那次渲染时机 —— 直接放行导航就会**拍到已经切完的画面**，
 *      两端几何完全相同，退化成一次看不见的交叉溶解（实测：采样到的 group 盒从一开始就是
 *      落点尺寸 1168×413，整段飞行没有位移）。
 *      故守卫起跳后 **await「更新回调已开始」**：那一刻旧状态已进快照，守卫这才放行导航，
 *      回调里再等导航落定 → DOM 更新 → 新状态采样。顺序反过来就是空转。
 *   2. 更新回调按序等四件事：**放行导航 → 路由落定 → Vue patch 完一帧 → 共享元素的画可绘制**。
 *      最后一项是「飞行看得见」的前提：详情页 hero 与首页卡片是同一张 Mindscape 的
 *      不同派生档（地址不同、缓存不共享），不等它就是一次空画布的采样——表现为中段黑场。
 *      每一步都有上限（NAV_SETTLE_MS / SHARED_READY_MS），超时照样放行，绝不把过渡挂死。
 *   3. 只认首页 ↔ 代理人详情这一对（判据见 ./config），并顺带登记起飞卡：
 *      回程时首页牌堆据此落回同一张卡（否则 A 的画会飞进 B 的框里）。
 *   4. 没有 `startViewTransition`（Firefox < 144 等）、或用户要求减少动效时，
 *      整条路径不动：导航与页面过渡完全退回原样。
 *
 * 共享元素是**画的可视裁切容器**：首页活动卡的 .deck-item（<a>，自身 overflow hidden，
 * 裁掉 zoom 出界的部分）与详情页的 .hero-bg（自身 overflow hidden）。不是 <img> 本体——
 * <img> 带 zoom 校准的 transform，渲染盒比可视区域大 1.28×，而带名元素的快照不含祖先
 * 裁切，直接挂会起飞在一圈放大的画面上。也不是装裱框：它与详情头图尺寸接近（814×345 vs
 * 1178×395），挂框只会让整块面板向上挪一下——这是最初「看不出 hero 效果」的原因。
 * ============================================================ */

import { computed, nextTick, ref, type Ref } from 'vue'
import type { Router } from 'vue-router'
import { heroVariantFile } from '@/data/heroGenderVariants'
import { awaitImageReady, heroDetailPrimarySrc, heroDetailViewport } from '@/data/heroImageSources'
import { heroForm } from '@/composables/useHeroForm'
import {
  applyTimingVars,
  clearChrome,
  clearChromeCases,
  collectChrome,
  enterSettleMs,
  exitSettleMs,
  stampChrome,
} from './chrome'
import {
  LANDING_PREWARM_MS,
  NAV_SETTLE_MS,
  VT_EXIT_CLASS,
  VT_LANDED_CLASS,
  VT_LANDING_CLASS,
  VT_RESTORE_CLASS,
  VT_ROOT_CLASS,
  VT_SUPPORTED,
  awaitSharedEndImage,
  isAgentDetailToDeck,
  isDeckToAgentDetail,
  rememberDeckCard,
  settleAfterPaint,
  waitSharedEndMounted,
  waitUntil,
  type VtEnd,
} from './config'

export {
  VT_EXIT_CLASS,
  VT_LANDED_CLASS,
  VT_LANDING_CLASS,
  VT_ROOT_CLASS,
  VT_SHARED_ATTR,
  VT_SHARED_NAME,
  VT_SUPPORTED,
  consumeDeckCard,
} from './config'
export { isAgentDetailOf } from './config'
export { BLOCK_ATTR, CHROME_SKIP_ATTR, VT_TIMING } from './chrome'

let installed = false
/** 安装时收下的 router：组件侧（牌堆）不自己注入 router，少一处「测试环境没有 router」的依赖 */
let appRouter: Router | null = null
/** 起飞前编排是否在途（整页退场 + 取景变形）。做成 ref：组件据此回滚自己的取景变形 */
const armed = ref(false)
/** 本次编排准备飞去的目的地：**别的**导航一旦开始就撤销编排（用户改主意优先） */
let armedTarget: string | null = null
/** 飞行中的过渡：重叠导航并到同一次上，而不是再开一次 */
let inFlight: Promise<void> | null = null
/** 去程起飞端（首页牌堆）：本次导航是首页 → 代理人详情时为 true */
const deckIsSource = ref(false)
/** 回程降落端（首页牌堆）：本次导航是代理人详情 → 首页时为 true。
 *  只服务 App.vue 的页面过渡让位（过渡期间两种方向都要让位）。 */
const deckIsSink = ref(false)

/**
 * 过渡进行中：App.vue 据此停用 Vue 的页面过渡（`.page-*` 的 out-in 会把新视图的
 * DOM 更新压后，浏览器就拍不到新画面）。
 *
 * 注意**不是**用来控制共享元素名的：那个名字只在 `startViewTransition` 采样期间起作用，
 * 两端都可以常驻声明（两端的元素各在自己的页面上，不会并存）。
 * 曾按「本次谁起飞」条件挂名，结果降落端没名、配不成组，反向根本不飞。
 */
export function useViewTransition(): { active: Ref<boolean> } {
  const active = computed(() => deckIsSource.value || deckIsSink.value)
  return { active }
}

/**
 * 起飞前把**降落端的头图**烘进缓存：详情页 hero 与首页卡片不同档位，缓存不共享。
 * 只等 LANDING_PREWARM_MS（触屏路径没有 hover 预热，否则要白等一整张原图）；
 * 超时不是失败——更新回调里还有一次有上限的等待兜着。
 *
 * 返回同一个 promise 交给更新回调：预热与采样前的等待共用一次请求，不重复发。
 */
function prewarmLandingHero(id: string | number | undefined): Promise<void> {
  const numeric = Number(id)
  if (!Number.isFinite(numeric)) return Promise.resolve()
  const base = heroVariantFile(numeric, heroForm.value) ?? `Mindscape_${numeric}_2`
  return awaitImageReady(heroDetailPrimarySrc(base, heroDetailViewport()), LANDING_PREWARM_MS)
}

/**
 * 起飞前编排（首页点卡时由 FeaturedDeck 调用）：整页区块依次退场，同时那张画在原地
 * 把取景变形到目的地（组件侧做，纯 transform）——**两者都落定**才允许起跳，
 * 于是旧状态快照里只剩底纹与那张已经「就位」的画。
 *
 * `target` 是本次编排准备飞去的路径：**用户中途改主意（点了别的链接）就整段撤销** ——
 * 否则编排落定后的那一跳会盖掉用户后来点的那一次导航（实测确实会）。
 *
 * 返回三种结果（调用方据此决定要不要补一次导航）：
 *   · `ready`       —— 编排落定，可以起跳
 *   · `cancelled`   —— 中途被撤销（用户点了别处）：**不要再导航**，否则会盖掉用户的新去向
 *   · `unavailable` —— 根本没起编排（不支持 / 减少动效 / 没声明区块）：点击得自己补导航
 */
export type ArmResult = 'ready' | 'cancelled' | 'unavailable'

export async function armDeckFlight(target: string): Promise<ArmResult> {
  if (!VT_SUPPORTED || reducedMotion() || armed.value) return 'unavailable'
  applyTimingVars()
  const plan = collectChrome()
  if (!plan.blocks.length) return 'unavailable' // 一个区块都没声明：无从编排，别改页面状态
  stampChrome(plan, 'out')
  armed.value = true
  armedTarget = target
  document.documentElement.classList.add(VT_EXIT_CLASS)
  await wait(exitSettleMs(plan.blocks.length))
  return armed.value ? 'ready' : 'cancelled'
}

/** 中断回滚：撤退场标记，把整页区块按同一份错峰索引放回去（不是「啪」地复位） */
export function disarmDeckFlight(): void {
  const root = document.documentElement
  if (!armed.value && !root.classList.contains(VT_EXIT_CLASS)) return
  armed.value = false
  armedTarget = null
  root.classList.remove(VT_EXIT_CLASS)
  root.classList.add(VT_RESTORE_CLASS)
  window.setTimeout(() => {
    root.classList.remove(VT_RESTORE_CLASS)
    clearChrome('out')
    clearChromeCases()
  }, 420)
}

/** 起飞前编排是否在途（响应式：牌堆 watch 它，撤销时把取景变形平滑回常态） */
export function deckFlightArmed(): Ref<boolean> {
  return armed
}

/** 现在能不能起编排（同步判定，供点击入口决定要不要接管这次点击）：
 *  不支持 View Transitions / 用户要减少动效 / 已在编排中 —— 三种情况一律放行走普通导航。 */
export function canArmDeckFlight(): boolean {
  return VT_SUPPORTED && !reducedMotion() && !armed.value && appRouter != null
}

/** 编排落定后的那一跳（router 由 installViewTransition 收着，见上） */
export async function deckNavigate(to: string): Promise<void> {
  await appRouter?.push(to)
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * 直接进入详情页（没有共享元素过渡，例如从名录点进、深链直达）时的一次性入场：
 * 与「降落编排」**同一套词汇**（`.vt-in` + `--vt-i` 错峰 + `vt-landed`），
 * 只是由视图在首屏内容就绪后自己触发 —— 于是三种进入方式的观感一致：
 *   深链直达 / 名录点进 = 骨架 → 逐条入场
 *   首页点卡            = 退场 → 变形 → 飞行 → 逐条入场
 *
 * 正在飞行（`vt-landing` 已挂）或已有过渡在途时直接返回：那一趟由降落编排负责入场。
 */
export function playLandingEntrance(): void {
  if (!VT_SUPPORTED || reducedMotion()) return
  const root = document.documentElement
  if (root.classList.contains(VT_LANDING_CLASS) || inFlight) return
  applyTimingVars()
  const plan = collectChrome()
  if (!plan.blocks.length) return
  stampChrome(plan, 'in')
  root.classList.add(VT_LANDING_CLASS) // 先「藏」（只作用于本帧）
  // 让出一个宏任务再切到「入场」：同一批样式更新里初始态与动画 from 会一起到达，等于没入场
  window.setTimeout(() => {
    root.classList.remove(VT_LANDING_CLASS)
    root.classList.add(VT_LANDED_CLASS)
    window.setTimeout(() => {
      root.classList.remove(VT_LANDED_CLASS)
      clearChrome('in')
      clearChromeCases()
    }, enterSettleMs(plan.blocks.length))
  }, 0)
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

/** 开一次飞行。已有飞行在途时返回 null（并进那一次）。 */
function beginFlight(
  router: Router,
  targetFullPath: string,
  /** 本次**降落端**是哪个端点（去程 = 详情头图、回程 = 牌堆）：等它出现、等它的画可绘制 */
  landingEnd: VtEnd,
  landingReady: Promise<void>,
): { callbackStarted: Promise<void>; wait: Promise<void>; finish: () => Promise<void> } | null {
  if (inFlight) return null

  const doc = document as Document & {
    startViewTransition?: (cb: () => void | Promise<void>) => {
      ready: Promise<void>
      updateCallbackDone: Promise<void>
      finished: Promise<void>
    }
  }
  if (!doc.startViewTransition) return null

  // 根类只做一件事：让 Vue 的页面过渡给共享元素让位（`.page-*` 的 out-in 会把新视图的
  // DOM 更新压后，浏览器就拍不到新画面）。共享元素名由两端组件常驻声明，不在这里挂。
  document.documentElement.classList.add(VT_ROOT_CLASS)

  let markStarted: (() => void) | undefined
  const callbackStarted = new Promise<void>((resolve) => {
    markStarted = resolve
  })
  /** 降落端收集到的区块数（落地编排要走多久由它决定，见 enterSettleMs） */
  let landingBlocks = 0

  const started = doc.startViewTransition(async () => {
    // ① 旧状态此刻已进快照 —— 放行守卫里等着的导航（顺序错了就是整段空转，见文件头）
    markStarted?.()
    // ② 等这次导航真正落到目标路由（懒 chunk / 详情 JSON 可能还在飞）
    await waitUntil(() => router.currentRoute.value.fullPath === targetFullPath, NAV_SETTLE_MS)
    // ③ 等**降落端真的挂上舞台**：路由落定 ≠ 视图已挂载（`mode="out-in"` 要等旧视图离场），
    //    只等路由就会把还在场上的旧页面拍成「新状态」——两端几何相同，飞行冻在起飞盒
    await waitSharedEndMounted(landingEnd)
    await nextTick()
    // ④ 跨路由常驻的 chrome（站头/站尾这类不在 RouterView 里的元素）不会随导航重建：
    //    它们的**退场态在这里交棒给入场编排** —— 先撤退场痕迹（旧的已进快照，安全），
    //    再按新页收集一次，于是它们在新快照里同样是「不可见」，落地后才逐条入场。
    //    不交棒的话，它们会带着退场态飞完全程，落地那一刻「啪」地出现。
    clearChrome('out')
    document.documentElement.classList.remove(VT_EXIT_CLASS)
    const plan = collectChrome()
    stampChrome(plan, 'in')
    landingBlocks = plan.blocks.length
    document.documentElement.classList.add(VT_LANDING_CLASS)
    // ⑤ 等那一端的画可绘制：预热已先行，这里只收尾（空画布的采样就是一次黑场）
    await Promise.race([landingReady, awaitSharedEndImage(landingEnd)])
    // ⑥ 再让出一个宏任务批次：Vue 的过渡类与内联样式已落定，浏览器这才采样新状态
    await new Promise<void>((resolve) => settleAfterPaint(resolve))
  })

  // ready/updateCallbackDone 在「无可过渡内容」时也会 reject，必须各接一手，
  // 否则悬着的 rejected promise 会在控制台留一条未处理告警
  const bestEffort = (p: Promise<void>): Promise<void> => p.catch(() => undefined)
  const wait = bestEffort(started.finished)
  inFlight = wait

  // 落地编排：**新状态已采样之后**才挂落地类（挂早了会被拍进快照、编排就不存在了）。
  // 用一个宏任务保证「采样已发生」：采样与回调结算在同一个渲染更新里，
  // 定时器回调必然排在它之后。目的页区块于是按同一份错峰索引逐条装订。
  // 时长按块数算（与 CSS 同一组 --vt-* 常量），走完即摘标记、交还常态样式。
  void bestEffort(started.updateCallbackDone).then(() => {
    window.setTimeout(() => {
      document.documentElement.classList.add(VT_LANDED_CLASS)
      window.setTimeout(
        () => {
          document.documentElement.classList.remove(VT_LANDED_CLASS)
          clearChrome('in')
          clearChromeCases()
        },
        enterSettleMs(landingBlocks),
      )
    }, 0)
  })

  return {
    callbackStarted,
    wait,
    async finish(): Promise<void> {
      void bestEffort(started.ready)
      // finished 才代表伪元素上的动画真的落地（含被跳过的情况），此时才能撤标记
      await wait
      inFlight = null
      armed.value = false
      armedTarget = null
      deckIsSource.value = false
      deckIsSink.value = false
      const root = document.documentElement
      root.classList.remove(VT_ROOT_CLASS)
      root.classList.remove(VT_LANDING_CLASS)
      // 起飞端那一页此刻已被替换：撤退场标记（其在途动画随 DOM 一起消失，不会残留）
      root.classList.remove(VT_EXIT_CLASS)
      clearChrome('out')
    },
  }
}

/** 收尾必须以过渡自身为准：过程中被新导航取消也要撤标记，故放 finally。 */
async function fly(flight: ReturnType<typeof beginFlight>): Promise<void> {
  if (!flight) return
  try {
    await flight.wait
  } finally {
    await flight.finish()
  }
}

export function installViewTransition(router: Router): void {
  appRouter = router
  if (!VT_SUPPORTED) return // 浏览器不支持：整条路径保持惰性，不注册也不打日志

  // 「为什么我没看到动画」的第一诊断线索：支持性只在启动时判定一次，出错时看这一行
  console.info('[viewTransition] 共享元素过渡已启用')
  if (installed) return
  installed = true

  // 减少动效：整条路径不动（`::view-transition-*` 伪元素不在 base.css 的 `*` 规则作用域里，
  // 全局的 transition-duration: 0.01ms 盖不到它们，必须在源头拦）
  if (reducedMotion()) return

  // 时序常量（CSS 与 JS 单一来源）一次写好：样式里的 duration/step 都读这几个变量，
  // 免得"界面动画 300ms、JS 只等 200ms"这种两边各写一份的漂移
  applyTimingVars()

  // 回程要提前置位：deckIsSink 的唯一职责是 App.vue 的页面过渡让位
  // （共享元素名不靠它——两端均常驻声明）
  router.beforeEach((to, from) => {
    deckIsSink.value = isAgentDetailToDeck(to, from)
    // 起飞前编排在途时，**别的**导航一旦开始就整段撤销：用户改主意优先。
    // 不撤的话，编排落定后的那一跳会盖掉用户后来点的那一次（实测会飞到旧目的地），
    // 而且退场标记会留在页面上（站头保持隐身）。
    if (armed.value && to.fullPath !== armedTarget) disarmDeckFlight()
  })

  router.beforeResolve(async (to, from) => {
    const outbound = isDeckToAgentDetail(to, from)
    if (!outbound && !isAgentDetailToDeck(to, from)) return

    // 降落端的画：去程预热点开的那张详情头图；回程由 awaitSharedEndImage 兜（牌堆图已在缓存）
    const targetId = Array.isArray(to.params.id) ? to.params.id[0] : to.params.id
    let landingReady: Promise<void> = Promise.resolve()
    if (outbound) {
      // 登记起飞卡：回程时首页牌堆取走一次，落回同一张画
      rememberDeckCard(Number(targetId))
      landingReady = prewarmLandingHero(targetId)
    }

    deckIsSource.value = true // 服务 App.vue 的页面过渡让位；名字不靠它
    const flight = beginFlight(router, to.fullPath, outbound ? 'hero' : 'deck', landingReady)
    // 上一次飞行还没落地：并进同一次，不叠第二次 startViewTransition
    if (!flight) return
    // **卡在「更新回调已开始」**：旧状态进快照后才放行导航（放早了拍到的就是切完的画面）。
    // 加一道上限兜底：回调迟迟不来（渲染时机被阻塞等）也不能把导航挂死。
    await Promise.race([
      flight.callbackStarted,
      new Promise<void>((resolve) => setTimeout(resolve, NAV_SETTLE_MS)),
    ])
    void fly(flight)
  })
}

