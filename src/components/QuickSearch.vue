<script setup lang="ts">
/**
 * QuickSearch — 全局快速检索面板（Ctrl/⌘+K；站头检索钮）。
 * 终端语言：染墨遮罩 + 单一 hairline 框 + 等宽编号陈列；无投影卡片堆叠。
 * 键盘完整可用：↑/↓ 移动、Enter 直达、Esc 关闭；aria-combobox 语义。
 * 结果按类目分组陈列（类目徽标 = catalog no），空查询为四类目快速入口。
 */
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { CATALOG } from '@/domain/catalog'
import { useQuickSearch, useQuickSearchResults } from '@/composables/useQuickSearch'
import HollowImage from '@/components/HollowImage.vue'

const router = useRouter()
const { phase, query, close } = useQuickSearch()
const { results } = useQuickSearchResults()

const active = ref(0)
const listEl = ref<HTMLElement | null>(null)

const visible = computed(() => phase.value === 'open')
const loading = computed(() => phase.value === 'loading')

/** 类目分组陈列：保持 catalog 顺序；每条目附带其组首标记 */
const groups = computed(() => {
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

/** 扁平顺序（键盘导航序 = 视觉序） */
const flat = computed(() => groups.value.flatMap((g) => g.items))

watch(
  () => query.value,
  () => {
    active.value = 0
    scrollActiveIntoView()
  },
)

watch(visible, (v) => {
  if (v) {
    document.documentElement.style.overflow = 'hidden'
    void nextTick(() => document.getElementById('quick-search-input')?.focus())
  } else {
    document.documentElement.style.overflow = ''
    query.value = ''
    active.value = 0
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
  const n = flat.value.length
  if (!n) return
  active.value = (active.value + delta + n) % n
  scrollActiveIntoView()
}

function go(): void {
  const target = flat.value[active.value]
  if (!target) return
  close()
  router.push(target.to)
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
        class="qs-panel"
        role="combobox"
        aria-expanded="true"
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
                <span class="qs-name">{{ r.label }}</span>
                <span class="qs-no mono">{{ r.no }}</span>
              </button>
            </div>
          </template>
          <p v-else class="qs-state mono">无匹配档案 — 调整关键词再试</p>
        </div>

        <p class="qs-foot mono" aria-hidden="true">
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
  z-index: 400;
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

@media (max-width: 640px) {
  .qs-foot {
    display: none;
  }

  .qs-panel {
    max-height: calc(100vh - 120px);
  }
}
</style>
