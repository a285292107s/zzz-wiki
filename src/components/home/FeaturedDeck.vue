<script setup lang="ts">
/* ============================================================
 * FeaturedDeck — 首页「今日角色」标本陈列（一次一张，横向牌堆）。
 *
 * 构图（一个 hairline 装裱框内：立绘 → 标本签 → 座次/刻度）：
 *   桌面：2.36:1 超宽标本板（Mindscape 全景原生比例），整幅展示不裁上下；
 *         装裱宽度 = min(栏宽, 高度上限 × 2.36) 并居中 —— 大屏上「比例」与「44vh 高度
 *         上限」不再互相打架（直接铺满栏宽会把 2.36 压成 2.7:1，上下要被裁掉）。
 *   手机：4:5 竖幅。超宽全景放进横框只露一条横带，还容易被信息条压掉半个画面；
 *         竖幅下同一套 pos/zoom/originY（本就是为竖框校准的）收进更多角色本体，
 *         纵向取景与桌面完全一致（都是「源高 / zoom」那一档），只是横向上下文更少。
 *   信息一律在**图下**（标本签），不叠在画面上：作品不被遮挡，两种断点结构一致。
 *
 * 手感对齐 flutter 的 PageView：跟手 1:1 拖动、两端橡皮筋阻尼、松手吸附到最近一张；
 * 整卡点击进详情。纯数字逻辑在 src/utils/deckGesture.ts（可单测），
 * 这里只管 DOM / 指针 / 过渡。
 *
 * 布局模型（**静止态不需要任何测量** —— 整栏宽单卡的最大好处）：
 *   一次只展示一张，槽位 s 绝对定位在 `left: s·100%`，轨道只需按活动槽位平移：
 *       轨道位移 = −活动槽位·100%（基位移，百分比） + 跟手量（px，仅拖动中非零）
 *   槽位 0 的左缘天然对齐取景框内容左缘，故不存在「半个槽宽 / 偏移父级 / 百分比取整」
 *   这一类只在「多卡并排 + 露邻卡」时才出现的问题。
 *   **不露邻卡**：静止时邻卡整张在框外，故逐槽位不叠 scale/opacity/z-index —— 拖动中
 *   只有轨道一个元素在位移/合成，4 张卡是静态槽位（少 3 个常驻合成层与每帧 4 次样式补丁）。
 *   取景框宽只在**按下那一刻**量一次，用途仅剩「把跟手 px 折算成槽位数」。
 *
 * 三态（缺一不可）：
 *   ① 跟手：dragX 有值 → 过渡关闭，位移逐帧跟随指针（CSS 过渡会拖后腿）
 *   ② 松手：吸附到整数槽位，过渡打开，位移平滑收敛
 *   ③ 落定：dragX 归零、active 换成新槽位；基位移与跟手量都归零，画面不跳
 * ============================================================ */

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { FeaturedCard } from '@/composables/useFeaturedAgents'
import { prefetchDetail } from '@/composables/useDetailPrefetch'
import {
  VT_LANDING_CLASS,
  VT_SHARED_ATTR,
  VT_SHARED_NAME,
  VT_SUPPORTED,
  armDeckFlight,
  canArmDeckFlight,
  consumeDeckCard,
  deckFlightArmed,
  deckNavigate,
  disarmDeckFlight,
} from '@/utils/viewTransition'
import { heroForm } from '@/composables/useHeroForm'
import { heroFileForForm } from '@/data/heroGenderVariants'
import { awaitImageReady, heroDetailPrimarySrc, heroDetailViewport } from '@/data/heroImageSources'
import { catalogByPath } from '@/domain/catalog'
import HollowImage from '@/components/HollowImage.vue'
import {
  DRAG_INTENT_PX,
  clampIndex,
  followWithRubber,
  isDragGesture,
  lastIndexOf,
  settleIndex,
} from '@/utils/deckGesture'

const props = defineProps<{ cards: FeaturedCard[] }>()

const viewport = ref<HTMLElement | null>(null)

/** 共享元素过渡（首页卡 → 代理人详情页头图，见 utils/viewTransition）：
 *  名字挂在**活动卡的 .deck-item**（<a> 元素）上，不挂 <img> 本体——
 *  <img> 带 zoom 校准的 transform，渲染盒比可视区域大 1.28×，而带名元素的快照
 *  不含祖先裁切，直接挂会起飞在一圈放大的画面上（实测的「起飞瞬间凭空放大」）。
 *  .deck-item 自身 overflow: hidden，快照=可见画面，与详情页 .hero-bg 同一策略。
 *  名字常驻是安全的：view-transition-name 只在 `startViewTransition` 采样期间起作用，
 *  平时对渲染零影响；但同一时刻同名元素必须唯一，故只给活动卡传（四张都传会让
 *  浏览器跳过整次过渡）。 */
const VT_ITEM_STYLE = { viewTransitionName: VT_SHARED_NAME } as const

