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
  /** 重试回调（通常传 useAsyncResource 的 reload）；给了才显示「重新加载」按钮 */
  retry?: () => void
}>()

const showEmpty = computed(() => props.empty === true)

/** HTTP 404：错误消息形如 "HTTP 404 · /data/..."，识别后展示友好文案 */
const isNotFound = computed(
  () =>
    props.notFound === true ||
    (props.status === 'error' && /HTTP 404\b/.test(props.error ?? '')),
)

/**
 * 错误类型 → 人话说明。原始报错（如 "Failed to fetch"）对用户没有意义，
 * 但它是最诚实的诊断线索，故降为次要的一行保留，主文案按类型给结论与动作。
 */
const errorHint = computed(() => {
  const e = (props.error ?? '').toLowerCase()
  if (/failed to fetch|networkerror|err_internet|load failed/.test(e))
    return '网络请求没有完成——可能是连接中断或数据未就绪。重新加载通常即可恢复。'
  if (/timeout|超时|aborted/.test(e)) return '请求超时——数据源响应过慢，请重试。'
  if (/HTTP 5\d\d/.test(props.error ?? '')) return '数据源暂时不可用，请稍后重试。'
  return '数据未能载入。请重新加载；若持续失败，可稍后再访问。'
})
</script>

<template>
  <p v-if="status === 'loading' || status === 'idle'" class="state loading mono" role="status">
    <slot name="skeleton">
      {{ loadingText ?? 'LOADING…' }}
    </slot>
  </p>
  <!-- div 而非 p：错误态含标题/说明/重试按钮多个块级子项（p 内不允许按钮等，
       否则是非法 DOM）。role=alert 保留，读屏会在错误出现时立刻播报。 -->
  <div v-else-if="status === 'error'" class="state err" role="alert">
    <template v-if="isNotFound">
      <p class="err-title mono">⚠ {{ notFoundText ?? '目标不存在或已被移除' }}</p>
      <RouterLink v-if="backTo" class="err-link mono" :to="backTo">{{ backText ?? '返回名录' }}</RouterLink>
    </template>
    <template v-else>
      <p class="err-title mono">⚠ {{ errorTitle ?? '数据加载失败' }}</p>
      <p class="err-hint">{{ errorHint }}</p>
      <button v-if="retry" type="button" class="err-retry mono" @click="retry()">重新加载</button>
      <p v-if="error" class="err-detail mono">{{ error }}</p>
    </template>
  </div>
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
  padding: 0 0 18px;
  max-width: 62ch;
}
.err-title {
  color: var(--danger);
  font-size: var(--fs-caption);
  letter-spacing: 0.08em;
}
.err-hint {
  margin-top: 10px;
  color: var(--ink-1);
  font-size: var(--fs-caption);
  line-height: 1.85;
  letter-spacing: 0.02em;
}
.err-retry {
  margin-top: 16px;
  padding: 7px 14px;
  background: none;
  border: 1px solid var(--line-1);
  border-radius: 2px;
  color: var(--ink-1);
  font-size: var(--fs-caption);
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease);
}
@media (hover: hover) {
  .err-retry:hover {
    color: var(--amber-hi);
    border-color: var(--amber);
  }
}
.err-retry:focus-visible {
  outline: 1px solid var(--focus);
  outline-offset: 2px;
}
/* 原始报错降为次要诊断信息：保留但不喧宾夺主 */
.err-detail {
  margin-top: 12px;
  color: var(--ink-2);
  font-size: var(--fs-nano);
  letter-spacing: 0.06em;
  word-break: break-all;
}
.err-link {
  display: inline-block;
  margin-top: 12px;
  color: var(--amber-hi);
  font-size: var(--fs-caption);
  border-bottom: 1px solid currentColor;
  letter-spacing: 0.08em;
}
</style>
