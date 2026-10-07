<script setup lang="ts">
/* ============================================================
 * FeaturedDeck — 首页「今日角色」标本陈列（一次一张，横向牌堆）。
 *
 * 构图（一个 hairline 装裱框内：立绘 → 标本签 → 座次/刻度）：
 *   桌面：2.36:1 超宽横幅（Mindscape 全景原生比例），整幅展示不裁上下；
 *         装裱宽度 = min(栏宽, 高度上限 × 2.36) 并居中 —— 大屏上「比例」与「48vh 高度
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

import { computed, onBeforeUnmount, ref } from 'vue'
import type { FeaturedCard } from '@/composables/useFeaturedAgents'
import { prefetchDetail } from '@/composables/useDetailPrefetch'
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

const count = computed(() => props.cards.length)
const last = computed(() => lastIndexOf(count.value))

/** 当前槽位（真卡下标） */
const active = ref(0)
/** 标本签只渲染当前这一张：换卡时 :key 重挂 → 轻淡入（不给 4 张卡各留一份标签） */
const current = computed(() => props.cards[active.value])

/** 拖动中：跟手位移必须无过渡 */
const dragging = ref(false)
/** 跟手位移（px，右为正），松手归零 */
const dragX = ref(0)

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
  active.value = clampIndex(index, count.value)
}

function onPointerDown(e: PointerEvent): void {
  if (count.value <= 1 || (e.pointerType === 'mouse' && e.button !== 0)) return
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

/** 点击闸门：拖动过的那一次 click 拦掉，正常点击放行给 <RouterLink> */
function onClickCapture(e: MouseEvent): void {
  if (suppressClick) {
    suppressClick = false
    e.preventDefault()
    e.stopPropagation()
  }
}

function warmDetail(to: string): void {
  const seg = to.split('/')
  const entry = catalogByPath(`/${seg[1]}`)
  if (entry && seg[2]) prefetchDetail(entry, seg[2])
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
})
</script>

<template>
  <!-- 单根节点：HomeView 用 v-reveal 挂在本组件上，多根时指令不会生效（Vue 会告警） -->
  <div class="featured-deck">
    <!-- 装裱：立绘、标本签、座次共处一个 hairline 框（2px 圆角，同全站语言）。
         宽度取 min(栏宽, 高度上限 × 2.36) 并居中：超宽屏不留单侧空档，
         2.36 构图也不会被「铺满栏宽」压成 2.7:1（那会裁掉上下）。 -->
    <div class="deck-frame">
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
              @pointerenter="warmDetail(cards[s]?.to ?? '')"
              @focus="warmDetail(cards[s]?.to ?? '')"
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
                  :img-style="{
                    objectPosition: cards[s]?.pos,
                    transformOrigin: `50% ${cards[s]?.originY}%`,
                    transform: `scale(${cards[s]?.zoom ?? 1})`,
                  }"
                />
              </span>
            </RouterLink>
          </div>
        </div>
      </div>

      <div class="deck-meta">
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
          <span class="mono deck-count" aria-hidden="true">
            {{ String(active + 1).padStart(2, '0') }} / {{ String(count).padStart(2, '0') }}
          </span>
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
     改这里还要同步 useFeaturedAgents 的 DECK_MAX_WIDTH / deckSizes 与 hero-cards.mjs 的档宽。 */
  --deck-max-h: clamp(240px, 48vh, 560px);
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
}

/* 悬停反馈：整幅轻微推近（1.5%）。不加 `.is-active` 限定 —— 拖动中邻卡会部分进画，
   指针落在它上面时同样给反馈；静止时框外的卡本来就悬停不到。 */
@media (hover: hover) {
  .deck-item:hover .deck-figure img {
    scale: 1.015;
    transition: scale var(--t-zoom) var(--ease);
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

  .deck-pager {
    justify-content: space-between;
  }
}
</style>