/** 共享元素端点的 DOM 标记：过渡的运行时要找到**新状态那端的画**并等它可绘制
 *  （见 utils/viewTransition/awaitSharedEndImage）。同样只给活动卡挂。
 *  取值必须与详情页那头不同（'deck' vs 'hero'）：新旧两页都带标记，只按属性找会命中旧页。
 *  `data-vt-skip`：整页退场时这张画是主角，不能被淡掉 —— 收集器会把它所在的分支
 *  整支排除，只把祖先记作「装裱壳」（退边线/底色，见 chrome.ts）。 */
const VT_ITEM_MARK = { [VT_SHARED_ATTR]: 'deck', 'data-vt-skip': '' } as const

const count = computed(() => props.cards.length)
const last = computed(() => lastIndexOf(count.value))

/* ---------- 入场：标本装匣 ----------
 * 一次编排、三拍：装裱线先亮 → 画落位（缩放 + 微裁切收拢）→ 标本签与刻度随后写就。
 * 全部只动 transform/opacity/border-color（不触发布局，零 CLS），且**终态即常态**
 * ——序列结束把类摘掉，样式无缝接回，换卡时的轻淡入不受影响（is-mounting 已摘）。
 *
 * 触发不用父级的 v-reveal：两者节奏不同（v-reveal 只是整块上浮），这里要和
 * 「匣子进入视野」对齐，故自持一个 IntersectionObserver，只在**第一次**入画时播一次。 */
const frame = ref<HTMLElement | null>(null)
const mounting = ref(false)
let mountTimer: number | undefined

onMounted(() => {
  // 减少动效：整段编排不参与（全局只归零时长、不归零延迟，直接不加类最干净）
  if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return
  }
  // 共享元素过渡的降落端（详情页返回首页）：这一趟的入场由落地编排负责，
  // 画/标本签此时正被 ::view-transition-* 接管，别在同一段时间里再叠一套自转
  if (document.documentElement.classList.contains(VT_LANDING_CLASS)) return
  const el = frame.value
  if (!el || typeof IntersectionObserver === 'undefined') return
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      io.disconnect()
      mounting.value = true
      // 序列总时长（最后一枚刻度 590ms 延迟 + 340ms）之后摘类：交还常态样式
      mountTimer = window.setTimeout(() => {
        mounting.value = false
      }, 1200)
    },
    { rootMargin: '0px 0px -10% 0px' },
  )
  io.observe(el)
  onBeforeUnmount(() => io.disconnect())
})

/** 当前槽位（真卡下标）。
 *  回程（代理人详情 → 首页）要落在**刚才点开的那张卡**上，否则共享元素会把 A 的画
 *  接到 B 的框里（两个不同角色的交叉溶解，比不飞更糟）。起飞时由路由守卫登记 id
 *  （utils/viewTransition 的 rememberDeckCard），这里挂载时取走一次。 */
const active = ref(restoreSlot())
function restoreSlot(): number {
  const id = consumeDeckCard()
  if (id == null) return 0
  const i = props.cards.findIndex((c) => c.id === id)
  return i > 0 ? i : 0
}
/** 标本签只渲染当前这一张：换卡时 :key 重挂 → 轻淡入（不给 4 张卡各留一份标签） */
const current = computed(() => props.cards[active.value])

/** 拖动中：跟手位移必须无过渡 */
const dragging = ref(false)
/** 跟手位移（px，右为正），松手归零 */
const dragX = ref(0)
/** 换卡方向（+1 前进 / −1 后退）：只服务读数滚入的方向（见 settleTo 与 .deck-count-num） */
const dir = ref(1)

/** 拖拽判定与基准 */
let startX = 0
let maxMoved = 0
let armed = false
/** 拖动过就抑制尾随的 click（拖完松手不该跳详情） */
let suppressClick = false
/** 横向拖拽意图成立前不接管手势（让页面纵向滚动照常工作） */
let intent = false
/** 取景框内容宽（px）：**按下那一刻**量一次，只用于把跟手 px 折算成槽位。
 *  静止态不需要它（基位移走百分比），故不必常驻 ResizeObserver/窗口 resize 监听。 */
let frameWidth = 0

const slots = computed(() => Array.from({ length: count.value }, (_, s) => s))

/** 跟手位移的两端阻尼（可视值，px）：越界按 0.35 压缩，给出「到头了」的手感又不硬顶。
 *  入参必须是**槽位坐标**（active + 指针位移折算的槽位数）—— followWithRubber 的
 *  [0, last] 判定以槽位为单位；直接把「位移/宽」丢进去会被当成越界而全程阻尼。
 *  符号：dragX 是「指针向右为正」，轨道要朝反方向走，故最后取负。 */
const rubberX = computed(() => {
  const w = Math.max(1, frameWidth)
  const pos = active.value - dragX.value / w
  return -(followWithRubber(pos, count.value) - active.value) * w
})

