<script setup lang="ts">
import { computed, ref } from 'vue'
import { richDesc } from '@/utils/rich'
import type { CoreEnhanceLevel, CoreSkill, PotentialCinema } from '@/domain/sections'
import LevelSlider from './LevelSlider.vue'

const props = defineProps<{
  row: CoreSkill
  /** 核心技强化档位（extra_level，I-VI） */
  enhance?: CoreEnhanceLevel[]
  /** 潜能影像档位（potential_detail）：潜能模式下补一行「潜能觉醒：极冰带」等强化效果 */
  cinema?: PotentialCinema[]
}>()

/** 真实核心技等级（1..levelCount；两轮结构去重后仍为 7，而非 14 条记录数），默认满级 */
const level = ref(Math.max(1, props.row.levelCount))

const maxLevel = computed(() => Math.max(1, props.row.levelCount))

/** 潜能模式的追加效果行：取末尾（最高档）含描述的潜能影像档，如「潜能觉醒：极冰带」 */
const potBoost = computed(() => {
  const arr = props.cinema ?? []
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i].desc) return arr[i]
  return undefined
})

/** 是否为「潜能觉醒」追加行存在：有潜能影像的角色必有该行，故核心技即有基础/潜能切换 */
const canVary = computed(() => !!potBoost.value)

/** 展示版本：潜能（默认态）或基础；无切换时固定为基础 */
const variant = ref<'pot' | 'base'>(canVary.value ? 'pot' : 'base')

/** 当前等级记录：两轮潜能在第二轮（levelCount 起），其余取第 1 轮；越界回退末级 */
const current = computed(() => {
  const lv = Math.min(Math.max(1, level.value), maxLevel.value)
  const offset =
    props.row.hasEnhance && variant.value === 'pot' ? props.row.levelCount : 0
  return props.row.levels[offset + lv - 1] ?? props.row.levels[props.row.levels.length - 1]
})

/** 徽标文本：潜能档「潜能I·强化」，或非潜能的双轮「强化」；基础版为空 */
const currentTag = computed(() => {
  if (current.value.potentialTag) return `潜能${current.value.potentialTag}·强化`
  if (current.value.enhanced) return '强化'
  return ''
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
      <!-- 两轮核心或存在潜能影像强化时，在名称旁显示版本切换 -->
      <span v-if="canVary" class="variant-seg mono" role="group" aria-label="核心技版本">
        <button
          type="button"
          class="seg"
          :class="{ on: variant === 'base' }"
          :aria-pressed="variant === 'base'"
          @click="variant = 'base'"
        >基础</button>
        <button
          type="button"
          class="seg"
          :class="{ on: variant === 'pot' }"
          :aria-pressed="variant === 'pot'"
          @click="variant = 'pot'"
        >潜能</button>
      </span>
      <!-- 等级滑块与技能名同条，靠右对齐；窄屏允许换行 -->
      <div class="level-row">
        <LevelSlider
          v-model="level"
          :min="1"
          :max="maxLevel"
          :label="`核心技等级`"
        />
        <!-- 等级标签：显示数据 level（1-7） -->
        <span class="level-val mono">Lv.{{ current.level }}</span>
      </div>
    </div>

    <ul class="action-list">
      <li class="row">
        <span class="no mono">01</span>
        <div class="body">
          <h4 class="title title-skill">
            {{ current.coreName }}<span v-if="currentTag" class="pot-tag mono">{{ currentTag }}</span>
          </h4>
          <p v-if="current.desc[0]" class="desc" v-html="richDesc(current.desc[0])"></p>
        </div>
      </li>
      <li class="row">
        <span class="no mono">02</span>
        <div class="body">
          <h4 class="title title-skill">
            {{ current.extraName }}<span v-if="currentTag" class="pot-tag mono">{{ currentTag }}</span>
          </h4>
          <p v-if="current.desc[1]" class="desc" v-html="richDesc(current.desc[1])"></p>
        </div>
      </li>
      <!-- 潜能模式：追加「潜能觉醒：极冰带」等潜能影像强化效果行 -->
      <li v-if="variant === 'pot' && potBoost" class="row">
        <span class="no mono">03</span>
        <div class="body">
          <h4 class="title title-skill">{{ potBoost.name || '潜能觉醒' }}</h4>
          <p class="desc" v-html="richDesc(potBoost.desc)"></p>
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

/* 「潜能·强化」版本徽标：随技能名展示，细线小标签（强化为弱墨） */
.pot-tag {
  display: inline-block;
  margin-left: 8px;
  font-style: normal;
  font-size: 9px;
  letter-spacing: 0.12em;
  padding: 1px 5px;
  border: 1px solid var(--line-2);
  color: var(--ink-2);
  vertical-align: 2px;
}

/* 版本切换：细线分段控件，随「核心技」名称右侧，选中态琥珀 */
.variant-seg {
  display: inline-flex;
  border: 1px solid var(--line-2);
  border-radius: 2px;
  overflow: hidden;
  font-size: 9px;
  letter-spacing: 0.1em;
  line-height: 1;
  flex: none;
}
.variant-seg .seg {
  padding: 5px 8px;
  border: none;
  background: transparent;
  color: var(--ink-3);
  cursor: pointer;
  font: inherit;
  letter-spacing: inherit;
}
.variant-seg .seg + .seg {
  border-left: 1px solid var(--line-2);
}
.variant-seg .seg.on {
  color: var(--amber);
  background: var(--bg-1);
}
.variant-seg .seg:focus-visible {
  outline: 1px solid var(--amber);
  outline-offset: -1px;
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
