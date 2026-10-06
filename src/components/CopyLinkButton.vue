<script setup lang="ts">
/**
 * CopyLinkButton — 复制当前视图链接（含筛选/等级等查询状态）。
 *
 * 只在 URL 真的带有状态时由调用方渲染（`v-if`）：这样它既是「可分享」的显式入口，
 * 又不会在默认视图里增加噪音。
 * 反馈：按钮文字切到「已复制」（视觉）+ visually-hidden role=status（读屏播报）；
 * 剪贴板不可用时切到「复制失败，请手动复制地址栏」（诚实降级）。
 */
import { useCopyLink } from '@/composables/useCopyLink'

withDefaults(
  defineProps<{
    /** 空闲态文案 */
    label?: string
  }>(),
  { label: '复制链接' },
)

const { copied, failed, copy } = useCopyLink()
</script>

<template>
  <button
    type="button"
    class="copy-link mono"
    :class="{ done: copied, failed }"
    @click="copy()"
  >
    <span aria-hidden="true">{{ failed ? '复制失败' : copied ? '已复制 ✓' : label }}</span>
    <!-- 读屏播报：按钮自身文字变化不一定被朗读，额外给一个 status 区 -->
    <span class="sr-only" role="status">
      {{ failed ? '复制失败，请手动复制地址栏链接' : copied ? '链接已复制' : '' }}
    </span>
  </button>
</template>

<style scoped>
.copy-link {
  flex: none;
  padding: 7px 12px;
  background: none;
  border: 1px solid var(--line-1);
  border-radius: 2px;
  color: var(--ink-2);
  font-size: var(--fs-caption);
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease);
}

@media (hover: hover) {
  .copy-link:hover {
    color: var(--ink-0);
    border-color: var(--line-2);
  }
}

.copy-link.done {
  color: var(--amber-hi);
  border-color: var(--amber);
}

.copy-link.failed {
  color: var(--danger);
  border-color: var(--danger);
}

.copy-link:focus-visible {
  outline: 1px solid var(--focus);
  outline-offset: 2px;
}
</style>