/** 轨道位移 = 基位移（−活动槽位，百分比：轨道宽即取景框宽，正好一屏一个槽位）+ 跟手量（px）。
 *  `calc()` 在 translate3d 的分量里是可用的（实测 Chrome：
 *  `translate3d(calc(-100% + 5px),0,0)` → tx = −自身宽 + 5px，`var()` 同样生效），
 *  故一条表达式同时容下「不需要测量的百分比基位移」与「px 跟手量」，免掉
 *  「量到宽之前用另一条兜底表达式」的分支。 */
const trackStyle = computed<Record<string, string>>(() => {
  const base = `${(-active.value * 100).toFixed(4)}%`
  return { transform: `translate3d(calc(${base} + ${rubberX.value.toFixed(2)}px), 0, 0)` }
})

/** 槽位横向位置：静态常量，只有轨道在动（见文件头「不露邻卡」） */
const slotVars = (slot: number): Record<string, string> => ({ '--slot-index': String(slot) })

/** 松手：吸附到目标槽位。跟手位移必须先归零（它同时驱动轨道位移）。 */
function settleTo(index: number): void {
  dragX.value = 0
  dragging.value = false
  if (count.value <= 1) return
  const next = clampIndex(index, count.value)
  // 换卡方向（+1 前进 / −1 后退）：读数按方向滚入 —— 机械计数器的方向感与手势同向
  dir.value = next >= active.value ? 1 : -1
  active.value = next
}

function onPointerDown(e: PointerEvent): void {
  if (count.value <= 1 || (e.pointerType === 'mouse' && e.button !== 0)) return
  // 触屏没有 hover：按下即预热当前卡的详情头图（点开与这里只隔一次 pointerup，
  // 抢在路由守卫起飞前把请求发出去；鼠标路径已由 pointerenter 预热过，不必重复）
  if (e.pointerType !== 'mouse') warmHero(current.value?.id)
  // 跟手换算基准：按下这一刻量一次即可（能收到指针事件必已布局；量为 0 时不接管手势）
  const w = viewport.value?.clientWidth ?? 0
  if (w <= 0) return
  frameWidth = w
  armed = true
  intent = false
  dragging.value = true
  startX = e.clientX
  maxMoved = 0
  dragX.value = 0
  // 指针可能移出取景框（拖到分栏 / 浏览器边缘），故监听挂在 window 上而不是元素上：
  // 不依赖 pointer capture（合成指针/异常光标下 setPointerCapture 会抛 NotFoundError，
  // 一旦抛出后续 pointermove 就再也收不到，拖拽态会永久卡住）
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
}

function onPointerMove(e: PointerEvent): void {
  if (!dragging.value) return
  const dx = e.clientX - startX
  maxMoved = Math.max(maxMoved, Math.abs(dx))
  // 纵向优先（触屏混手势）：横向位移未过阈值前不接管，页面纵向滚动照常
  if (!intent && maxMoved <= DRAG_INTENT_PX) return
  intent = true
  if (e.cancelable) e.preventDefault()
  dragX.value = dx
}

function endDrag(): void {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
  suppressClick = armed && isDragGesture(maxMoved)
  armed = false
  if (!dragging.value) return
  // dragX 已是「向右拖为正」：左拖为负 → 前进到下一张（见 settleIndex 的约定）
  settleTo(settleIndex(active.value, dragX.value, frameWidth, count.value))
}

function onPointerUp(): void {
  endDrag()
}

function onKeydown(e: KeyboardEvent): void {
  if (count.value <= 1) return
  const key = e.key
  if (key === 'ArrowRight') {
    e.preventDefault()
    settleTo(active.value + 1)
  } else if (key === 'ArrowLeft') {
    e.preventDefault()
    settleTo(active.value - 1)
  } else if (key === 'Home') {
    e.preventDefault()
    settleTo(0)
  } else if (key === 'End') {
    e.preventDefault()
    settleTo(last.value)
  }
}

function goTo(index: number): void {
  if (index === active.value) return
  settleTo(index)
}

/** 点击闸门 + 起飞前编排的接管点（**捕获阶段**：必须跑在 vue-router 的链接处理器之前，
 *  否则 RouterLink 先 preventDefault 并 push，我们连拦的机会都没有）。
 *  三件事按序判定：
 *    ① 拖拽尾随的那一次 click 拦掉（拖动过松手不该跳详情）
 *    ② 修饰键点击（⌘/Ctrl/Shift/Alt、中键）一律放行 —— 那是「新标签打开」的正常语义
 *    ③ 其余普通左键点击活动卡：接管，先演整页退场 + 原地取景变形，落定后再 push */
function onClickCapture(e: MouseEvent): void {
  if (suppressClick) {
    suppressClick = false
    e.preventDefault()
    e.stopPropagation()
    return
  }
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  const link = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>('.deck-item')
  if (!link) return
  const card = props.cards.find((c) => c.to === link.getAttribute('href'))
  if (!card || !canArmDeckFlight()) return
  // 接管：既拦默认导航，也拦 vue-router 的处理器（本次点击由我们编排完再 push）
  e.preventDefault()
  e.stopPropagation()
  void flyWithPreflight(card.to)
}

