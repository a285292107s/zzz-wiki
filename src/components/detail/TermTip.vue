<script setup lang="ts">
/* ============================================================
 * TermTip — 术语悬停浮层（档案标本风小浮框）。
 * 全局委托监听 document：pointerover/focusin/点击→显示、pointerout/焦点丢失/
 * 滚动/点击卡片以外→隐藏，命中富文本 .rich-term[data-term-id] 后展示名词表 title+desc。
 * - 命中页面名词（不位于任何卡片内）→ 重置为单张卡片；
 * - 点击/悬停卡片内的名词 → 追加一张对齐在宿主卡正下方的新卡（多卡并存，不收起旧卡）；同一名词连续触发不重复追加，避免堆叠；该展开不受“穿越桥”守卫拦截，确保可继续追多级名词。
 * 设计语言对齐：1px 细线框、2px 圆角、纸墨配色、serif 标题；禁霓虹/大投影。
 * ============================================================ */
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { richDesc } from '@/utils/rich'
import { nounDict, type NounEntry } from '@/data/terms'

/** 单张名词悬浮卡片的运行时状态（卡片统一放在 .term-tip-list 容器内文档流堆叠，不再各自 fixed 定位） */
interface Tip {
  id: number
  entry: NounEntry
  /** 触发卡片的页面名词在视口里的矩形（首张卡用于定位整体容器） */
  anchor: { left: number; top: number; width: number; height: number }
  anchorEl: Element
}

/** 卡片列表容器的当前视口矩形（fixed 后 getBoundingClientRect 得出），用于保护区与过渡桥判定 */
interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

const tips = ref<Tip[]>([])
let nextId = 1

/** 卡片列表容器：整体 fixed 定位，卡片在其内部文档流堆叠 */
const listEl = ref<HTMLElement | null>(null)
/** 容器 left/top/maxHeight（由 layoutList 写入，max-height 令超高时内部滚动） */
const listStyle = ref<{ left: string; top: string; maxHeight: string } | undefined>(undefined)
/** 容器当前视口矩形，用于保护区与过渡桥判定 */
const listRect = ref<Box | null>(null)

function bindListEl(el: unknown): void {
  listEl.value = (el as HTMLElement) || null
}

/** 显示延迟：避免划过文本时频繁闪烁 */
const SHOW_DELAY_MS = 120
let showTimer: number | undefined
let hideTimer: number | undefined

/** 单调递增令牌：每次 hide()/新一轮 openTip 自增，令在途的 await 回调失效（防止指针离开后浮层迟滞弹出） */
let session = 0

/**
 * 打开一张卡片。
 * 命中页面名词 → 重置为单张卡片；命中卡片内的名词 → 追加一张对齐在当前卡片正下方的新卡（多卡并存）。
 */
async function openTip(el: Element): Promise<void> {
  const termId = (el as HTMLElement).dataset.termId
  if (!termId) return
  const my = ++session
  clearTimeout(hideTimer)
  clearTimeout(showTimer)
  showTimer = window.setTimeout(async () => {
    const dict = await nounDict()
    // 等待词典期间已 hide 或切到别的术语，丢弃本次陈旧请求
    if (my !== session) return
    const e = dict[termId]
    if (!e?.title && !e?.desc) return
    // 词典已按 dataVersion 取档；若在等待期内切了版本，跳过本次陈旧显示
    const rect = (el as HTMLElement).getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) return // 术语已随路由卸载，避免浮层钉在原点
    const hostCard = el.closest?.('.term-tip') as HTMLElement | null
    if (hostCard) {
      // 悬停/点击卡片内的名词 → 追加一张对齐在当前卡片正下方的新卡（多卡并存，不收起旧卡）。
      // 防重复：最近一张卡已锚定同一名词就不重复追加，避免指针在同一名词上进出时堆出重复卡。
      const last = tips.value[tips.value.length - 1]
      if (last && last.anchorEl === el) return
      tips.value = [...tips.value, { id: nextId++, entry: e, anchor: rect, anchorEl: el }]
    } else {
      // 页面上的名词 → 重置为单张卡片
      tips.value = [{ id: nextId++, entry: e, anchor: rect, anchorEl: el }]
    }
    // 必须先更新 tips 再 nextTick：等卡片真正挂载好，layoutList 才能量到容器尺寸并排布。
    await nextTick()
    layoutList()
  }, SHOW_DELAY_MS)
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

