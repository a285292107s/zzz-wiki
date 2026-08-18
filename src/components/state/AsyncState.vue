<script setup lang="ts">
import { computed } from 'vue'
import type { AsyncStatus } from '@/composables/useAsyncResource'

const props = defineProps<{
  status: AsyncStatus | string
  error?: string | null
  empty?: boolean
  emptyText?: string
  loadingText?: string
}>()

const showEmpty = computed(() => props.empty === true)
</script>

<template>
  <p v-if="status === 'loading' || status === 'idle'" class="state loading mono" role="status">
    <slot name="skeleton">
      {{ loadingText ?? 'LOADING…' }}
    </slot>
  </p>
  <p v-else-if="status === 'error'" class="state err mono" role="alert">
    ⚠ 数据加载失败：{{ error }}
  </p>
  <p v-else-if="showEmpty" class="state empty mono">
    {{ emptyText ?? 'NO RECORDS' }}
  </p>
  <slot v-else />
</template>

<style scoped>
.state {
  font-size: 12.5px;
  letter-spacing: 0.2em;
  padding: 40px 0;
}
.loading,
.empty {
  color: var(--ink-2);
}
.err {
  color: var(--danger);
  letter-spacing: 0.08em;
  padding: 0 0 18px;
}
</style>
