<script setup lang="ts">
/**
 * QuickSearch — 全局快速检索面板（Ctrl/⌘+K；站头检索钮）。
 * 终端语言：染墨遮罩 + 单一 hairline 框 + 等宽编号陈列；无投影卡片堆叠。
 * 键盘完整可用：↑/↓ 移动、Enter 直达、Esc 关闭；aria-combobox 语义。
 * 结果按类目分组陈列（类目徽标 = catalog no），空查询为四类目快速入口。
 */
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { CATALOG } from '@/domain/catalog'
import { highlightSegments } from '@/domain/search'
import { useQuickSearch, useQuickSearchResults, useRecentItems } from '@/composables/useQuickSearch'
import HollowImage from '@/components/HollowImage.vue'

const router = useRouter()
const { phase, query, close } = useQuickSearch()
const { results, overflow } = useQuickSearchResults()
const recent = useRecentItems()

const active = ref(0)
const listEl = ref<HTMLElement | null>(null)
const panelEl = ref<HTMLElement | null>(null)

const visible = computed(() => phase.value === 'open')
const loading = computed(() => phase.value === 'loading')

/** 高亮分段（缓存于条目，避免模板内重复计算） */
const hlCache = computed(() => {
  const map = new Map<string, Array<{ text: string; hit: boolean }>>()
  for (const r of results.value) map.set(r.to, highlightSegments(r.label, query.value))
  return map
})

function segs(label: string, to: string) {
  return hlCache.value.get(to) ?? [{ text: label, hit: false }]
}

/** 类目分组陈列：保持 catalog 顺序。空查询（快速入口态）不分组陈列全部条目——
 *  展示「最近访问 + 提示」，键入后才进入结果态。 */
const groups = computed(() => {
  if (!query.value.trim()) return []
  const byCat = new Map<string, typeof results.value>()
  for (const r of results.value) {
    const arr = byCat.get(r.catPath)
    if (arr) arr.push(r)
    else byCat.set(r.catPath, [r])
  }
  return CATALOG.filter((c) => byCat.has(c.path)).map((c) => ({
    no: c.no,
    label: c.label,
    en: c.en,
    items: byCat.get(c.path)!,
  }))
})

/** 空查询快速入口：四类目直达（取代全量陈列） */
const quickEntries = computed(() =>
  CATALOG.map((c) => ({ no: c.no, label: c.label, en: c.en, to: c.path })),
)

/** 扁平顺序（键盘导航序 = 视觉序） */
const flat = computed(() => groups.value.flatMap((g) => g.items))

watch(
  () => query.value,
  () => {
    active.value = 0
    scrollActiveIntoView()
  },
)

/** 唤起元素：关闭时归还焦点（面板可从站头按钮或 Ctrl+K 打开） */
let opener: HTMLElement | null = null

/** 焦点圈定：Tab 循环限制在面板内部（遮罩后的底层页面对键盘不可达） */
function trapFocus(e: KeyboardEvent): void {
  if (e.key !== 'Tab') return
  const panel = panelEl.value
  if (!panel) return
  const focusables = Array.from(
    panel.querySelectorAll<HTMLElement>('input, button:not([disabled]), [href]'),
  ).filter((el) => el.offsetParent !== null)
  if (!focusables.length) return
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  const cur = document.activeElement
  if (e.shiftKey && (cur === first || !panel.contains(cur))) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && (cur === last || !panel.contains(cur))) {
    e.preventDefault()
    first.focus()
  }
}

watch(visible, (v) => {
  if (v) {
    opener = document.activeElement as HTMLElement | null
    document.documentElement.style.overflow = 'hidden'
    document.addEventListener('keydown', trapFocus, true)
    void nextTick(() => document.getElementById('quick-search-input')?.focus())
  } else {
    document.documentElement.style.overflow = ''
    document.removeEventListener('keydown', trapFocus, true)
    query.value = ''
    active.value = 0
    // 焦点归还：唤起时记录的元素仍在文档中才归还（路由跳转后 opener 已卸载则跳过）
    if (opener && document.contains(opener)) opener.focus()
    opener = null
  }
})