/* ---------- 起飞前编排：整页退场 + 原地变形 ----------
 * 用户点开某张卡时不再立刻跳页，而是：
 *   ① 整页可视区块自上而下依次退场（chrome 收集器按 `data-vt-block` 声明）
 *   ② 同一时间，那张画**在原地**把取景从「牌堆校准」变形到「目的地取景」
 *   ③ 两者都落定，才 push 导航 → 共享元素飞行
 * 为什么值得多花这 ~500ms：飞行中的两层是位图快照，浏览器只插值几何 —— 两端取景不同
 * 就只能靠交叉溶解交接，落地那一刻会出现约等于 zoom 倍的尺寸跳（1.2–1.49×）。
 * 把「取景变化」挪到起飞前在活的 DOM 上做，飞行就只剩纯几何位移，两层内容尺度一致。
 */
/** 取景变形中：图的内联取景切到「目的地取景」（neutral），由 CSS transition 平滑过去 */
const morphing = ref(false)

/** 图的取景样式：常态读逐图校准；变形中切到目的地（详情桌面 = 纯 cover 居中、无校准） */
function figureStyle(slot: number): Record<string, string> {
  const c = props.cards[slot]
  if (morphing.value) {
    return { objectPosition: '50%', transformOrigin: '50% 50%', transform: 'scale(1)' }
  }
  return {
    objectPosition: c?.pos ?? '50%',
    transformOrigin: `50% ${c?.originY ?? 50}%`,
    transform: `scale(${c?.zoom ?? 1})`,
  }
}

/** 编排被撤销（用户改主意 / 导航失败）时把取景平滑回常态 ——
 *  不然牌堆会停在「目的地取景」上，而这一趟根本没飞出去 */
watch(deckFlightArmed(), (active) => {
  if (!active) morphing.value = false
})

/** 点击入口：只在「能编排」时接管，其余一律放行 —— 修饰键（新标签打开）永远放行 */
async function flyWithPreflight(to: string): Promise<void> {
  morphing.value = true
  const result = await armDeckFlight(to)
  if (result === 'cancelled') {
    // 用户中途点了别处：退场已由守卫撤销，这里绝不能再补一次导航盖掉他的新去向
    morphing.value = false
    return
  }
  if (result === 'unavailable') {
    // 编排根本没起来（不支持 / 没声明区块）：这次点击已被我们拦下，得自己补一次导航
    disarmDeckFlight()
    morphing.value = false
  }
  await deckNavigate(to)
}

function warmDetail(slot: number): void {
  const card = props.cards[slot]
  if (!card) return
  const seg = card.to.split('/')
  const entry = catalogByPath(`/${seg[1]}`)
  if (entry && seg[2]) prefetchDetail(entry, seg[2])
  warmHero(card.id)
}

/** 预热详情页 hero 头图（共享元素过渡的**降落端**）。
 *  降落端与卡片端是同一张 Mindscape 的**不同派生档**（卡片走 card/wide 派生，
 *  详情按 DPR 走原图或 mobile 派生），地址不同、缓存不共享 —— 不预热的话浏览器采样
 *  「新状态」时那张画还在下载，整段飞行退化成一次黑场（实测：导航后 ~430ms 页面全黑、
 *  随后硬切到详情页，看不出任何飞行）。悬停/聚焦即预热，触屏在 pointerdown 补一发。 */
function warmHero(id: number | undefined): void {
  if (id == null) return
  const base = heroFileForForm(id, heroForm.value)
  void awaitImageReady(heroDetailPrimarySrc(base, heroDetailViewport()), 2000)
}

/** 卡片的可读名（中英名 + 编号 + 元素）：slide 的可访问名与卡内链接名共用这一份。
 *  可见文本在**图下的标本签**里（不在链接内部），故链接名里带上同样的字串，
 *  WCAG 2.5.3（Label in Name）与 axe 的 label-content-name-mismatch 都稳。 */
function labelOf(card: FeaturedCard | undefined): string {
  if (!card) return '待载入'
  const parts = [card.zh || card.en || '待载入']
  if (card.no) parts.push(`编号 ${card.no}`)
  if (card.elementZh) parts.push(card.elementZh)
  return parts.join(' · ')
}

/** slide 容器的 DOM id：APG 要求 slide 有可访问名；刻度按钮用它声明「我控制哪一张」 */
function slideId(slot: number): string {
  return `deck-slide-${slot}`
}

/** 取景框宽变化无需处理：基位移走百分比（随布局自动正确），跟手量的基准每次按下重量 */

onBeforeUnmount(() => {
  endDrag()
  if (mountTimer !== undefined) window.clearTimeout(mountTimer)
})
</script>

