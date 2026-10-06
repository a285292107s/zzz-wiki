<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { ELEMENTS, PROFESSIONS, type AttrCode, type SpecCode } from '@/domain/enums'
import { elementIconUrl, professionIconUrl, campIconUrl } from '@/domain/filterIcons'
import type { CampFilter } from '@/composables/useCatalogList'

/** 阵营筛选项（由列表页从数据动态提取：数字码 + 展示名） */
export interface CampOption {
  code: number
  name: string
}

const props = withDefaults(
  defineProps<{
    attr?: 'all' | AttrCode
    prof?: 'all' | SpecCode
    camp?: CampFilter
    /** 阵营候选项（列表页数据驱动）；未提供时阵营下拉不渲染 */
    camps?: CampOption[]
    /** 是否渲染属性下拉（默认 true；音擎等无属性概念时设 false） */
    showAttr?: boolean
    /** 是否渲染职业下拉（默认 true） */
    showProf?: boolean
    /** 是否渲染阵营下拉（默认 true；仍受 camps 是否有值约束） */
    showCamp?: boolean
  }>(),
  { showAttr: true, showProf: true, showCamp: true },
)

const emit = defineEmits<{
  (e: 'update:attr', v: 'all' | AttrCode): void
  (e: 'update:prof', v: 'all' | SpecCode): void
  (e: 'update:camp', v: CampFilter): void
}>()

type FilterValue = 'all' | number

interface FilterOption {
  value: FilterValue
  label: string
  iconUrl: string | null
  /** 仅属性有：元素强调色（占位图标用） */
  color?: string
}

interface FilterGroup {
  key: 'attr' | 'prof' | 'camp'
  label: string
  allLabel: string
  current: FilterValue
  options: FilterOption[]
}

const openGroup = ref<string | null>(null)
const rootEl = ref<HTMLElement | null>(null)

const groups = computed<FilterGroup[]>(() => {
  const list: FilterGroup[] = []
  if (props.showAttr) {
    list.push({
      key: 'attr',
      label: '属性',
      allLabel: '全部属性',
      current: props.attr ?? 'all',
      options: [
        { value: 'all', label: '全部属性', iconUrl: null },
        ...Object.entries(ELEMENTS).map(([code, e]) => ({
          value: Number(code),
          label: e.zh,
          iconUrl: elementIconUrl(Number(code) as AttrCode),
          color: e.color,
        })),
      ],
    })
  }
  if (props.showProf) {
    list.push({
      key: 'prof',
      label: '职业',
      allLabel: '全部职业',
      current: props.prof ?? 'all',
      options: [
        { value: 'all', label: '全部职业', iconUrl: null },
        ...Object.entries(PROFESSIONS).map(([code, p]) => ({
          value: Number(code),
          label: p.zh,
          iconUrl: professionIconUrl(Number(code) as SpecCode),
        })),
      ],
    })
  }
  if (props.showCamp && props.camps?.length) {
    list.push({
      key: 'camp',
      label: '阵营',
      allLabel: '全部阵营',
      current: props.camp ?? 'all',
      options: [
        { value: 'all', label: '全部阵营', iconUrl: null },
        ...props.camps.map((c) => ({
          value: c.code,
          label: c.name,
          iconUrl: campIconUrl(c.code),
        })),
      ],
    })
  }
  return list
})

function currentOption(g: FilterGroup): FilterOption | undefined {
  return g.options.find((o) => o.value === g.current)
}

function currentLabel(g: FilterGroup): string {
  return currentOption(g)?.label ?? g.allLabel
}

function toggle(key: string) {
  const opening = openGroup.value !== key
  openGroup.value = opening ? key : null
  if (opening) {
    optionIdx.value = 0 // 打开时活跃项复位到首个选项
    focusActiveOption() // 焦点移入 listbox（WAI-ARIA listbox 模式：打开即可方向键导航）
  }
}

/** 触发器上按 ↓：打开（若未开）并把焦点移入 listbox——原生 select 的肌肉记忆 */
function openAndFocus(key: string) {
  const opening = openGroup.value !== key
  if (opening) openGroup.value = key
  if (opening) optionIdx.value = 0
  focusActiveOption()
}

