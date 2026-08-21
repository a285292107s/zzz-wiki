<script setup lang="ts">
/* ============================================================
 * TermTip — 术语悬停浮层（档案标本风小浮框）。
 * 全局委托监听 document 上的 pointerover/focusin→显示、pointerout/焦点丢失/
 * 滚动/点击→隐藏，命中富文本 .rich-term[data-term-id] 后展示名词表 title+desc。
 * 设计语言对齐：1px 细线框、2px 圆角、纸墨配色、serif 标题；禁霓虹/大投影。
 * ============================================================ */
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { richDesc } from '@/utils/rich'
import { nounDict, type NounEntry } from '@/data/terms'

const open = ref(false)
const entry = ref<NounEntry | undefined>(undefined)

/** 术语元素在视口内的矩形，作为浮层锚点（而非鼠标指针，扫描术语时浮层保持稳定） */
const anchor = ref({ left: 0, top: 0, width: 0, height: 0 })

/** 显示延迟：避免划过文本时频繁闪烁 */
const SHOW_DELAY_MS = 120
let showTimer: number | undefined
let hideTimer: number | undefined

/** 单调递增令牌：每次 hide()/新一轮 tryShow 自增，令在途的 await 回调失效（防止指针离开后浮层迟滞弹出） */
let session = 0

async function tryShow(el: Element): Promise<void> {
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
    entry.value = e
    anchor.value = rect
    open.value = true
    // 必须先置 open 再 nextTick：等浮层真正挂载好，requestPosition 才能量到尺寸并排布。
    // 若先 nextTick 再 open，此时 tooltipEl 尚为 null，定位会跳过，浮层滞留左上角。
    await nextTick()
    requestPosition()
  }, SHOW_DELAY_MS)
}

function hide(): void {
  session++
  clearTimeout(showTimer)
  clearTimeout(hideTimer)
  open.value = false
}

/* ---------- 定位 ---------- */

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

/** 以术语为锚排布浮层的 style（固定定位；tooltipEl 挂到 body，定位不受裁剪影响） */
function requestPosition(): void {
  const tip = tooltipEl.value
  if (!tip) return
  const t = tip.getBoundingClientRect()
  const a = anchor.value
  const GAP = 8
  const pad = 8
  // 水平：水平居中于术语，越界时收进视口
  const left = clamp(a.left + a.width / 2 - t.width / 2, pad, innerWidth - t.width - pad)
  // 垂直：优先放在术语下方，下方放不下则翻到上方
  let top = a.bottom + GAP
  if (top + t.height > innerHeight - pad) top = a.top - t.height - GAP
  if (top < pad) top = pad
  style.value = { left: `${left}px`, top: `${top}px` }
}

const tooltipEl = ref<HTMLElement | null>(null)
const style = ref({ left: '0px', top: '0px' })

/* ---------- 全局事件（委托，富文本经 v-html 注入） ---------- */

let root: Document

function onPointerOver(e: Event): void {
  const target = (e.target as Element).closest?.('.rich-term')
  if (!target) return
  tryShow(target)
}

function onPointerOut(e: Event): void {
  const next = (e as PointerEvent).relatedTarget as Element | null
  if (next && next.closest?.('.rich-term')) return
  hideTimer = window.setTimeout(hide, 60)
}

function onFocusIn(e: Event): void {
  const target = (e.target as Element).closest?.('.rich-term')
  if (!target) return
  tryShow(target)
}

function onFocusOut(e: Event): void {
  const next = (e as FocusEvent).relatedTarget as Element | null
  if (next && next.closest?.('.rich-term')) return
  hide()
}

function onScroll(): void {
  if (open.value) hide()
}

onMounted(() => {
  root = document
  root.addEventListener('pointerover', onPointerOver, { capture: true })
  root.addEventListener('pointerout', onPointerOut, { capture: true })
  root.addEventListener('focusin', onFocusIn, { capture: true })
  root.addEventListener('focusout', onFocusOut, { capture: true })
  root.addEventListener('scroll', onScroll, true)
  root.addEventListener('pointerdown', hide, true)
})

onBeforeUnmount(() => {
  root?.removeEventListener('pointerover', onPointerOver, { capture: true })
  root?.removeEventListener('pointerout', onPointerOut, { capture: true })
  root?.removeEventListener('focusin', onFocusIn, { capture: true })
  root?.removeEventListener('focusout', onFocusOut, { capture: true })
  root?.removeEventListener('scroll', onScroll, true)
  root?.removeEventListener('pointerdown', hide, true)
  clearTimeout(showTimer)
  clearTimeout(hideTimer)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      ref="tooltipEl"
      class="term-tip"
      role="status"
      :style="style"
    >
      <p v-if="entry?.title" class="tip-title serif">{{ entry.title }}</p>
      <p v-if="entry?.desc" class="tip-desc" v-html="richDesc(entry.desc)"></p>
    </div>
  </Teleport>
</template>

<style scoped>
.term-tip {
  position: fixed;
  z-index: 300;
  max-width: 340px;
  padding: 10px 12px 12px;
  background: var(--bg-1);
  border: 1px solid var(--line-2);
  border-radius: 2px;
  /* 克制纸感：仅极淡投影用于与正文分离，无明显立体感 */
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
  pointer-events: none;
  user-select: none;
}
.tip-title {
  margin: 0 0 6px;
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