<template>
  <!-- 单根节点（挂 v-reveal 之类的指令时需要）；入场编排由本组件自持，见 is-mounting -->
  <div class="featured-deck" :class="{ 'is-mounting': mounting }">
    <!-- 装裱：立绘、标本签、座次共处一个 hairline 框（2px 圆角，同全站语言）。
         宽度取 min(栏宽, 高度上限 × 2.36) 并居中：超宽屏不留单侧空档，
         2.36 构图也不会被「铺满栏宽」压成 2.7:1（那会裁掉上下）。 -->
    <div ref="frame" class="deck-frame">
      <div
        ref="viewport"
        class="deck-viewport"
        role="group"
        aria-label="今日角色"
        aria-roledescription="轮播"
        tabindex="0"
        :class="{ 'is-dragging': dragging }"
        @pointerdown="onPointerDown"
        @keydown="onKeydown"
        @click.capture="onClickCapture"
      >
        <div
          class="deck-track"
          :class="{ 'no-anim': dragging }"
          :style="trackStyle"
          :aria-live="dragging ? 'off' : 'polite'"
        >
          <!-- 每张卡是一个 slide：APG carousel 要求 slide 容器 role=group + 可访问名。
               卡内链接只包立绘（alt=""）：可见文本在**图下的标本签**里而不在链接内部，
               故不会触发 axe 的 label-content-name-mismatch（该规则只看元素自身的可见文本）。 -->
          <div
            v-for="s in slots"
            :id="slideId(s)"
            :key="s"
            class="deck-slide"
            role="group"
            aria-roledescription="角色卡"
            :aria-label="`第 ${s + 1} 位：${labelOf(cards[s])}`"
            :style="slotVars(s)"
          >
            <RouterLink
              class="deck-item"
              :to="cards[s]?.to ?? '/agents'"
              :tabindex="s === active ? undefined : -1"
              :aria-current="s === active ? 'true' : undefined"
              :aria-label="labelOf(cards[s])"
              :style="s === active && VT_SUPPORTED ? VT_ITEM_STYLE : undefined"
              v-bind="s === active && VT_SUPPORTED ? VT_ITEM_MARK : undefined"
              @pointerenter="warmDetail(s)"
              @focus="warmDetail(s)"
              @dragstart.prevent
            >
              <!-- @dragstart.prevent：卡片是 <a> 包 <img>，鼠标按住拖动会触发**浏览器原生图片
                   拖影**——实测拖到 ~25px 就被它劫持（dragstart → pointercancel），跟手手势
                   直接中断、松手回弹。preventDefault 拦在冒泡链上即消除，触屏不受影响。 -->
              <span class="deck-figure">
                <!-- 一次只上屏一张，但仍用 eager：拖拽换人时要即时可用，懒加载会在切换瞬间才发请求。
                     srcs 是带 srcset 的派生档（card 800w / wide 1600w / 原图），由浏览器按 DPR 与
                     sizes 自选（竖幅另有等效源宽，见 useFeaturedAgents.deckSizes）。
                     逐图构图参数与详情页 AgentHead 同一坐标系（IMG_GUIDE.md）。 -->
                <HollowImage
                  unframed
                  loading="eager"
                  :srcs="cards[s]?.srcs ?? []"
                  alt=""
                  :img-style="figureStyle(s)"
                />
              </span>
            </RouterLink>
          </div>
        </div>
      </div>

      <!-- 标本签 + 座次：整块参与「整页退场 / 逐条入场」（data-vt-block），
           退场时与其它区块一起自上而下收走；那张画的取景变形由 .deck-figure 承担 -->
      <div class="deck-meta" data-vt-block>
        <!-- 标本签：编号 · 属性 · 中英名（图下，不压画面）。
             内容是当前卡的**镜像**（同样的信息已由 slide 的 aria-label 给出），故 aria-hidden，
             免得读屏把同一批信息播两遍；:key 换卡重挂触发一次轻淡入（reduced-motion 由
             base.css 的全局规则压成 0.01ms）。名录未就绪时按条形占位，行盒同高不跳变。 -->
        <p :key="active" class="deck-label" aria-hidden="true">
          <span class="no mono">{{ current?.no ?? '--' }}</span>
          <span
            v-if="current?.elementZh"
            class="el mono"
            :style="current?.elementColor ? { color: current.elementColor } : undefined"
          >{{ current!.elementZh }}</span>
          <template v-if="current?.zh">
            <span class="zh">{{ current!.zh }}</span>
            <span class="en mono">{{ current!.en }}</span>
          </template>
          <template v-else>
            <span class="bar zh-bar" />
            <span class="bar en-bar" />
          </template>
        </p>

        <!-- 座次 + 角色选择：APG 的 "Grouped" 形态 —— 每个选择器是 button、
             当前项标 aria-disabled=true（而非 HTML disabled，读屏仍能读到并据此定位）。
             没做自动轮播，故不需要暂停按钮（APG 只对 autoplay 要求它）。
             读数只作视觉陈列（aria-hidden）：位置信息由刻度的可访问名与轮播的 aria-live 承担。 -->
        <div class="deck-pager">
          <span class="mono deck-count" :style="{ '--deck-dir': dir }" aria-hidden="true"><span :key="active" class="deck-count-num">{{ String(active + 1).padStart(2, '0') }}</span> / <span class="deck-count-total">{{ String(count).padStart(2, '0') }}</span></span>
          <span v-if="count > 1" class="deck-ticks" role="group" aria-label="选择要展示的角色">
            <button
              v-for="(c, i) in cards"
              :key="c.id"
              type="button"
              class="deck-tick"
              :class="{ 'is-active': i === active }"
              :aria-disabled="i === active ? 'true' : undefined"
              :aria-controls="slideId(i)"
              :aria-label="`第 ${i + 1} 位：${c.zh || c.en || '待载入'}`"
              @click.stop="goTo(i)"
            />
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ---------- 装裱 ---------- */