/** 焦点移到活跃选项（roving tabindex 的当前项）；打开后与方向键移动共用 */
function focusActiveOption(): void {
  void nextTick(() => {
    rootEl.value?.querySelector<HTMLElement>(`.popover [data-oi="${optionIdx.value}"]`)?.focus()
  })
}

/** roving tabindex：活跃选项索引（仅该项 Tab 可达；方向键在选项间移动） */
const optionIdx = ref(0)
function optionActive(key: string, oi: number): boolean {
  return openGroup.value === key && optionIdx.value === oi
}
function moveOption(key: string, delta: number): void {
  const g = groups.value.find((x) => x.key === key)
  if (!g) return
  const n = g.options.length
  optionIdx.value = (optionIdx.value + delta + n) % n
  void nextTick(() => {
    const next = rootEl.value?.querySelector<HTMLElement>(`.popover [data-oi="${optionIdx.value}"]`)
    // scrollIntoView 在 jsdom 等环境缺失：可选调用（焦点移动不因环境差异中断）
    next?.scrollIntoView?.({ block: 'nearest' })
    next?.focus()
  })
}

function select(g: FilterGroup, value: FilterValue) {
  if (g.key === 'attr') emit('update:attr', value as 'all' | AttrCode)
  else if (g.key === 'prof') emit('update:prof', value as 'all' | SpecCode)
  else emit('update:camp', value as CampFilter)
  openGroup.value = null
  // 选择后焦点归还触发钮（选项被卸载，否则焦点落 body——键盘用户丢失位置）。
  // preventScroll：触发钮在页面顶部，不加此参浏览器会把它滚入视野——用户在列表
  // 中段选筛选就被拉回页顶（2026-10 实测：滚到 1200px 选筛选 → scrollY 0）。
  void nextTick(() => {
    rootEl.value?.querySelector<HTMLElement>(`.trigger[data-key="${g.key}"]`)?.focus({ preventScroll: true })
  })
}

/* ---------- 点击外部 / Esc 关闭 ---------- */

function onDocMousedown(e: MouseEvent) {
  if (rootEl.value && !rootEl.value.contains(e.target as Node)) {
    openGroup.value = null
  }
}

function onDocKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && openGroup.value) {
    openGroup.value = null
    const trigger = rootEl.value?.querySelector('.trigger.open') as HTMLElement | null
    trigger?.focus()
  }
}

onMounted(() => {
  document.addEventListener('mousedown', onDocMousedown)
  document.addEventListener('keydown', onDocKeydown)
})
onUnmounted(() => {
  document.removeEventListener('mousedown', onDocMousedown)
  document.removeEventListener('keydown', onDocKeydown)
})
</script>

