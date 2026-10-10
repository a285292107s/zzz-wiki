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
    <!-- 区块标题行参与「整页退场 / 逐条入场」编排（见 utils/viewTransition/chrome）；
         区块正文由各自的内容组件出声，这里只管标题行。 -->
    <div class="section-head" data-vt-block>
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

/* 区块标题行（.section-head / .no / h2 / .rule / .en）的样式**单一来源在 base.css**
   —— 首页「今日角色 / 目录」用的是同一套语法。此前这里整份复制了一遍，
   与 base.css 逐条重复（`.en` 就是因首页也要用才暴露出来）；两份各自漂移的隐患大于
   这点局部性收益，故收口到 base.css。本文件只留 `.block` 自己的间距。 */
</style>
