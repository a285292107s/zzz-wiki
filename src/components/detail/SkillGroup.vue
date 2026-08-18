<script setup lang="ts">
import { ref } from 'vue'
import { richDesc } from '@/utils/rich'
import {
  SKILL_LEVEL_DEFAULT,
  SKILL_LEVEL_MAX,
  SKILL_LEVEL_MIN,
  skillDetailValue,
  type SkillRow,
} from '@/domain/sections'
import HollowImage from '../HollowImage.vue'

const props = defineProps<{
  row: SkillRow
  glyph: string
  srcs: string[]
}>()

/** 每个技能槽独立的提升等级，默认最高级 */
const level = ref(SKILL_LEVEL_DEFAULT)
</script>

<template>
  <div class="skill-group">
    <div class="skill-kind-row">
      <span class="key-glyph">
        <HollowImage :srcs="props.srcs" :alt="row.zh" :fallback="props.glyph" />
        <em class="mono">{{ row.keyEn }}</em>
      </span>
      <h3 class="skill-kind serif">{{ row.zh }}</h3>
      <!-- 等级滑块与技能名同条，靠右对齐；窄屏允许换行 -->
      <div v-if="row.hasNumbers" class="level-row">
        <input
          v-model.number="level"
          class="level-range"
          type="range"
          :min="SKILL_LEVEL_MIN"
          :max="SKILL_LEVEL_MAX"
          :aria-label="`${row.zh}等级`"
          :aria-valuetext="`等级 ${level}`"
        />
        <span class="level-val mono">Lv.{{ level }}</span>
      </div>
    </div>

    <ul class="action-list">
      <li
        v-for="(grp, gi) in row.groups"
        :key="grp.name || 'g' + gi"
        class="row"
      >
        <span class="no mono">{{ String(gi + 1).padStart(2, '0') }}</span>
        <div class="body">
          <h4 class="title title-skill">{{ grp.name }}</h4>
          <p v-if="grp.desc" class="desc" v-html="richDesc(grp.desc)"></p>
          <ul v-if="grp.entries?.length" class="stat-list">
            <li v-for="(en, ei) in grp.entries" :key="en.name || 'e' + ei" class="stat-item">
              <span class="stat-name">{{ en.name }}</span>
              <span class="stat-val mono">{{ skillDetailValue(en, level) }}</span>
            </li>
          </ul>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.skill-group {
  /* 招式行标签列宽度 + 间距 = 正文缩进，供水平对齐统一使用 */
  --label-col: 36px;
  --row-gap: 14px;
  --body-left: calc(var(--label-col) + var(--row-gap));
  margin-bottom: calc(var(--pad-section) * 0.5);
}
.skill-kind-row {
  display: flex;
  align-items: center;
  gap: var(--row-gap);
  margin-bottom: 8px;
  flex-wrap: wrap;
  row-gap: 10px;
}
.key-glyph {
  width: 40px;
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}
.key-glyph :deep(.frame) {
  width: 38px;
  height: 38px;
  border-radius: 2px;
}
.key-glyph em {
  font-style: normal;
  font-size: 8px;
  letter-spacing: 0.14em;
  color: var(--ink-3);
}
.skill-kind {
  font-family: var(--serif);
  font-size: 16.5px;
  font-weight: 500;
  color: var(--amber);
}

.action-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.row {
  display: grid;
  grid-template-columns: var(--label-col) 1fr;
  gap: var(--row-gap);
  padding: var(--space-2) 4px;
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
  font-size: 15.5px;
  line-height: 1.4;
  margin-bottom: 6px;
  color: var(--ink-0);
}
.desc {
  color: var(--ink-1);
  font-size: 13.5px;
  line-height: 1.8;
  max-width: 76ch;
  white-space: pre-line;
  margin-bottom: 10px;
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
.stat-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-width: 420px;
}
.stat-item {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding: 6px 0;
  color: var(--ink-1);
  font-size: 13.5px;
  border-top: 1px dashed var(--line-0);
}
.stat-item:first-child {
  border-top: none;
  padding-top: 2px;
}
.stat-name {
  min-width: 0;
}
.stat-val {
  flex: none;
  color: var(--amber);
  font-size: 13px;
}

.level-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
  flex: 1 1 240px;
  min-width: 200px;
  max-width: 420px;
}
.level-range {
  flex: 1;
  appearance: none;
  -webkit-appearance: none;
  margin: 0;
  padding: 6px 0;
  background: transparent;
  cursor: pointer;
  min-width: 0;
}
/* 细线轨道（2px 发丝线），避免原生高亮粗条的视觉侵占 */
.level-range::-webkit-slider-runnable-track {
  height: 2px;
  background: var(--line-2);
  border-radius: 1px;
}
.level-range::-moz-range-track {
  height: 2px;
  background: var(--line-2);
  border-radius: 1px;
}
/* 小方钮：2px 圆角，与"档案标本"的细线框语言一致 */
.level-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 11px;
  height: 11px;
  margin-top: -4.5px;
  background: var(--amber);
  border: 1px solid var(--bg-0);
  border-radius: 2px;
  transition: background var(--t-fast) var(--ease);
}
.level-range::-moz-range-thumb {
  width: 11px;
  height: 11px;
  background: var(--amber);
  border: 1px solid var(--bg-0);
  border-radius: 2px;
  transition: background var(--t-fast) var(--ease);
}
.level-range:hover::-webkit-slider-thumb,
.level-range:active::-webkit-slider-thumb {
  background: var(--amber-hi);
}
.level-range:hover::-moz-range-thumb,
.level-range:active::-moz-range-thumb {
  background: var(--amber-hi);
}
.level-range:hover::-webkit-slider-runnable-track,
.level-range:hover::-moz-range-track {
  background: var(--line-1);
}
.level-range:focus-visible {
  outline: 1px solid var(--amber);
  outline-offset: 4px;
  border-radius: 2px;
}
.level-val {
  font-size: 12px;
  color: var(--amber);
  min-width: 3.4em;
}
</style>