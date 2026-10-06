<script setup lang="ts">
defineProps<{
  modelValue: string
  count?: number
  placeholder?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
  /** Ctrl/⌘+K 升级到全局检索（SearchField 自身只搜本名录） */
  (e: 'escalate'): void
}>()
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
      @keydown.ctrl.k.prevent="emit('escalate')"
      @keydown.meta.k.prevent="emit('escalate')"
    />
    <span v-if="count != null" class="mono count" role="status">{{ count }}</span>
    <span class="mono escalate" title="全局检索" aria-hidden="true">⌘K</span>
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
/* 聚焦指示：整框转琥珀（与全站 :focus-visible 焦点环同语言）。
   原先只把边框从 --line-1(#2a3137) 提到 --line-2(#3d454c)——深底上几乎不可辨，
   而输入框自身 outline: none，等于键盘用户看不到焦点落在哪（2026-10 焦点可见性
   逐 Tab 位审计发现：全站唯一无可见指示的停靠点）。 */
.search:focus-within {
  border-color: var(--focus);
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

/* 升级提示：悬停/聚焦浮现的 ⌘K 小标（暗示本框可升级到全局检索） */
.escalate {
  font-size: var(--fs-badge);
  letter-spacing: 0.08em;
  color: var(--ink-3);
  border: 1px solid var(--line-0);
  border-radius: 2px;
  padding: 1px 4px;
  opacity: 0;
  transition: opacity var(--t-fast) var(--ease);
  flex: none;
}

.search:focus-within .escalate {
  opacity: 1;
}

@media (hover: hover) {
  .search:hover .escalate {
    opacity: 1;
  }
}

@media (max-width: 860px) {
  .escalate {
    display: none;
  }
}
</style>
