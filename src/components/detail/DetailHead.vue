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
  /** 图片适应方式：默认 cover 裁切填满；产品大图整幅展示用 contain */
  fit?: 'cover' | 'contain'
  /** 宽幅画像（音擎详情页产品大图）：右栏放宽一档 */
  wide?: boolean
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
      <!-- 脚注区：边缘注记式交叉引用（如 音擎 → 归属代理人）。可选，未投递则不渲染 -->
      <div v-if="$slots.footnote" class="footnote">
        <slot name="footnote" />
      </div>
    </div>

    <div class="portrait" :class="{ wide }">
      <slot name="portrait">
        <HollowImage
          :srcs="portraitSrcs"
          :alt="alt"
          :fallback="fallback"
          :position="position ?? 'center'"
          :ratio="ratio ?? '3 / 4'"
          :fit="fit ?? 'cover'"
        />
      </slot>
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
/* 文字列要**吃掉**画像之外的全部宽度：此前是 fit-content（收缩到 h1 的自然宽），
   三页的说明与注记因此被挤在 ~230px 里换行，右侧留下 349（1440）–724（1920）px 的空白。
   行长不靠列宽控制，交给下面 .sub/.footnote 的 60ch。 */
.id-block {
  flex: 1 1 auto;
  min-width: 0;
}
.sub,
.footnote {
  max-width: 60ch;
}
.meta {
  display: flex;
  align-items: center;
  gap: var(--space-inline);
  margin-top: 18px;
  flex-wrap: wrap;
}
.sub {
  margin-top: 14px;
}
/* 脚注区（如 音擎→归属代理人 的交叉引用）：无额外间距干涉，由脚注自身 hairline 分隔 */
.footnote {
  margin-top: 0;
}
.portrait {
  flex: none;
  width: min(280px, 34vw);
}
.portrait.wide {
  width: min(430px, 38vw);
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
  .portrait.wide {
    width: min(430px, 84vw);
  }
}
</style>