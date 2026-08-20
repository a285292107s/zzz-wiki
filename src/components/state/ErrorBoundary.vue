<template>
  <div class="eb-root" :class="{ 'eb-root--error': hasError }">
    <template v-if="hasError">
      <div class="eb-card">
        <p class="eb-eyebrow mono">ARCHIVE · ERROR</p>
        <h1 class="eb-title serif">档案读取出错</h1>
        <p class="eb-desc">
          当前页面的数据渲染遇到了意外情况。这可能是数据文件暂时异常，
          刷新页面或返回名录重试即可。
        </p>
        <div class="eb-actions">
          <button type="button" class="eb-btn mono" @click="retry">
            ↻ 重试
          </button>
          <RouterLink to="/" class="eb-btn eb-btn-ghost mono">
            ← 返回首页
          </RouterLink>
        </div>
        <details v-if="errInfo" class="eb-detail">
          <summary class="eb-detail-sum mono">错误详情</summary>
          <pre class="eb-detail-pre">{{ errInfo }}</pre>
        </details>
      </div>
    </template>
    <template v-else>
      <slot />
    </template>
  </div>
</template>

<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue'
import { RouterLink } from 'vue-router'

const hasError = ref(false)
const errInfo = ref('')

function retry() {
  hasError.value = false
  errInfo.value = ''
}

onErrorCaptured((err, _instance, info) => {
  hasError.value = true
  errInfo.value = `[${info}]\n${err instanceof Error ? err.message : String(err)}`
  // 返回 false 阻止错误继续向上传播，避免 App 层也捕获
  return false
})
</script>

<style scoped>
/* 正常状态：透明包装，不加 padding，由页面组件自己控制布局 */
.eb-root {
}

/* 错误状态：居中展示错误卡片，留出呼吸空间 */
.eb-root--error {
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: calc(var(--pad-section) * 2) var(--pad-page);
}

.eb-card {
  max-width: 480px;
  width: 100%;
  border: var(--rule);
  background: var(--bg-1);
  padding: 32px 28px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.eb-eyebrow {
  font-size: 10px;
  letter-spacing: 0.26em;
  color: var(--amber);
}

.eb-title {
  font-size: 22px;
  font-weight: 500;
  color: var(--ink-0);
  line-height: 1.35;
}

.eb-desc {
  font-size: 13.5px;
  line-height: 1.75;
  color: var(--ink-2);
}

.eb-actions {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}

.eb-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 8px 16px;
  font-size: 12px;
  letter-spacing: 0.14em;
  color: var(--ink-0);
  background: var(--amber);
  border: 1px solid var(--amber);
  border-radius: 2px;
  text-decoration: none;
  transition: opacity var(--t-fast) var(--ease);
}

.eb-btn:hover {
  opacity: 0.88;
}

.eb-btn-ghost {
  color: var(--ink-1);
  background: transparent;
  border-color: var(--line-1);
}

.eb-btn-ghost:hover {
  color: var(--ink-0);
  border-color: var(--line-2);
  background: var(--bg-2);
}

.eb-detail {
  margin-top: 4px;
}

.eb-detail-sum {
  font-size: 11px;
  letter-spacing: 0.1em;
  color: var(--ink-3);
  cursor: pointer;
}

.eb-detail-pre {
  margin-top: 8px;
  padding: 12px;
  background: var(--bg-2);
  border: 1px solid var(--line-0);
  border-radius: 2px;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--ink-2);
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>