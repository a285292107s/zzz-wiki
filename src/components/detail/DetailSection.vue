<script setup lang="ts">
import { computed } from 'vue'
import { latinDecor } from '@/utils/latinDecor'

const props = defineProps<{
  no: string
  title: string
  /** 锚点 id；详情页用于区块直达/深链 */
  id?: string
  /** 英文副标（编辑排版用，如 'VITALS'）；显示于标题行右端 */
  en?: string
  /** 换册处：上方留白放宽一档，并在区块头自己的上缘画一条齐版心的细线（同一页 1–2 处，判据见 DATA_GUIDE §10） */
  seam?: boolean
}>()

const decor = computed(() => latinDecor(props.en, props.title))
</script>

<template>
  <!-- aria-labelledby：区块 landmark 与标题显式关联（id 缺失时跳过）。
       tabindex="-1"：让 hash 直达时路由层能把焦点落进该区块（读屏随之播报区块标题），
       键盘用户 Tab 不会停在这里（-1 不进 Tab 序）。 -->
  <section
    class="block"
    :class="{ seam }"
    :id="id"
    :tabindex="id ? -1 : undefined"
    :aria-labelledby="id ? 'h-' + id : undefined"
  >
    <!-- 区块标题行参与「整页退场 / 逐条入场」编排（见 utils/viewTransition/chrome）；
         区块正文由各自的内容组件出声，这里只管标题行。 -->
    <div class="section-head" data-vt-block>
      <!-- no 为空时（区块被渲染但未登记进 navItems 的异常态）不渲染编号，避免留空档 -->
      <span v-if="no" class="no mono" aria-hidden="true">{{ no }}</span>
      <h2 :id="id ? 'h-' + id : undefined">{{ title }}</h2>
      <span v-if="decor" class="en mono">{{ decor }}</span>
    </div>
    <slot />
  </section>
</template>

<style scoped>
.block {
  margin-bottom: var(--space-section);
}

.block.seam {
  margin-top: var(--space-section-loose);
}

.block:first-of-type {
  margin-top: 0;
}

.block.seam .section-head {
  border-top: var(--rule);
  padding-top: clamp(20px, 2vw, 28px);
}

.block:first-of-type.seam .section-head {
  border-top: none;
  padding-top: 0;
}

/* 区块标题行（.section-head / .no / h2 / .en）的样式**单一来源在 base.css**
   —— 首页「今日角色 / 目录」用的是同一套语法。 */
</style>
