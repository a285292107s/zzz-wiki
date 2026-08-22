<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { AsyncStatus } from '@/composables/useAsyncResource'

const props = defineProps<{
  status: AsyncStatus | string
  error?: string | null
  empty?: boolean
  emptyText?: string
  loadingText?: string
  notFound?: boolean
  notFoundText?: string
  errorTitle?: string
  /** 404 时展示的返回链接目标（可选） */
  backTo?: string
  backText?: string
}>()

const showEmpty = computed(() => props.empty === true)

/** HTTP 404：错误消息形如 "HTTP 404 · /data/..."，识别后展示友好文案 */
const isNotFound = computed(
  () =>
    props.notFound === true ||
    (props.status === 'error' && /HTTP 404\b/.test(props.error ?? '')),
)
</script>

<template>
  <p v-if="status === 'loading' || status === 'idle'" class="state loading mono" role="status">
    <slot name="skeleton">
      {{ loadingText ?? 'LOADING…' }}
    </slot>
  </p>
  <p v-else-if="status === 'error'" class="state err mono" role="alert">
    <template v-if="isNotFound">
      ⚠ {{ notFoundText ?? '目标不存在或已被移除' }}
      <RouterLink v-if="backTo" class="err-link" :to="backTo">{{ backText ?? '返回名录' }}</RouterLink>
    </template>
    <template v-else>
      ⚠ {{ errorTitle ?? '数据加载失败' }}：{{ error }}
    </template>
  </p>
  <p v-else-if="showEmpty" class="state empty mono">
    {{ emptyText ?? 'NO RECORDS' }}
  </p>
  <slot v-else />
</template>

<style scoped>
.state {
  font-size: var(--fs-caption);
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
.err-link {
  margin-left: 12px;
  color: var(--amber-hi);
  border-bottom: 1px solid currentColor;
  letter-spacing: 0.08em;
}
</style>
