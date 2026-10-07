<script setup lang="ts">
/**
 * 名录工具栏的排序钮（栅格名录页共用）：点击在 升序 → 降序 → 回到默认 三态间循环
 * （useCatalogSort.toggle 的同名语义）。键与方向都写进 URL，故这里只负责呈现与发事件。
 *
 * 方向字形用 aria-hidden 的箭头表示，另以 sr-only 文本补足「当前升序/降序」；
 * 不设 aria-label（会让可访问名与可见文本不一致，触发 label-content-name-mismatch）。
 */
import type { SortDir } from '@/composables/useCatalogSort'

const props = defineProps<{
  label: string
  /** 该键是否为当前排序键 */
  active?: boolean
  /** 当前方向（active 时才有意义） */
  dir?: SortDir | null
}>()

const emit = defineEmits<{ (e: 'toggle'): void }>()

const dirText = () => (props.dir === 'asc' ? '，当前升序' : '，当前降序')
</script>

<template>
  <button
    type="button"
    class="sort-btn mono"
    :class="{ on: active }"
    :aria-pressed="!!active"
    @click="emit('toggle')"
  >
    {{ label }}
    <template v-if="active">
      <span class="sort-arrow" aria-hidden="true">{{ dir === 'asc' ? '▲' : '▼' }}</span>
      <span class="sr-only">{{ dirText() }}</span>
    </template>
  </button>
</template>

<style scoped>
.sort-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-caption);
  letter-spacing: 0.14em;
  color: var(--ink-2);
  border: 1px solid var(--line-1);
  border-radius: 2px;
  padding: 6px 12px;
  transition: color var(--t-fast) var(--ease),
    border-color var(--t-fast) var(--ease),
    background var(--t-fast) var(--ease);
}

@media (hover: hover) {
  .sort-btn:hover {
    color: var(--ink-0);
    border-color: var(--line-2);
  }
}

.sort-btn.on {
  color: var(--amber-hi);
  border-color: var(--amber);
  background: var(--amber-dim);
}

.sort-btn:focus-visible {
  outline: 1px solid var(--focus);
  outline-offset: 2px;
}

.sort-arrow {
  font-size: var(--fs-nano);
}
</style>