/** 以首张卡的名词为锚，把整体卡片列表容器排布在视口内（fixed 定位）。
 * 容器宽取自其自身 getBoundingClientRect（由 CSS 定宽）；高度由内容撑开并受 max-height 约束，超高内部滚动。 */
function layoutList(): void {
  const el = listEl.value
  if (!el) return
  const first = tips.value[0]
  if (!first) return
  const a = first.anchor
  const pad = 8
  const GAP = 8
  const t = el.getBoundingClientRect()
  const left = clamp(a.left, pad, innerWidth - t.width - pad)
  // 默认放在名词下方；若名词下方空间不足以放整张列表（含首卡），翻到上方
  let top = a.top + a.height + GAP
  if (top + t.height > innerHeight - pad) top = a.top - t.height - GAP
  top = clamp(top, pad, innerHeight - pad)
  // 容器高度上界：从 top 到视口底，超高则容器内部滚动
  const maxH = Math.max(40, innerHeight - top - pad)
  listStyle.value = { left: `${left}px`, top: `${top}px`, maxHeight: `${maxH}px` }
  // 底界取可见范围（受 maxHeight 约束的最小值）：内容超高时 bottom 停在视口内，避免把保护区/桥画到视口之外
  const bottom = Math.min(top + t.height, top + maxH)
  listRect.value = { left, top, right: left + t.width, bottom }
}

function hideAll(): void {
  session++
  clearTimeout(showTimer)
  clearTimeout(hideTimer)
  tips.value = []
}

/* ---------- 「名词→卡片列表」无形过渡桥 ---------- */

/** 射线法：判断点是否落在任意多边形内 */
function pointInPolygon(x: number, y: number, pts: { x: number; y: number }[]): boolean {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]
    const b = pts[j]
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

/** 名词与卡片列表容器之间的过渡桥（梯形）顶点；容器未定位或无名片时返回 null。
 * 上底＝位于上方的矩形底边、下底＝位于下方的矩形顶边，形成「名词→卡片列表」的连接带。 */
function listBridgePolygon(): { x: number; y: number }[] | null {
  if (!listRect.value) return null
  const first = tips.value[0]
  if (!first) return null
  const a = first.anchor
  const ar = { left: a.left, top: a.top, right: a.left + a.width, bottom: a.top + a.height }
  const cr = listRect.value
  const upper = ar.top <= cr.top ? ar : cr
  const lower = upper === ar ? cr : ar
  return [
    { x: upper.left, y: upper.bottom },
    { x: upper.right, y: upper.bottom },
    { x: lower.right, y: lower.top },
    { x: lower.left, y: lower.top },
  ]
}

/** 指针是否落在「卡片列表」整体保护区内——容器矩形 ∪ 触发各卡的名词（动态取各名词矩形）∪ 首卡连接桥。
 * 只要鼠标在列表内（含名词、过渡桥），就不收起任何卡片。 */
function isPointerInCardList(x: number, y: number): boolean {
  const box = listRect.value
  if (!box) return false
  // 1) 卡片列表主体：容器矩形（卡片间隙/内部滚动区一并覆盖）
  if (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) return true
  // 2) 触发各卡的锚点名词
  for (const tip of tips.value) {
    const a = tip.anchor
    if (x >= a.left && x <= a.left + a.width && y >= a.top && y <= a.top + a.height) return true
  }
  // 3) 衔接首卡的名词→容器过渡桥
  return pointInPolygon(x, y, listBridgePolygon() ?? [])
}

/* ---------- 全局事件（委托，富文本经 v-html 注入） ---------- */

let root: Document

/** 目标落在名词或卡片列表容器内部（容器内含全部卡片）为真；进入这类区域不收起浮层，便于进入卡片复制文字 */
function withinNounOrCard(el: Element | null): boolean {
  return !!el && !!(el.closest?.('.rich-term') || el.closest?.('.term-tip-list'))
}

