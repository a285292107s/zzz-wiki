<script setup lang="ts" generic="T extends Record<string, unknown>">
import { computed } from 'vue'

export interface CatalogColumn {
  /** 列键：无对应插槽时直接渲染 row[key] */
  key: string
  label: string
  /** CSS 类（如等宽/右对齐） */
  cls?: string
  align?: 'left' | 'right'
}

const props = defineProps<{
  columns: CatalogColumn[]
  items: T[]
}>()

const withIndex = computed(() => props.columns.some((c) => c.key === 'idx'))
const bodyColumns = computed(() => props.columns.filter((c) => c.key !== 'idx'))
</script>

<template>
  <table class="hairline-table">
    <thead>
      <tr>
        <th v-if="withIndex">#</th>
        <th
          v-for="c in bodyColumns"
          :key="c.key"
          :class="{ r: c.align === 'right' }"
        >
          {{ c.label }}
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
</style>