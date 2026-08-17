<script setup lang="ts">
import HollowImage from '@/components/HollowImage.vue'

defineProps<{
  /** 眉标，如 'Agent · 1011' */
  eyebrow: string
  title: string
  /** 画像候选 URL 列表 */
  portraitSrcs: string[]
  alt: string
  fallback: string
  /** 画像高宽比（默认 3/4，音擎 1/1） */
  ratio?: string | number
  /** 画像裁切对齐；竖长图用 top */
  position?: 'center' | 'top' | 'bottom'
}>()
</script>

<template>
  <header class="head">
    <div class="id-block">
      <p class="eyebrow mono">{{ eyebrow }}</p>
      <h1 class="page-title">{{ title }}</h1>
      <div class="meta">
        <slot name="meta" />
      </div>
      <div class="sub">
        <slot name="sub" />
      </div>
    </div>

    <div class="portrait">
      <HollowImage
        :srcs="portraitSrcs"
        :alt="alt"
        :fallback="fallback"
        :position="position ?? 'center'"
        :ratio="ratio ?? '3 / 4'"
      />
    </div>
  </header>
</template>

<style scoped>
.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 40px;
  margin-bottom: calc(var(--pad-section) * 0.8);
}
.meta {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 18px;
  flex-wrap: wrap;
}
.sub {
  margin-top: 14px;
}
.portrait {
  flex: none;
  width: min(280px, 34vw);
}
.portrait :deep(.frame) {
  border: var(--rule);
  background: var(--bg-1);
}
@media (max-width: 860px) {
  .head {
    flex-direction: column-reverse;
  }
  .portrait {
    width: 56vw;
  }
}
</style>