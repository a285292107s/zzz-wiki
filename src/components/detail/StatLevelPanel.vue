<script setup lang="ts">
/**
 * 等级滑条面板容器：三个详情页（角色/音擎/邦布）基础属性区共用结构。
 * 结构：细线框 = 等级行（Lv 标签 + #control 滑条）+ 元信息行（突破说明）+ 主体（KeyValueGrid 等）。
 *
 * **不设操作位插槽**：等级滑条区块只承载「这一组数值」。页面级动作归 `DetailPage` 的
 * `.page-actions` 行、且只在页面级存在——这里不许再长出区块内的动作位（决策记录 0006、0009）。
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
    <!-- 元信息行：突破说明。只在真有内容时渲染，不留空行。 -->
    <div v-if="meta" class="stat-level-meta mono">
      <span>{{ meta }}</span>
    </div>
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
  flex-wrap: wrap;
}

.stat-level-lv {
  flex: none;
  font-size: var(--fs-title);
  color: var(--amber);
  letter-spacing: 0.04em;
  min-width: 3.2em;
}

/* 元信息行：突破说明。本行高度恒定（36px）——它是等级行与数值表之间的固定呼吸带，
   不随文案长短（「未突破」/「突破 5 阶」）伸缩。 */
.stat-level-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 14px;
  min-height: 36px;
  margin-top: 4px;
  font-size: var(--fs-nano);
  letter-spacing: 0.14em;
  color: var(--ink-2);
}

/* 突破说明：本行唯一的文本，用琥珀标出 */
.stat-level-meta > span {
  color: var(--amber);
}
</style>
