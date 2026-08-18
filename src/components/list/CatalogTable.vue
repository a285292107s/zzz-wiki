<script setup lang="ts" generic="T extends Record<string, unknown>">
import { computed } from 'vue'
import type { SortDir } from '@/composables/useCatalogSort'

export interface CatalogColumn {
  /** 列键：无对应插槽时直接渲染 row[key] */
  key: string
  label: string
  /** CSS 类（如等宽/右对齐） */
  cls?: string
  align?: 'left' | 'right'
  /** 可排序：值即排序键（与 useCatalogSort 的 key 对齐）；缺省不可排序 */
  sortable?: boolean
}

const props = defineProps<{
  columns: CatalogColumn[]
  items: T[]
  /** 当前排序键（useCatalogSort.sortKey） */
  sort?: string | null
  /** 当前排序方向 */
  sortDir?: SortDir | null
}>()

const emit = defineEmits<{
  (e: 'update:sort', key: string): void
}>()

const withIndex = computed(() => props.columns.some((c) => c.key === 'idx'))
const bodyColumns = computed(() => props.columns.filter((c) => c.key !== 'idx'))

function onHeadClick(c: CatalogColumn) {
  if (c.sortable) emit('update:sort', c.key)
}
</script>

<template>
  <table class="hairline-table">
    <thead>
      <tr>
        <th v-if="withIndex">#</th>
        <th
          v-for="c in bodyColumns"
          :key="c.key"
          :class="[{ r: c.align === 'right' }, { sortable: c.sortable }]"
        >
          <button
            v-if="c.sortable"
            type="button"
            class="sort-btn mono"
            :class="{ active: sort === c.key }"
            :aria-sort="sort === c.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined"
            @click="onHeadClick(c)"
          >
            {{ c.label }}
            <span v-if="sort === c.key" class="sort-arrow" aria-hidden="true">
              {{ sortDir === 'asc' ? '▲' : '▼' }}
            </span>
          </button>
          <template v-else>{{ c.label }}</template>
        </th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(row, i) in items" :key="String(row.Id ?? i)">
        <td v-if="withIndex" class="mono idx">
          {{ String(i + 1).padStart(2, '0') }}
        </td>
        <td
          v-for="c in bodyColumns"
          :key="c.key"
          :class="[c.cls, { r: c.align === 'right' }]"
        >
          <slot :name="`cell-${c.key}`" :row="row" :index="i">
            {{ String(row[c.key] ?? '—') }}
          </slot>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.idx {
  color: var(--ink-3);
  font-size: 12px;
}
.r {
  text-align: right;
}
.sort-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
  color: inherit;
  cursor: pointer;
  transition: color var(--t-fast) var(--ease);
  padding: 0;
  background: none;
  border: none;
}
.sort-btn:hover {
  color: var(--ink-0);
}
.sort-btn.active {
  color: var(--amber-hi);
}
.sort-btn:focus-visible {
  outline: 1px solid var(--amber);
  outline-offset: 2px;
}
.sort-arrow {
  font-size: 10px;
}
th.sortable {
  white-space: nowrap;
}
</style>