.featured-deck {
  /* 高度上限的单一来源：装裱宽度由它反推（× 2.36），取景框高度上限也用它。
     改这里还要同步 useFeaturedAgents 的 DECK_MAX_WIDTH / deckSizes 与 hero-cards.mjs 的档宽。

     44vh / 500px 是**为共享元素过渡定的**：陈列框若铺满内容栏（48vh 时 1680 宽下正好
     1187 ≈ 栏宽 1198），详情页头图也是整栏宽 —— 两端几何几乎相同，飞行退化成一次纯交叉
     溶解（实测 1680 下宽度倍率只有 1.009）。留一档「标本比封面小」的差距后，
     各断点倍率稳定在 1.10～1.42，且纵向本就要飞行 250～350px。 */
  --deck-max-h: clamp(240px, 44vh, 500px);
}

/* ---------- 入场「标本装匣」 ----------
   一次编排、三拍：装裱线先亮 → 画落位（1.035 倍收回 + 下缘裁切收拢）→ 标本签与刻度逐条写就。
   类只在首次入画后挂 1.5s，序列结束即摘（**终态=常态**，摘掉无缝接回；
   故换卡时那套轻淡入不会被它抢走）。全部只动 transform/opacity/border-color：不触发布局、零 CLS。 */
.featured-deck.is-mounting .deck-frame {
  animation: deck-frame-in 560ms var(--ease) both;
}

.featured-deck.is-mounting .deck-figure {
  /* 动的是 .deck-figure 而非 <img>：img 身上有逐图校准的内联 transform，不能碰。
     只走 transform/opacity（合成器可承担）；不用 clip-path —— 它每帧都要重绘
     1168×500 那一层，是这套编排里唯一会拖帧的属性。 */
  animation: deck-plate-in 760ms var(--ease) 60ms both;
}

.featured-deck.is-mounting .deck-meta {
  animation: deck-meta-in 460ms var(--ease) 240ms both;
}

/* 标本签四件与刻度错峰：读起来像「一条条写上去」，而不是整块浮现 */
.featured-deck.is-mounting .deck-label > * {
  animation: deck-piece-in 420ms var(--ease) both;
}

.featured-deck.is-mounting .deck-label > :nth-child(1) {
  animation-delay: 260ms;
}

.featured-deck.is-mounting .deck-label > :nth-child(2) {
  animation-delay: 320ms;
}

.featured-deck.is-mounting .deck-label > :nth-child(3) {
  animation-delay: 380ms;
}

.featured-deck.is-mounting .deck-label > :nth-child(4) {
  animation-delay: 440ms;
}

.featured-deck.is-mounting .deck-count {
  animation: deck-piece-in 420ms var(--ease) 380ms both;
}

.featured-deck.is-mounting .deck-tick::before {
  animation: deck-tick-in 340ms var(--ease) both;
  transform-origin: left center;
}

.featured-deck.is-mounting .deck-tick:nth-child(1)::before {
  animation-delay: 440ms;
}

.featured-deck.is-mounting .deck-tick:nth-child(2)::before {
  animation-delay: 490ms;
}

.featured-deck.is-mounting .deck-tick:nth-child(3)::before {
  animation-delay: 540ms;
}

.featured-deck.is-mounting .deck-tick:nth-child(4)::before {
  animation-delay: 590ms;
}

@keyframes deck-frame-in {
  from {
    border-color: transparent;
  }
  to {
    border-color: var(--line-1);
  }
}

/* 画落位：从 1.03 倍收回、自半透明「显影」到位（两件都走合成器） */
@keyframes deck-plate-in {
  from {
    transform: scale(1.03);
    opacity: 0.82;
  }
  to {
    transform: none;
    opacity: 1;
  }
}

