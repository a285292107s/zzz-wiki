<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  /** 行序号文本（'01' / '1'） */
  no: string
  title: string
  /** 富文本模式：v-html 渲染（技能/精炼描述） */
  html?: string
  /** 纯文本模式：stripRichText 处理后传入（影画描述） */
  text?: string
  /** 标题视觉变体：skill=技能名（sans 15.5）/ talent=影画精炼（serif 16） */
  variant?: 'skill' | 'talent' | 'default'
}>()

const titleClass = computed(() => 'title title-' + (props.variant ?? 'default'))
</script>

<template>
  <li class="row">
    <span class="no mono">{{ no }}</span>
    <div class="body">
      <!-- h3：DescRow 用于影画/精炼/潜能影画等区块（h2 下直接子级），
           用 h3 保证大纲连续（避免 h2→h4 跳级）；区块内更深层级由调用方处理 -->
      <h3 :class="titleClass">{{ title }}</h3>
      <p v-if="html" class="desc" v-html="html"></p>
      <p v-else-if="text" class="desc">{{ text }}</p>
    </div>
  </li>
</template>

<style scoped>
.row {
  display: grid;
  grid-template-columns: 36px 1fr;
  gap: 14px;
  padding: 14px 4px;
  border-bottom: var(--rule);
}
.no {
  color: var(--ink-3);
  font-size: 12px;
  padding-top: 2px;
}
.body {
  min-width: 0;
}
.title {
  font-weight: 500;
  line-height: 1.4;
  margin-bottom: 6px;
  color: var(--ink-0);
}
/* 与旧页面像素一致：skill 名 15.5px sans；影画/精炼 16px serif */
.title-skill {
  font-size: 15.5px;
}
.title-talent,
.title-default {
  font-family: var(--serif);
  font-size: 16px;
}
.desc {
  color: var(--ink-1);
  font-size: 13.5px;
  line-height: 1.8;
  max-width: 76ch;
  white-space: pre-line;
}
.desc :deep(.rich-key) {
  display: inline-block;
  width: 1.15em;
  height: 1.15em;
  margin: 0 0.1em;
  vertical-align: -0.22em;
  border-radius: 1px;
  line-height: 0;
}
.desc :deep(.rich-key svg) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
