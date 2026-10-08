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
  LANDING_PREWARM_MS,
  NAV_SETTLE_MS,
  VT_LANDED_CLASS,
  VT_LANDED_MS,
  VT_LANDING_CLASS,
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
  VT_LANDED_CLASS,
  VT_LANDING_CLASS,
  VT_ROOT_CLASS,
  VT_SHARED_ATTR,
  VT_SHARED_NAME,
  VT_SUPPORTED,
  consumeDeckCard,
} from './config'
export { isAgentDetailOf } from './config'

let installed = false
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

  const started = doc.startViewTransition(async () => {
    // ① 旧状态此刻已进快照 —— 放行守卫里等着的导航（顺序错了就是整段空转，见文件头）
    markStarted?.()
    // ② 等这次导航真正落到目标路由（懒 chunk / 详情 JSON 可能还在飞）
    await waitUntil(() => router.currentRoute.value.fullPath === targetFullPath, NAV_SETTLE_MS)
    // ③ 等**降落端真的挂上舞台**：路由落定 ≠ 视图已挂载（`mode="out-in"` 要等旧视图离场），
    //    只等路由就会把还在场上的旧页面拍成「新状态」——两端几何相同，飞行冻在起飞盒
    await waitSharedEndMounted(landingEnd)
    await nextTick()
    // ④ 挂降落标记：只作用于**即将被采样**的新状态（旧状态早已进快照，故不受影响）——
    //    目的页的文字层因此不进飞行画面，留给落地前后的编排（base.css 的 vt-plate-in）
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
  // 定时器回调必然排在它之后。组件侧据此把文字层按档案装订顺序逐条就位。
  // 两个定时器无须在 finish 里清：`vt-landed` 自身不带隐藏态，多挂一会儿无害
  // （动画的终点就是常态），清早反而会把编排断在半路。
  void bestEffort(started.updateCallbackDone).then(() => {
    window.setTimeout(() => {
      document.documentElement.classList.add(VT_LANDED_CLASS)
      window.setTimeout(() => {
        document.documentElement.classList.remove(VT_LANDED_CLASS)
      }, VT_LANDED_MS)
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
      deckIsSource.value = false
      deckIsSink.value = false
      document.documentElement.classList.remove(VT_ROOT_CLASS)
      document.documentElement.classList.remove(VT_LANDING_CLASS)
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
  if (!VT_SUPPORTED) return // 浏览器不支持：整条路径保持惰性，不注册也不打日志

  // 「为什么我没看到动画」的第一诊断线索：支持性只在启动时判定一次，出错时看这一行
  console.info('[viewTransition] 共享元素过渡已启用')
  if (installed) return
  installed = true

  // 减少动效：整条路径不动（`::view-transition-*` 伪元素不在 base.css 的 `*` 规则作用域里，
  // 全局的 transition-duration: 0.01ms 盖不到它们，必须在源头拦）
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  // 回程要提前置位：deckIsSink 的唯一职责是 App.vue 的页面过渡让位
  // （共享元素名不靠它——两端均常驻声明）
  router.beforeEach((to, from) => {
    deckIsSink.value = isAgentDetailToDeck(to, from)
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
