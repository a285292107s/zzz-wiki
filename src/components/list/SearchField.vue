<script setup lang="ts">
defineProps<{
  modelValue: string
  count?: number
  placeholder?: string
}>()

const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()
</script>

<template>
  <div class="search">
    <span class="mono q-mark">⌕</span>
    <input
      :value="modelValue"
      type="search"
      :placeholder="placeholder ?? '检索…'"
      :aria-label="placeholder ?? '检索'"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <span v-if="count != null" class="mono count">{{ count }}</span>
  </div>
</template>

<style scoped>
.search {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--line-1);
  padding: 6px 12px;
  border-radius: 2px;
  min-width: 240px;
}
.search:focus-within {
  border-color: var(--line-2);
}
.q-mark {
  color: var(--ink-2);
  font-size: var(--fs-body);
}
.search input {
  background: none;
  border: none;
  outline: none;
  width: 100%;
  font-size: var(--fs-md);
  color: var(--ink-0);
}
.search input::placeholder {
  color: var(--ink-3);
}

/* 移动端：iOS Safari 对字号 <16px 的 input 聚焦时会强制缩放页面，
   搜索框是高频交互，须保持在 16px 以上（桌面继续 14px 紧凑排布）。
   断点取 860：iPad 竖屏（768px）同样属 iOS，会触发聚焦缩放 */
@media (max-width: 860px) {
  .search input {
    font-size: 16px;
  }
}
.count {
  font-size: var(--fs-caption);
  color: var(--ink-2);
}
</style>
