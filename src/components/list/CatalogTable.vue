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

const bodyColumns = computed(() => props.columns.filter((c) => c.key !== 'idx'))

/* ---------- 移动端堆叠行（<721px）：主体列 + 尾列(右对齐列优先) + 其余列 meta 行 ---------- */

/** 主体列 = 首个非 idx 列（各名录页均为名称列，作主显示格） */
const mainColumn = computed(() => bodyColumns.value[0] ?? null)

/** 右格列：存在右对齐列（稀有度）时取它，否则取末列 */
const rightColumn = computed(() =>
  bodyColumns.value.find((c) => c.align === 'right') ??
  (bodyColumns.value.length > 1 ? bodyColumns.value[bodyColumns.value.length - 1] : null),
)

/** meta 行列：主体列与右格列之外的中间列（属性/职业/阵营/代号等） */
const metaColumns = computed(() =>
  bodyColumns.value.filter((c) => c !== mainColumn.value && c !== rightColumn.value),
)

function onHeadClick(c: CatalogColumn) {
  if (c.sortable) emit('update:sort', c.key)
}
</script>

<template>
  <table class="hairline-table">
    <thead>
      <tr>
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
    <tbody class="d-body">
      <tr v-for="(row, i) in items" :key="String(row.Id ?? i)">
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

    <!-- 移动端堆叠行：主体列（名称）整格 + 右格（稀有度，可排序）+ 其余列 meta 行。
         与桌面 tbody 共享同一批 cell-* 插槽（同一 slot 两处引用，CSS 断点互斥显示） -->
    <tbody class="m-body">
      <template v-for="(row, i) in items" :key="String(row.Id ?? i)">
        <tr class="m-row">
          <td v-if="mainColumn" class="m-main">
            <slot :name="`cell-${mainColumn.key}`" :row="row" :index="i">
              {{ String(row[mainColumn.key] ?? '—') }}
            </slot>
          </td>
          <td v-if="rightColumn" class="m-right">
            <!-- 右格可排序时整格为排序钮（稀有度等）；触屏无 hover，常态显示 ↕ 提示。
                 方向信息放 aria-label（aria-sort 仅 columnheader/rowheader 合法，button 上会被辅助技术忽略） -->
            <button
              v-if="rightColumn.sortable"
              type="button"
              class="m-sort"
              :class="{ active: sort === rightColumn.key }"
              :aria-label="sort === rightColumn.key
                ? `按${rightColumn.label}排序，当前${sortDir === 'asc' ? '升序' : '降序'}`
                : `按${rightColumn.label}排序`"
              :aria-pressed="sort === rightColumn.key"
              @click="onHeadClick(rightColumn)"
            >
              <slot :name="`cell-${rightColumn.key}`" :row="row" :index="i">
                {{ String(row[rightColumn.key] ?? '—') }}
              </slot>
              <span class="sort-arrow" aria-hidden="true">
                {{ sort === rightColumn.key ? (sortDir === 'asc' ? '▲' : '▼') : '↕' }}
              </span>
            </button>
            <slot v-else :name="`cell-${rightColumn.key}`" :row="row" :index="i">
              {{ String(row[rightColumn.key] ?? '—') }}
            </slot>
          </td>
        </tr>
        <tr v-if="metaColumns.length" class="m-meta-row">
          <td class="m-meta">
            <span v-for="c in metaColumns" :key="c.key" class="m-cell" :class="c.cls">
              <slot :name="`cell-${c.key}`" :row="row" :index="i">
                {{ String(row[c.key] ?? '—') }}
              </slot>
            </span>
          </td>
        </tr>
      </template>
    </tbody>
  </table>
</template>

<style scoped>
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
  outline: 1px solid var(--focus);
  outline-offset: 2px;
}
.sort-arrow {
  font-size: var(--fs-nano);
}
th.sortable {
  white-space: nowrap;
}

/* ---------- 移动端（<721px）：表格退化为堆叠行 ----------
   桌面列全保留，仅换排布；不引入卡片/投影，延续细线行语言 */
.m-body {
  display: none;
}

@media (max-width: 720px) {
  .d-body,
  thead {
    display: none;
  }

  .m-body {
    display: block;
  }

  /* 主体行：名称 + 右格稀有度，一行两格 */
  .m-row {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 12px;
    padding: 11px 4px;
    border-bottom: var(--rule);
  }

  .m-main {
    min-width: 0;
  }

  .m-right {
    display: flex;
    justify-content: flex-end;
  }

  .m-sort {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 2px 0;
    border: none;
    background: none;
    font: inherit;
    color: inherit;
    cursor: pointer;
    transition: opacity var(--t-fast) var(--ease);
  }

  .m-sort:focus-visible {
    outline: 1px solid var(--focus);
    outline-offset: 2px;
  }

  .m-sort .sort-arrow {
    font-size: var(--fs-nano);
    color: var(--ink-3);
  }

  .m-sort.active .sort-arrow {
    color: var(--amber);
  }

  /* meta 行：中间列 inline 排布（属性/职业/阵营标签等），组内不再有分隔线 */
  .m-meta-row td {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 16px;
    padding: 0 4px 12px;
  }

  .m-cell {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
}
</style>
