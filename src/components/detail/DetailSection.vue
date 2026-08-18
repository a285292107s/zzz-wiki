<script setup lang="ts">
defineProps<{
  no: string
  title: string
  /** 锚点 id；详情页用于区块直达/深链 */
  id?: string
}>()
</script>

<template>
  <section class="block" :id="id">
    <div class="section-head">
      <span class="no mono">{{ no }}</span>
      <h2>{{ title }}</h2>
      <span class="rule" />
    </div>
    <slot />
  </section>
</template>

<style scoped>
.block {
  margin-bottom: calc(var(--pad-section) * 0.7);
}
.section-head {
  display: flex;
  align-items: baseline;
  gap: 16px;
  border-top: var(--rule);
  padding-top: 14px;
  margin-bottom: 28px;
}
.no {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--amber);
  letter-spacing: 0.08em;
}
h2 {
  font-family: var(--serif);
  font-weight: 500;
  font-size: 22px;
  letter-spacing: 0.02em;
}
.rule {
  flex: 1;
  height: 1px;
  background: var(--line-1);
}
</style>
