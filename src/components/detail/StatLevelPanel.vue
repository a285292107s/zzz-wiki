<script setup lang="ts">
/**
 * 等级滑条面板容器：三个详情页（角色/音擎/邦布）基础数值区共用结构。
 * 结构：细线框 = 等级行（Lv 标签 + #control 滑条）+ 可选突破说明 + 主体（KeyValueGrid 等）。
 */
defineProps<{
  /** 当前等级显示文本，如 'Lv.60' */
  lvLabel: string
  /** 突破说明（如 '未突破' / '突破 2 阶'）；缺省不渲染 */
  meta?: string
}>()
</script>

<template>
  <div class="stat-level">
    <div v-if="$slots.control" class="stat-level-head">
      <span class="stat-level-lv mono">{{ lvLabel }}</span>
      <slot name="control" />
    </div>
    <p v-if="meta" class="stat-level-meta mono">
      <span>{{ meta }}</span>
    </p>
    <slot />
  </div>
</template>

<style scoped>
.stat-level {
  border: var(--rule);
  padding: 14px clamp(16px, 2vw, 28px) 12px;
  margin-bottom: var(--space-2);
}

.stat-level-head {
  display: flex;
  align-items: center;
  gap: 18px;
}

.stat-level-lv {
  flex: none;
  font-size: 22px;
  color: var(--amber);
  letter-spacing: 0.04em;
  min-width: 3.2em;
}

.stat-level-meta {
  display: flex;
  gap: 14px;
  margin-top: 8px;
  font-size: 10.5px;
  letter-spacing: 0.14em;
  color: var(--ink-2);
}

.stat-level-meta span:first-child {
  color: var(--amber);
}
</style>