<script setup lang="ts">
/**
 * 等级滑条面板容器：三个详情页（角色/音擎/邦布）基础属性区共用结构。
 * 结构：细线框 = 等级行（Lv 标签 + #control 滑条）
 *      + 元信息行（突破说明 + 可选 #actions 操作位）
 *      + 主体（KeyValueGrid 等）。
 *
 * **操作位为什么不在滑条行**：#actions（「复制此等级链接」）原先与滑条同排、
 * 靠 margin-left:auto 顶到行尾。滑条是 flex:1 + min-width:0（独占收缩权），
 * 按钮是 flex:none（固定 ~117px），行内一挤，缺口**全部**由滑条承担：
 * 1440px 下轨道 1022 → 887px，320px 下 158 → 23px（60 级压进 23px，刻度糊成一片）。
 * 而按钮的 v-if 条件恰是「等级非满级」——**用户第一次拖动滑条离开满级的那一瞬**，
 * 轨道就被挤窄，滑钮在指针下跳到另一个值。
 * 移到滑条**下方**后，按钮不再参与滑条行的宽度分配，拖动全程轨道几何恒定。
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
    <!-- 元信息行：突破说明 + 操作位（如「复制此等级视图链接」）。
         只在真有内容时渲染，不留空行。
         div 而非 p：本行要放按钮，而 p 内不允许按钮等内容（非法嵌套，全站
         `p > button` 已有审计把守；AsyncState 错误态即为此由 p 改 div）。 -->
    <div v-if="meta || $slots.actions" class="stat-level-meta mono">
      <span v-if="meta">{{ meta }}</span>
      <slot name="actions" />
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

/* 元信息行：突破说明 + 操作位。
   高度锁定 36px（= 操作位按钮高）：按钮的 v-if 条件是「等级非满级」，
   滑条拖过满级边界、或键盘在 60 附近来回按 ←/→ 时，它会反复出现/消失；
   本行若随内容伸缩，下方数值表就跟着上下抖 19px。
   锁高后本行构图恒定（且整行位于滑条**下方**，无论如何都推不动滑条）。 */
.stat-level-meta {
  display: flex;
  align-items: center;
  /* 极窄屏 + 文案变长时退化为「操作位换行、仍靠右」，不撑破面板 */
  flex-wrap: wrap;
  gap: 4px 14px;
  min-height: 36px;
  margin-top: 4px;
  font-size: var(--fs-nano);
  letter-spacing: 0.14em;
  color: var(--ink-2);
}

/* 操作位推到行尾。本行内没有滑条，宽度不再互相挤（与滑条行分开是刻意的） */
.stat-level-meta > :deep(.copy-link) {
  margin-left: auto;
}

/* 直接子选择器：CopyLinkButton 内部也含 span，别把这条染色规则套到按钮文字上 */
.stat-level-meta > span:first-child {
  color: var(--amber);
}
</style>