function scrollActiveIntoView(): void {
  void nextTick(() => {
    listEl.value
      ?.querySelector(`[data-idx="${active.value}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  })
}

function move(delta: number): void {
  // 扁平导航序 = [recent(负序，仅空查询时) ...] + results；wrap 环形移动
  const nRes = flat.value.length
  const nRec = query.value ? 0 : recent.value.length
  const total = nRes + nRec
  if (!total) return
  const pos = active.value < 0 ? nRes + (-1 - active.value) : active.value
  const next = (pos + delta + total) % total
  active.value = next < nRes ? next : -1 - (next - nRes)
  scrollActiveIntoView()
}

function go(): void {
  // 键盘 Enter：负数索引命中 recent 区
  if (active.value < 0) {
    const r = recent.value[-1 - active.value]
    if (r) goRecent(r)
    return
  }
  const target = flat.value[active.value]
  if (!target) return
  close()
  router.push(target.to)
}

/** 最近访问行导航（active 负数索引 = recent 区，键盘与指针同路） */
function goRecent(r: { to: string }): void {
  close()
  router.push(r.to)
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    move(1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    move(-1)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    go()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    close()
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="qs-scrim" @pointerdown.self="close()">
      <div
        ref="panelEl"
        class="qs-panel"
        role="dialog"
        aria-modal="true"
        aria-label="快速检索"
        aria-controls="quick-search-listbox"
      >
        <div class="qs-bar">
          <span class="mono qs-mark">⌕</span>
          <input
            id="quick-search-input"
            v-model="query"
            type="text"
            class="qs-input"
            placeholder="检索代理人 / 音擎 / 邦布 / 驱动盘…"
            aria-label="检索档案"
            autocomplete="off"
            spellcheck="false"
            @keydown="onKeydown"
          />
          <button type="button" class="qs-esc mono" aria-label="关闭检索" @click="close()">ESC</button>
        </div>

        <!-- 命中规模实时提示（aria-live 让辅助技术感知结果集变化） -->
        <p v-if="!loading && query.trim() && results.length" class="qs-count mono" aria-live="polite">
          {{ results.length }} 条档案
        </p>

        <div v-if="loading" class="qs-state mono" role="status">索引构建中…</div>

        <div v-else id="quick-search-listbox" ref="listEl" class="qs-list" role="listbox" aria-label="检索结果">
          <template v-if="flat.length">
            <div v-for="g in groups" :key="g.en" class="qs-group">
              <p class="qs-group-head mono">
                <span class="g-no">{{ g.no }}</span>
                <span class="g-label">{{ g.label }}</span>
                <span class="g-en">{{ g.en }}</span>
              </p>
              <button
                v-for="r in g.items"
                :key="r.to"
                type="button"
                role="option"
                class="qs-row"
                :class="{ on: flat[active]?.to === r.to }"
                :data-idx="flat.indexOf(r)"
                :aria-selected="flat[active]?.to === r.to"
                @pointerenter="active = flat.indexOf(r)"
                @click="go()"
              >
                <span class="qs-ic">
                  <HollowImage :srcs="r.srcs" :alt="r.label" :fallback="r.label" fit="contain" />
                </span>
                <span class="qs-name">
                  <template v-for="(s, si) in segs(r.label, r.to)" :key="si">
                    <mark v-if="s.hit" class="qs-hit">{{ s.text }}</mark>
                    <template v-else>{{ s.text }}</template>
                  </template>
                </span>
                <span class="qs-no mono">{{ r.no }}</span>
              </button>
            </div>
          </template>
          <template v-else-if="!query.trim()">
            <div v-if="recent.length" class="qs-group">
              <p class="qs-group-head mono">
                <span class="g-no">↺</span>
                <span class="g-label">最近访问</span>
                <span class="g-en">RECENT</span>
              </p>
              <button
                v-for="(r, ri) in recent"
                :key="r.to"
                type="button"
                class="qs-row"
                :class="{ on: active === -1 - ri }"
                :data-idx="-1 - ri"
                @pointerenter="active = -1 - ri"
                @click="goRecent(r)"
              >
                <span class="qs-ic qs-ic-blank mono">↺</span>
                <span class="qs-name">{{ r.label }}</span>
                <span class="qs-no mono">{{ r.catNo }}</span>
              </button>
            </div>
            <p class="qs-state qs-state-quiet mono" :class="{ 'qs-state-first': !recent.length }">
              输入关键词检索全部档案，或直达：
            </p>
            <div class="qs-quick-entries">
              <RouterLink
                v-for="q in quickEntries"
                :key="q.to"
                :to="q.to"
                class="qs-entry"
                @click="close()"
              >
                <span class="g-no mono">{{ q.no }}</span>
                <span class="qe-label">{{ q.label }}</span>
                <span class="qe-en mono">{{ q.en }}</span>
              </RouterLink>
            </div>
          </template>
          <p v-else-if="!query" class="qs-state mono">输入关键词检索全部档案</p>
          <p v-else class="qs-state mono">无匹配档案 — 调整关键词再试</p>
        </div>

        <p class="qs-foot mono" aria-hidden="true">
          <template v-if="overflow > 0">
            <span class="foot-overflow">共 {{ overflow + results.length }} 条命中，仅列前 {{ results.length }} — 精确关键词</span>
            <span class="sep">·</span>
          </template>
          <span>↑↓ 移动</span><span class="sep">·</span><span>ENTER 直达</span><span class="sep">·</span><span>ESC 关闭</span>
        </p>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.qs-scrim {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  background: color-mix(in srgb, var(--bg-0) 78%, transparent);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: clamp(48px, 12vh, 140px) var(--pad-page) 24px;
}

.qs-panel {
  width: min(640px, 100%);
  background: var(--bg-1);
  background-image: var(--paper-noise);
  border: 1px solid var(--line-2);
  border-radius: 2px;
  box-shadow: var(--shadow-pop);
  display: flex;
  flex-direction: column;
  max-height: min(560px, calc(100vh - 140px));
  overflow: hidden;
}

/* ---------- 输入条 ---------- */

.qs-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: var(--rule);
}

.qs-mark {
  color: var(--amber);
  font-size: var(--fs-lead);
}

.qs-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: var(--ink-0);
  font-size: var(--fs-lead);
  font-family: var(--sans);
  letter-spacing: 0.02em;
  min-width: 0;
}

.qs-input::placeholder {
  color: var(--ink-3);
}

.qs-esc {
  flex: none;
  font-size: var(--fs-nano);
  letter-spacing: 0.14em;
  color: var(--ink-3);
  border: 1px solid var(--line-1);
  border-radius: 2px;
  padding: 3px 7px;
  background: none;
  cursor: pointer;
  transition: color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease);
}

/* 命中规模：检索条下缘的等宽小字，档案终端的「命中 N 条」读数 */
.qs-count {
  padding: 7px 14px 0;
  font-size: var(--fs-nano);
  letter-spacing: 0.2em;
  color: var(--ink-3);
}

@media (hover: hover) {
  .qs-esc:hover {
    color: var(--ink-1);
    border-color: var(--line-2);
  }
}

/* ---------- 结果陈列 ---------- */

.qs-list {
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 6px 0 10px;
}

.qs-group + .qs-group {
  margin-top: 10px;
}

.qs-group-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 8px 14px 5px;
  font-size: var(--fs-nano);
  letter-spacing: 0.18em;
}

.qs-group-head .g-no {
  color: var(--amber);
}

.qs-group-head .g-label {
  color: var(--ink-1);
  letter-spacing: 0.3em;
}

.qs-group-head .g-en {
  color: var(--ink-3);
  letter-spacing: 0.22em;
}

.qs-row {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  padding: 7px 14px;
  border: none;
  background: none;
  color: inherit;
  text-align: left;
  cursor: pointer;
  font: inherit;
}

/* 激活行：bg-3 + 左缘琥珀标线（与名录行/伤害表 hover 同力道） */
.qs-row.on {
  background: var(--bg-3);
}

.qs-row.on .qs-name {
  color: var(--amber-hi);
}

.qs-ic {
  width: 30px;
  height: 30px;
  flex: none;
}

.qs-ic :deep(.frame) {
  border-radius: 2px;
}

.qs-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--fs-md);
  color: var(--ink-0);
  transition: color var(--t-fast) var(--ease);
}

.qs-no {
  flex: none;
  font-size: var(--fs-nano);
  letter-spacing: 0.16em;
  color: var(--ink-3);
}

/* 命中标记：琥珀细线下注（无浏览器默认 mark 黄底），终端「命中高亮」语义 */
mark.qs-hit {
  background: none;
  color: var(--amber-hi);
  border-bottom: 1px solid var(--amber);
  padding: 0 0 1px;
}

/* recent 行的图标占位（无图标资产，等宽符号保持行律） */
.qs-ic-blank {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--line-0);
  border-radius: 2px;
  color: var(--ink-3);
  font-size: var(--fs-caption);
}

.qs-state-quiet {
  padding-top: 18px;
  padding-bottom: 10px;
  color: var(--ink-3);
}

.qs-state-first {
  padding-top: 40px;
  padding-bottom: 14px;
}

/* 空查询快速入口：四类目直达行（细线行语言，无卡片） */
.qs-quick-entries {
  padding: 0 8px 12px;
}

.qs-entry {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 9px 8px;
  text-decoration: none;
  color: inherit;
  border-bottom: 1px solid var(--line-0);
  transition: background var(--t-fast) var(--ease);
}

@media (hover: hover) {
  .qs-entry:hover {
    background: var(--bg-3);
  }
}

.qs-entry .qe-label {
  flex: 1;
  font-family: var(--serif);
  font-size: var(--fs-md);
  color: var(--ink-0);
}

.qs-entry .qe-en {
  font-size: var(--fs-nano);
  letter-spacing: 0.2em;
  color: var(--ink-3);
}

/* ---------- 状态与脚注 ---------- */

.qs-state {
  padding: 34px 14px;
  text-align: center;
  font-size: var(--fs-caption);
  letter-spacing: 0.18em;
  color: var(--ink-2);
}

.qs-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 8px 14px;
  border-top: var(--rule);
  font-size: var(--fs-nano);
  letter-spacing: 0.16em;
  color: var(--ink-3);
}

.qs-foot .sep {
  color: var(--amber);
}

.foot-overflow {
  color: var(--ink-2);
}

@media (max-width: 640px) {
  .qs-foot {
    display: none;
  }

  .qs-panel {
    max-height: calc(100vh - 120px);
  }
}
</style>
