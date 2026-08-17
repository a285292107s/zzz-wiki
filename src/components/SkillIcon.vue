<script setup lang="ts">
/**
 * 技能键位图表组件
 * 字形来自 src/data/skillGlyphs.ts（本地矢量重绘，参照 temp/ 游戏原版图标
 * 逐像素分析），纯 SVG、零外部请求；"档案标本"设计语言：黑底圆 + 细线描边。
 */
import { computed } from 'vue'
import { renderSkillGlyph, SLOT_ASSET, SLOT_LABELS, type SkillSlot } from '@/data/skillGlyphs'

const props = withDefaults(defineProps<{ slot: SkillSlot; size?: number }>(), {
  size: 38,
})

const svg = computed(() => renderSkillGlyph(SLOT_ASSET[props.slot], props.size))
const label = computed(() => SLOT_LABELS[props.slot])
</script>

<template>
  <span class="skill-icon" role="img" :aria-label="label" v-html="svg"></span>
</template>

<style scoped>
.skill-icon {
  display: block;
  flex-shrink: 0;
  line-height: 0;
}
</style>