@keyframes deck-meta-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes deck-piece-in {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes deck-tick-in {
  from {
    opacity: 0;
    transform: scaleX(0.25);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  /* 全局只归零时长、不归零延迟：显式清掉延迟，元素直接停在终态 */
  .featured-deck.is-mounting *,
  .featured-deck.is-mounting *::before,
  .featured-deck.is-mounting *::after {
    animation-delay: 0ms !important;
  }
}

.deck-frame {
  /* 宽度 = min(栏宽, 高度上限 × 2.36)：大屏居中陈列（不留单侧空档），
     2.36 构图始终成立（铺满栏宽会把它压成 2.7:1 → 上下被裁） */
  width: min(100%, calc(var(--deck-max-h) * 2.36));
  margin: 0 auto;
  border: 1px solid var(--line-1);
  border-radius: 2px;
  background: var(--bg-0);
  overflow: hidden; /* 标本签与立绘共用圆角 */
}

/* ---------- 共享元素（首页卡 → 代理人详情页头图） ----------
   名字挂在**活动卡的那张画**上（HollowImage 的 vt-name prop → <img> 内联样式）：
   装裱框与详情头图尺寸本来就接近，挂框只会「整块面板挪一下」；
   挂画才是真正的共享元素——同一张 Mindscape 从这里长到详情页整栏封面。
   动画时长/缓动收在 base.css 的 ::view-transition-*（全局单一来源）。

   试过在起飞前把画「卡回取景框的可见矩形」，结论是不做：
   带名元素的截图用的是它自己的布局盒（卡内 <img> 因 zoom 校准比取景框大 1.28×），
   而要让 inset 卡准就得改动祖先定位，实测会把 .deck-item 的含有块换成整栏
   （1178×499），比不卡更失真。多出来的那一圈与卡同为深底，
   在 320ms 的飞行里不可辨——不值得为它动布局。 */

/* ---------- 取景框 ---------- */

.deck-viewport {
  position: relative;
  overflow: hidden;
  width: 100%;
  /* 2.36:1 = Mindscape 全景原生比例：整幅展示、不裁上下 */
  aspect-ratio: 2.36;
  max-height: var(--deck-max-h);
  background: var(--bg-0);
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  /* 触屏：横向手势交给我们，纵向仍归页面滚动 */
  touch-action: pan-y;
}

/* 焦点环贴内缘：装裱框 overflow:hidden 会裁掉全局那条 +2px 外偏移的环 */
.deck-viewport:focus-visible {
  outline-offset: -1px;
}

.deck-viewport.is-dragging {
  cursor: grabbing;
}

/* 轨道：槽位绝对定位在 left: s·100%，故整排宽度即取景框宽，
   位移只靠一层平移（基位移百分比 + 跟手 px，见 trackStyle），不参与任何布局测量。
   **不露邻卡**：卡片是静态槽位、不叠 scale/opacity，故只有轨道一个常驻合成层。 */
.deck-track {
  position: absolute;
  inset: 0;
  will-change: transform;
  transition: transform var(--t-med) var(--ease);
}

.deck-track.no-anim {
  transition: none;
}

/* ---------- 每张卡（slide） ---------- */

.deck-slide {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  /* left 由静态内联的 --slot-index 驱动：百分比只与取景框宽有关，不涉及测量。
     本元素不参与动画（无 transform/opacity 变化）→ 不需要 will-change/transition */
  left: calc(var(--slot-index, 0) * 100%);
}

.deck-item {
  display: block;
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--bg-1);
}

.deck-figure {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--bg-0);
}

/* 超宽全景图整幅铺满（与详情页 hero 同法：cover + 居中取景，
   再叠逐图 zoom/originY 消掉上下透明边、pos 把脸带到画面里） */
.deck-figure img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  transform-origin: 50% 50%;
  /* 起飞前的「原地取景变形」：位移/缩放/取景/悬停微推近全在同一个 transition 里平滑过去。
     常驻无副作用 —— 只有 morphing 那一刻内联取景才变，其余时候值不变就不触发过渡。
     ⚠ 四条必须写在**同一条规则**里：hover 那条若另写 transition 简写会把本条整体顶掉，
     而点击恰恰总发生在 hover 状态下（实测踩过）。
     ⚠ 取景三条**不能沿用全局 --ease**（强 ease-out）：实测它 420ms 的变形在 ~300ms
     就"看起来停住了"，于是「退场还在收、画已经不动」——去程起飞前那段死档的真身。
     换成缓入缓出的中段饱满曲线，整段准备期里画一直在变。 */
  transition:
    scale var(--t-zoom) var(--ease),
    transform var(--vt-morph, 300ms) cubic-bezier(0.42, 0, 0.22, 1),
    transform-origin var(--vt-morph, 300ms) cubic-bezier(0.42, 0, 0.22, 1),
    object-position var(--vt-morph, 300ms) cubic-bezier(0.42, 0, 0.22, 1);
}

/* 悬停反馈：整幅轻微推近（1.5%）。不加 `.is-active` 限定 —— 拖动中邻卡会部分进画，
   指针落在它上面时同样给反馈；静止时框外的卡本来就悬停不到。 */
@media (hover: hover) {
  .deck-item:hover .deck-figure img {
    /* 只给值，不重写 transition：base 那条已经把 scale 一起列进去了（见上） */
    scale: 1.015;
  }
}

/* ---------- 标本签 + 座次（图下信息条） ---------- */

.deck-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-col);
  padding: 9px 14px 10px;
  border-top: var(--rule);
  background: var(--bg-0);
}

