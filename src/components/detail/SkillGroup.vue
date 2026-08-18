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
import LevelSlider from './LevelSlider.vue'

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
        <LevelSlider
          v-model="level"
          :min="SKILL_LEVEL_MIN"
          :max="SKILL_LEVEL_MAX"
          :label="`${row.zh}等级`"
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
/* 滑条本体样式见 LevelSlider.vue（发丝线轨道 + 方形钮），两处共用 */
.level-val {
  font-size: 12px;
  color: var(--amber);
  min-width: 3.4em;
  text-align: right;
}
</style>