<template>
  <div ref="rootEl" class="filter-dropdown">
    <div v-for="g in groups" :key="g.key" class="group">
      <button
        type="button"
        class="trigger"
        :data-key="g.key"
        :class="{ open: openGroup === g.key, active: g.current !== 'all' }"
        :aria-haspopup="'listbox'"
        :aria-expanded="openGroup === g.key"
        @click="toggle(g.key)"
        @keydown.arrow-down.prevent="openAndFocus(g.key)"
      >
        <img
          v-if="currentOption(g)?.iconUrl"
          class="opt-ic"
          :src="currentOption(g)!.iconUrl!"
          :alt="currentLabel(g)"
          loading="lazy"
        />
        <svg
          v-else-if="currentOption(g)?.color && g.current !== 'all'"
          class="opt-ic opt-fallback"
          viewBox="0 0 16 16"
          :style="{ '--ph-color': currentOption(g)!.color }"
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="6" fill="none" stroke="var(--ph-color)" stroke-width="2" />
        </svg>
        <span class="trigger-label">{{ currentLabel(g) }}</span>
        <svg class="caret" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" />
        </svg>
      </button>

      <div v-if="openGroup === g.key" class="popover" role="listbox" :aria-label="g.label">
        <button
          v-for="(opt, oi) in g.options"
          :key="String(opt.value)"
          type="button"
          role="option"
          class="opt"
          :class="{ selected: opt.value === g.current }"
          :aria-selected="opt.value === g.current"
          :tabindex="optionActive(g.key, oi) ? 0 : -1"
          :data-oi="oi"
          :style="opt.color ? { '--opt-color': opt.color } : undefined"
          @click="select(g, opt.value)"
          @keydown.arrow-down.prevent="moveOption(g.key, 1)"
          @keydown.arrow-up.prevent="moveOption(g.key, -1)"
        >
          <!-- alt 置空：选项图标是装饰（选项文字紧随其后），再念一遍即冗余朗读（axe image-redundant-alt） -->
          <img v-if="opt.iconUrl" class="opt-ic" :src="opt.iconUrl!" alt="" loading="lazy" />
          <svg
            v-else
            class="opt-ic opt-fallback"
            viewBox="0 0 16 16"
            :style="opt.color ? { '--ph-color': opt.color } : undefined"
            aria-hidden="true"
          >
            <circle
              cx="8"
              cy="8"
              r="6"
              fill="none"
              :stroke="opt.color ? 'var(--ph-color)' : 'var(--ink-2)'"
              stroke-width="2"
            />
          </svg>
          <span class="opt-label">{{ opt.label }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.filter-dropdown {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.group {
  position: relative;
}

.trigger {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 12px;
  border: 1px solid var(--line-1);
  border-radius: 2px;
  background: none;
  color: var(--ink-1);
  font-size: var(--fs-small);
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: all var(--t-fast) var(--ease);
}
/* 触屏无 hover 语义：tap 后的粘滞高亮会让「当前行」与「选中行」混淆，
   悬停反馈统一收进 hover-capable 媒体查询（触屏仅保留 selected 状态） */
@media (hover: hover) {
  .trigger:hover {
    border-color: var(--line-2);
    color: var(--ink-0);
  }
}
.trigger.open {
  border-color: var(--line-2);
  color: var(--ink-0);
}
.trigger.active {
  border-color: var(--amber);
  color: var(--amber-hi);
}
.trigger:focus-visible {
  outline: 1px solid var(--amber);
  outline-offset: 2px;
}

.trigger-label {
  white-space: nowrap;
}

.caret {
  width: 12px;
  height: 12px;
  flex: none;
  opacity: 0.7;
  transition: transform var(--t-fast) var(--ease);
}
.trigger.open .caret {
  transform: rotate(180deg);
}

.opt-ic {
  width: 16px;
  height: 16px;
  object-fit: contain;
  flex: none;
  display: block;
}
.opt-fallback {
  stroke-width: 2;
}

.popover {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: var(--z-nav); /* 与站头同级语义：下拉面板浮于内容之上、被模态遮罩覆盖 */
  min-width: 168px;
  max-height: 320px;
  overflow-y: auto;
  padding: 6px;
  background: var(--bg-2);
  border: 1px solid var(--line-1);
  border-radius: 2px;
  /* 浮层投影统一取 --shadow-pop（与术语浮层同一份，禁止另写值） */
  box-shadow: var(--shadow-pop);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.opt {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 7px 10px;
  border: none;
  background: none;
  color: var(--ink-1);
  font-size: var(--fs-small);
  text-align: left;
  cursor: pointer;
  transition: background var(--t-fast) var(--ease), color var(--t-fast) var(--ease);
}
@media (hover: hover) {
  .opt:hover {
    background: var(--bg-3);
    color: var(--ink-0);
  }
}
.opt.selected {
  color: var(--ink-0);
  background: var(--amber-dim);
}
.opt-label {
  flex: 1;
  white-space: nowrap;
}

/* 窄屏：多个下拉并排时最右侧弹层会伸出视口右缘（popover 自 trigger 左缘展开）；
   非首组改右对齐展开（右缘贴齐 trigger），宽度亦受视口约束 */
@media (max-width: 720px) {
  .popover {
    max-width: calc(100vw - 28px);
  }

  .group:not(:first-child) .popover {
    left: auto;
    right: 0;
  }
}
</style>
