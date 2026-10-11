<script setup lang="ts">
/**
 * NavScrollButton — 窄屏吸顶横条右端的「横滑出口」。
 *
 * 只负责「把还有内容这件事变成可点的一步」：右端**还有内容**由 .sn-list 的淡出
 * 蒙版表达（见 base.css），本按钮不再重复画任何盒子——原先的 24px 描边方块把
 * 「还能滑」画成了「一个按钮」，等于同一屏上两套词汇说同一件事，且方块边缘压在
 * 条目文字上，读起来像贴纸。现在只剩一个描边雪佛龙，压在淡出带里。
 *
 * 为什么不用「→」字形：箭头字符的宽度由字体度量决定、垂直位置按基线对齐，
 * 在满高按钮里对不准条目中线；换成 SVG 才能钉死线宽（1px 发丝线，与全站线框同调）。
 */
defineProps<{ label: string }>()
defineEmits<{ click: [] }>()
</script>

<template>
  <button type="button" class="sn-scroll-btn" :aria-label="label" @click="$emit('click')">
    <svg class="sn-chevron" viewBox="0 0 9 16" aria-hidden="true" focusable="false">
      <path d="M1.5 1.5 L7.5 8 L1.5 14.5" />
    </svg>
  </button>
</template>

<style scoped>
/* 位置（绝对定位 / 显隐 / 命中区）归 base.css：那是断点相关的布局，属全站样式层。
   本组件只管字形本身——scoped 样式带属性选择器，能压过 base.css 里的同名单类规则。 */
.sn-chevron {
  display: block;
  width: 9px;
  height: 16px;
  overflow: visible;
}

.sn-chevron path {
  fill: none;
  stroke: currentColor;
  stroke-width: 1;
  /* 直角端头 + 尖角折点：与全站 1px 线框、2px 圆角的「档案」语法一致，
     不用圆头（圆头是移动端通用图标的语言，这里偏软） */
  stroke-linecap: butt;
  stroke-linejoin: miter;
}
</style>
