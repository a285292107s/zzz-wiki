<template>
  <div class="page wrap">
    <slot />
  </div>
</template>

<style scoped>
.page {
  padding-top: calc(var(--pad-section) * 0.9);
}

/* 列表页统一的页头下边距（各视图的 .page-head 结构相同，样式在此单一定义） */
:deep(.page-head) {
  margin-bottom: var(--pad-section);
}
</style>