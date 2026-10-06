<template>
  <div class="page wrap">
    <slot />
  </div>
</template>

<style scoped>
.page {
  padding-top: calc(var(--pad-section) * 0.9);
}

/* 列表页统一的页头下边距（各视图的 .page-head 结构相同，样式在此单一定义）。
   较 --pad-section 收紧：页头说明与工具行同属一个语义组，大留白会把首屏切成两半 */
:deep(.page-head) {
  margin-bottom: clamp(28px, 4vw, 52px);
}
</style>