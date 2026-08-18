<script setup lang="ts">
import { computed, ref } from 'vue'
import { richDesc } from '@/utils/rich'
import type { CoreEnhanceLevel, CoreSkill } from '@/domain/sections'
import LevelSlider from './LevelSlider.vue'

const props = defineProps<{
  row: CoreSkill
  /** 核心技强化档位（extra_level，I-VI） */
  enhance?: CoreEnhanceLevel[]
}>()

/** 核心技等级（1..levels.length），默认满级 */
const level = ref(props.row.levels.length)

const maxLevel = computed(() => props.row.levels.length)

/** 当前等级记录（levels 下标越界时回退末级） */
const current = computed(() => {
  const lv = Math.min(Math.max(1, level.value), maxLevel.value)
  return props.row.levels[lv - 1] ?? props.row.levels[props.row.levels.length - 1]
})
</script>

<template>
  <div class="skill-group core-skill">
    <div class="skill-kind-row">
      <span class="key-glyph">
        <span class="core-glyph" aria-hidden="true">◒</span>
        <em class="mono">CORE</em>
      </span>
      <h3 class="skill-kind serif">核心技</h3>
      <!-- 等级滑块与技能名同条，靠右对齐；窄屏允许换行 -->
      <div class="level-row">
        <LevelSlider
          v-model="level"
          :min="1"
          :max="maxLevel"
          :label="`核心技等级`"
        />
        <!-- 等级标签：显示数据 level（1-7）；强化版追加「强化」徽标 -->
        <span class="level-val mono">
          Lv.{{ current.level }}<em v-if="current.enhanced" class="enh">强化</em>
        </span>
      </div>
    </div>

    <ul class="action-list">
      <li class="row">
        <span class="no mono">01</span>
        <div class="body">
          <h4 class="title title-skill">{{ current.coreName }}</h4>
          <p v-if="current.desc[0]" class="desc" v-html="richDesc(current.desc[0])"></p>
        </div>
      </li>
      <li class="row">
        <span class="no mono">02</span>
        <div class="body">
          <h4 class="title title-skill">{{ current.extraName }}</h4>
          <p v-if="current.desc[1]" class="desc" v-html="richDesc(current.desc[1])"></p>
        </div>
      </li>
    </ul>

    <!-- 核心技强化：extra_level 档位（I-VI），属性加成累计值 -->
    <section v-if="enhance?.length" class="enhance">
      <h4 class="enhance-title mono">核心技强化</h4>
      <ul class="enhance-list">
        <li v-for="lv in enhance" :key="lv.no" class="enhance-row">
          <span class="no mono">{{ lv.no }}</span>
          <span class="unlock mono">Lv.{{ lv.unlockAt }}</span>
          <span class="bonus mono">
            <template v-for="(b, i) in lv.bonus" :key="b.name">
              <span v-if="i" class="sep" aria-hidden="true">·</span>
              {{ b.name }} +{{ b.text }}
            </template>
          </span>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
/* 与 SkillGroup 同源的展示语言（细线行 + 编号列 + 富文本描述），后续可抽公共 */
.core-skill {
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

/* 核心技纹章：◒ + CORE 键名（与 SKILL_KEYS.core 同构，无图片依赖） */
.core-glyph {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  font-size: 17px;
  color: var(--amber);
  border: 1px solid var(--line-1);
  border-radius: 2px;
  background: var(--bg-1);
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

.level-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
  flex: 1 1 240px;
  min-width: 200px;
  max-width: 420px;
}

.level-val {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 12px;
  color: var(--amber);
  min-width: 3.4em;
  text-align: right;
  justify-content: flex-end;
}

/* 「强化」徽标：与档案标本一致的细线小标签 */
.level-val .enh {
  font-style: normal;
  font-size: 9px;
  letter-spacing: 0.12em;
  padding: 1px 4px;
  border: 1px solid var(--amber);
  border-radius: 2px;
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

.desc:last-child {
  margin-bottom: 0;
}

/* ---------- 核心技强化（extra_level 档位） ---------- */

.enhance {
  margin-top: var(--space-group);
  padding-top: var(--space-2);
  border-top: var(--rule);
}

.enhance-title {
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0.22em;
  color: var(--ink-2);
  margin-bottom: 4px;
}

.enhance-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.enhance-row {
  display: grid;
  grid-template-columns: var(--label-col) 3.2em 1fr;
  gap: var(--row-gap);
  align-items: baseline;
  padding: 9px 4px;
  border-bottom: var(--rule);
}

.enhance-row:last-child {
  border-bottom: none;
}

.enhance-row .no {
  color: var(--amber);
}

.enhance-row .unlock {
  font-size: 11px;
  color: var(--ink-3);
}

.enhance-row .bonus {
  font-size: 12.5px;
  color: var(--ink-0);
}

.enhance-row .sep {
  margin: 0 0.6em;
  color: var(--ink-3);
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
