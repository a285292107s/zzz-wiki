<script setup lang="ts">
defineProps<{
  no: string
  title: string
  /** 锚点 id；详情页用于区块直达/深链 */
  id?: string
  /** 英文副标（编辑排版用，如 'VITALS'）；显示于标题行右端 */
  en?: string
}>()
</script>

<template>
  <!-- aria-labelledby：区块 landmark 与标题显式关联（id 缺失时跳过）。
       tabindex="-1"：让 hash 直达时路由层能把焦点落进该区块（读屏随之播报区块标题），
       键盘用户 Tab 不会停在这里（-1 不进 Tab 序）。 -->
  <section
    class="block"
    :id="id"
    :tabindex="id ? -1 : undefined"
    :aria-labelledby="id ? 'h-' + id : undefined"
  >
    <div class="section-head">
      <!-- no 为空时（区块被渲染但未登记进 navItems 的异常态）不渲染编号，避免留 16px 空档 -->
      <span v-if="no" class="no mono" aria-hidden="true">{{ no }}</span>
      <h2 :id="id ? 'h-' + id : undefined">{{ title }}</h2>
      <span class="rule" />
      <span v-if="en" class="en mono">{{ en }}</span>
    </div>
    <slot />
  </section>
</template>

<style scoped>
.block {
  margin-bottom: var(--space-section);
}
.section-head {
  display: flex;
  align-items: baseline;
  gap: var(--space-head);
  border-top: var(--rule);
  padding-top: 14px;
  margin-bottom: 28px;
}
.no {
  font-family: var(--mono);
  font-size: var(--fs-caption);
  color: var(--amber);
  letter-spacing: 0.08em;
}
h2 {
  font-family: var(--serif);
  font-weight: 500;
  font-size: var(--fs-title);
  letter-spacing: 0.02em;
}
.rule {
  flex: 1;
  height: 1px;
  background: var(--line-1);
}
.en {
  font-family: var(--mono);
  font-size: var(--fs-micro);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--ink-2);
}
</style>