.deck-label {
  display: flex;
  align-items: baseline;
  gap: var(--space-inline);
  min-width: 0;
  /* 换卡时轻淡入（:key 重挂触发） */
  animation: deck-label-in var(--t-fast) var(--ease) both;
}

@keyframes deck-label-in {
  from {
    opacity: 0;
    transform: translateY(3px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.deck-label .no {
  font-size: var(--fs-caption);
  letter-spacing: 0.16em;
  color: var(--ink-2);
}

.deck-label .el {
  font-size: var(--fs-caption);
  letter-spacing: 0.08em;
  color: var(--ink-2);
}

.deck-label .zh {
  font-family: var(--serif);
  /* --fs-hero 的字面语义就是「首页人名」，这一行正是它唯一的用处 */
  font-size: var(--fs-hero);
  line-height: 1.2;
  color: var(--ink-0);
}

.deck-label .en {
  font-size: var(--fs-nano);
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--ink-2);
}

/* 名字占位条（名录未就绪时）：与真值行盒同高，交换不跳变 */
.deck-label .bar {
  display: block;
  height: 12px;
  background: linear-gradient(90deg, var(--bg-2) 0%, var(--bg-3) 50%, var(--bg-2) 100%);
  background-size: 200% 100%;
  animation: skel-pulse var(--t-skel) ease-in-out infinite;
}

.deck-label .zh-bar {
  height: 21px;
  width: 64px;
}

.deck-label .en-bar {
  height: 17px;
  width: 90px;
}

.deck-pager {
  display: flex;
  align-items: center;
  gap: var(--space-inline);
  flex: none;
}

.deck-count {
  font-size: var(--fs-caption);
  letter-spacing: 0.16em;
  color: var(--ink-2);
}

/* 读数是一件**机械计数器**（标本签是印刷体）：换卡时只有序号滚入，方向与手势同向
   ——前进时新数字从下方顶上来，后退时从上方落下。总量不参与（它不变）。
   裁切窗**不写死高度**：写死 1.2em 时 WCAG 1.4.12（用户放大行距）会把数字裁掉 4px
   （reflow-spacing 实测 clipped=1）。高度交给行盒，滚动位移按自身百分比仍然是一整行。 */
.deck-count-num {
  display: inline-block;
  overflow: hidden;
  vertical-align: bottom;
  animation: deck-count-roll 240ms var(--ease) both;
}

@keyframes deck-count-roll {
  from {
    transform: translateY(calc(var(--deck-dir, 1) * 100%));
    opacity: 0.35;
  }
  to {
    transform: none;
    opacity: 1;
  }
}

.deck-ticks {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 细线刻度而非圆点：圆点会被读成「圆角卡片堆叠」那一类模板语言。
   命中区 32×32（WCAG 2.5.8 下限 24；拇指更稳），细线 22×5 画在伪元素上 —— 视觉不变。 */
.deck-tick {
  position: relative;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
}

.deck-tick::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 13.5px; /* (32 − 5) / 2：细线在命中区正中 */
  width: 22px;
  height: 5px;
  border: 1px solid var(--line-1);
  border-radius: 2px;
  transition:
    background var(--t-fast) var(--ease),
    border-color var(--t-fast) var(--ease);
}

.deck-tick.is-active::before {
  background: var(--amber);
  border-color: var(--amber);
}

@media (hover: hover) {
  /* 悬停：细线转亮琥珀（当前刻度本就是琥珀底，故用更亮的 amber-hi，悬停仍有可见反馈） */
  .deck-tick:hover::before {
    border-color: var(--amber-hi);
  }
}

/* ---------- 手机（≤860） ---------- */

@media (max-width: 860px) {
  /* 竖幅：横框只露一条横带，底部信息条还会压掉近一半画面。同一套 pos/zoom/originY
     （本就是为竖框校准的）在 4:5 竖框里收进更多角色本体，纵向取景与桌面一致。 */
  .deck-frame {
    width: 100%;
  }

  .deck-viewport {
    aspect-ratio: 4 / 5;
    max-height: none;
  }

  /* 信息条转两行：名字独占一行，座次与刻度一行（两者分开到两端，拇指够得着） */
  .deck-meta {
    flex-wrap: wrap;
    gap: 4px;
    padding: 10px 12px 12px;
  }

  .deck-label,
  .deck-pager {
    flex-basis: 100%;
  }

  /* 标本签内部同样分行：编号 + 属性留在首行，中英名各占一行。
     四项挤在 nowrap 的一行里时，324px 中 24px 的中文名只分到 159px ——
     「奥菲丝&「鬼火」」被断成「奥菲丝&「鬼」/「火」」，英文名也断成两行。 */
  .deck-label {
    flex-wrap: wrap;
    row-gap: 2px;
  }

  .deck-label .zh,
  .deck-label .en {
    flex: 1 0 100%;
  }

  .deck-pager {
    justify-content: space-between;
  }
}
</style>



