<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
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
  openGroup.value = openGroup.value === key ? null : key
}

function select(g: FilterGroup, value: FilterValue) {
  if (g.key === 'attr') emit('update:attr', value as 'all' | AttrCode)
  else if (g.key === 'prof') emit('update:prof', value as 'all' | SpecCode)
  else emit('update:camp', value as CampFilter)
  openGroup.value = null
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
        :class="{ open: openGroup === g.key, active: g.current !== 'all' }"
        :aria-haspopup="'listbox'"
        :aria-expanded="openGroup === g.key"
        @click="toggle(g.key)"
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
          v-for="opt in g.options"
          :key="String(opt.value)"
          type="button"
          role="option"
          class="opt"
          :class="{ selected: opt.value === g.current }"
          :aria-selected="opt.value === g.current"
          :style="opt.color ? { '--opt-color': opt.color } : undefined"
          @click="select(g, opt.value)"
        >
          <img v-if="opt.iconUrl" class="opt-ic" :src="opt.iconUrl!" :alt="opt.label" loading="lazy" />
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
  font-size: 13px;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: all var(--t-fast) var(--ease);
}
.trigger:hover {
  border-color: var(--line-2);
  color: var(--ink-0);
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
  z-index: 20;
  min-width: 168px;
  max-height: 320px;
  overflow-y: auto;
  padding: 6px;
  background: var(--bg-2);
  border: 1px solid var(--line-1);
  border-radius: 2px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
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
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background var(--t-fast) var(--ease), color var(--t-fast) var(--ease);
}
.opt:hover {
  background: var(--bg-3);
  color: var(--ink-0);
}
.opt.selected {
  color: var(--ink-0);
  background: var(--amber-dim);
}
.opt-label {
  flex: 1;
  white-space: nowrap;
}
</style>