function onPointerOver(e: Event): void {
  const target = (e.target as Element).closest?.('.rich-term')
  if (!target) return
  // 悬停卡片内的名词 → 先行展开其子卡（多卡并存）；卡片内名词位于宿主卡矩形内，须先于此判断，以免被下方“穿越桥”守卫拦截而无法展开。
  if (target.closest?.('.term-tip')) {
    openTip(target)
    return
  }
  // 页面名词：指针仍在「卡片列表」保护区（含过渡桥）内时，不因路过其他页面名词而切换卡片
  const pe = e as PointerEvent
  if (pe.clientX !== 0 || pe.clientY !== 0) {
    if (isPointerInCardList(pe.clientX, pe.clientY)) return
  }
  openTip(target)
}

/** 预约收起：清除既有定时器并重排 60ms 后的收起（配合 pointermove 连续判定离开保护区） */
function scheduleHide(): void {
  clearTimeout(hideTimer)
  hideTimer = window.setTimeout(hideAll, 60)
}

function onPointerOut(e: Event): void {
  const pe = e as PointerEvent
  // 正在穿越「卡片列表」保护区（如刚离开名词、斜向进入卡片途中）不触发收起
  if (typeof pe.clientX === 'number' && isPointerInCardList(pe.clientX, pe.clientY)) return
  if (withinNounOrCard((e as PointerEvent).relatedTarget as Element | null)) return
  scheduleHide()
}

/**
 * 逐帧（移动时）判定是否真正离开了保护区。
 * 过渡桥/卡片列表包围盒是纯几何区域，并非 DOM 元素；离开卡片向上穿出桥、落入同一块技能正文时，
 * 不一定跨过元素边界，pointerout 不会被触发 → 反而不清除。这里靠 pointermove 补齐：
 * 只要指针已不在「卡片列表∪桥∪名词」几何区内，就预约收起。
 */
function onPointerMove(e: PointerEvent): void {
  if (tips.value.length === 0) return
  if (isPointerInCardList(e.clientX, e.clientY)) {
    cancelHide()
    return
  }
  if (!withinNounOrCard(e.target as Element | null)) scheduleHide()
}

function cancelHide(): void {
  clearTimeout(hideTimer)
}

/* 点击：点击名词展示卡片（卡片内名词追加新卡），点击卡片列表容器内部保留，点击其余位置收起全部浮层 */
function onPointerDown(e: Event): void {
  const target = e.target as Element
  const term = target.closest?.('.rich-term')
  if (term) {
    openTip(term)
    return
  }
  if (target.closest?.('.term-tip-list')) return
  hideAll()
}

function onFocusIn(e: Event): void {
  const target = (e.target as Element).closest?.('.rich-term')
  if (!target) return
  openTip(target)
}

function onFocusOut(e: Event): void {
  // 焦点移入名词或卡片内部亦不收起，与指针行为保持一致
  if (withinNounOrCard((e as FocusEvent).relatedTarget as Element | null)) return
  hideAll()
}

function onScroll(e: Event): void {
  // 卡片不跟随名词（容器 fixed 钉视口）。滚动事件经 capture 捕获到：
  // - 滚动源在卡片列表容器内（.tip-desc 长文本或容器超高超出的内部滚动）→ 不收起；
  // - 页面滚动 → 收起（名词已随内容滚走，fixed 卡片脱离上下文，保留无意义）。
  if ((e.target as Element | null)?.closest?.('.term-tip-list')) return
  hideAll()
}

/* 滚动穿透已由 .term-tip-list 的 overscroll-behavior: contain 在 CSS 层解决，无需 wheel 拦截 */

onMounted(() => {
  root = document
  root.addEventListener('pointerover', onPointerOver, { capture: true })
  root.addEventListener('pointerout', onPointerOut, { capture: true })
  root.addEventListener('pointermove', onPointerMove, true)
  root.addEventListener('focusin', onFocusIn, { capture: true })
  root.addEventListener('focusout', onFocusOut, { capture: true })
  root.addEventListener('scroll', onScroll, true)
  root.addEventListener('pointerdown', onPointerDown, true)
})

