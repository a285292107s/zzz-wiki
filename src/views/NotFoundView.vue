<script setup lang="ts">
import { usePageMeta } from '@/composables/usePageMeta'

usePageMeta()
</script>

<template>
  <div class="wrap page">
    <section class="err">
      <p class="eyebrow mono">Error 404</p>
      <h1 class="page-title">档案缺失</h1>
      <p class="page-sub">
        目标条目不在索引中。可能已被删除、尚未归档，或链接有误。
      </p>
      <p class="hint mono">
        <RouterLink to="/" class="back mono">← 返回目录</RouterLink>
      </p>
    </section>
  </div>
</template>

<style scoped>
.page {
  padding-top: calc(var(--pad-section) * 1.4);
  display: flex;
  justify-content: center;
}
.err {
  text-align: center;
  max-width: 520px;
}
.eyebrow {
  justify-content: center;
}
.eyebrow::after {
  content: '';
  width: 18px;
  height: 1px;
  background: var(--amber);
}
.hint {
  margin-top: 40px;
  display: flex;
  justify-content: center;
}
.back {
  font-size: var(--fs-caption);
  color: var(--ink-2);
  letter-spacing: 0.12em;
  transition: color var(--t-fast) var(--ease);
}
.back:hover {
  color: var(--amber-hi);
}
</style>