onBeforeUnmount(() => {
  root?.removeEventListener('pointerover', onPointerOver, { capture: true })
  root?.removeEventListener('pointerout', onPointerOut, { capture: true })
  root?.removeEventListener('pointermove', onPointerMove, true)
  root?.removeEventListener('focusin', onFocusIn, { capture: true })
  root?.removeEventListener('focusout', onFocusOut, { capture: true })
  root?.removeEventListener('scroll', onScroll, true)
  root?.removeEventListener('pointerdown', onPointerDown, true)
  clearTimeout(showTimer)
  clearTimeout(hideTimer)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="tips.length"
      :ref="bindListEl"
      class="term-tip-list"
      :style="listStyle"
      @pointerenter="cancelHide"
    >
      <div v-for="tip in tips" :key="tip.id" class="term-tip" role="status">
        <header v-if="tip.entry?.skill || tip.entry?.title" class="tip-head">
          <p v-if="tip.entry?.skill" class="tip-eyebrow mono">{{ tip.entry.skill }}</p>
          <p v-if="tip.entry?.title" class="tip-title serif">{{ tip.entry.title }}</p>
        </header>
        <p v-if="tip.entry?.desc" class="tip-desc" v-html="richDesc(tip.entry.desc)"></p>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* 卡片列表容器：整体 fixed 钉视口，内部文档流纵向堆叠各卡片；
   超高（列表较长）时在容器内滚动，不再溢出屏幕。 */
.term-tip-list {
  position: fixed;
  z-index: 300;
  /* 由 layoutList 写入 left/top；宽由卡片撑起，与 .term-tip 定宽一致 */
  display: flex;
  flex-direction: column;
  gap: 6px;
  /* max-height 由 layoutList 内联写入：超高时容器内部滚动 */
  overflow-y: auto;
  overflow-x: hidden;
  /* 防止滚动穿透：滚到列表边界时，滚轮不会继续传给页面（不误触发起页面滚动收起卡片） */
  overscroll-behavior: contain;
  pointer-events: auto;
}
/* 单张卡片：在容器内文档流排布，不再各自 fixed */
.term-tip {
  /* 窄屏也不溢出视口 */
  width: min(340px, calc(100vw - 32px));
  flex: none;
  padding: 10px 14px 12px;
  background: var(--bg-1);
  border: 1px solid var(--line-2);
  border-radius: 2px;
  /* 克制纸感：仅极淡投影用于与正文分离，无明显立体感 */
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
  /* 克制进场：极短淡入 + 4px 上浮（自锚点一侧长出）；reduced-motion 由全局规则归零 */
  animation: term-tip-in var(--t-fast) var(--ease);
  /* 允许鼠标进入卡片进行选中/复制等操作 */
  pointer-events: auto;
  user-select: auto;
}
@keyframes term-tip-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
/* 标本档案页眉：来源技能 mono 眉标 + serif 标题，下衬细线分隔正文 */
.tip-head {
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--line-1);
}
.tip-eyebrow {
  margin: 0 0 4px;
  font-family: var(--mono);
  font-size: 10.5px;
  letter-spacing: 0.08em;
  color: var(--ink-2);
}
.tip-title {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--amber);
  line-height: 1.4;
}
.tip-desc {
  margin: 0;
  color: var(--ink-1);
  font-size: 12.5px;
  line-height: 1.75;
  max-height: 60vh;
  overflow: auto;
  white-space: pre-line;
}
.tip-desc :deep(.rich-term) {
  color: var(--ink-0);
}
/* 键位图标内嵌为小键帽（与技能详情 .rich-key 同套样式），不单独成行 */
.tip-desc :deep(.rich-key) {
  display: inline-block;
  width: 1.15em;
  height: 1.15em;
  margin: 0 0.1em;
  vertical-align: -0.22em;
  border-radius: 1px;
  line-height: 0;
}
.tip-desc :deep(.rich-key svg) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>