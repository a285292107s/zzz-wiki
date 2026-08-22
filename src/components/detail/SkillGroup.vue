<script setup lang="ts">
import { computed, ref } from 'vue'
import { richDesc } from '@/utils/rich'
import {
  SKILL_LEVEL_DEFAULT,
  SKILL_LEVEL_MAX,
  SKILL_LEVEL_MIN,
  buildSkillMetricTable,
  potentialStartLevel,
  skillDetailValue,
  type SkillDetail,
  type SkillGroup,
  type SkillRow,
} from '@/domain/sections'
import HollowImage from '../HollowImage.vue'
import LevelSlider from './LevelSlider.vue'

const props = defineProps<{
  row: SkillRow
  glyph: string
  srcs: string[]
  /** 等级上限（默认 12 级）；邦布等上限不同的槽位传入 skill.levelCount。上限即默认满级 */
  levelCount?: number
  /** 角色技能组启用「段×指标」转置表：多段招式压缩为一行一段（邦布保持纵向列表） */
  transpose?: boolean
}>()

/** 每个技能槽独立的提升等级，默认最高级（= levelCount，如邦布 10/5 级） */
const level = ref(props.levelCount ?? SKILL_LEVEL_DEFAULT)

/** 展示版本：潜能（激发后，默认态）或基础（未激发）；大类无潜能技能时恒为潜能 */
const variant = ref<'pot' | 'base'>('pot')

/** 大类是否受潜能影像影响（存在任一门控/新增/双形态招式），决定是否显示切换 */
const hasPot = computed(() =>
  (props.row.groups ?? []).some((g) => (g.potential?.length ?? 0) > 0),
)

/** 招式说明文字：同名双形态按当前版本取（潜能取强化版，否则基础版）；支持函数形式（邦布按级描述） */
function groupDesc(grp: SkillGroup, lv: number): string | undefined {
  const raw =
    variant.value === 'pot' && grp.strongDesc ? grp.strongDesc : grp.desc
  return typeof raw === 'function' ? raw(lv) : raw
}

/** 补充行展示值：无 Skill 引用的静态文本（如「1点」充能计数）直接展示原文，其余按等级求值 */
function extraValue(en: SkillDetail): string {
  if (!en.formula.includes('{Skill:') && !en.values?.length) return en.formula || '—'
  return skillDetailValue(en, level.value)
}

/** 展示组：潜能模式下含全部招式；基础模式下隐藏「新增」招式（激发潜能前不存在） */
const displayGroups = computed(() =>
  (props.row.groups ?? [])
    .filter((grp) => variant.value === 'pot' || grp.potentialType !== 'new')
    .map((grp) => ({
      grp,
      table:
        props.transpose && grp.entries?.length
          ? buildSkillMetricTable(grp, level.value)
          : null,
    })),
)

/** 潜能影像门控标记：由招式档位 + 类型得到徽标文本（新增/强化）；
 *  同名双形态（enhance）仅在潜能版显示；非门控返回 null */
function potTag(grp: SkillGroup): string | null {
  const lv = potentialStartLevel(grp.potential)
  if (!lv) return null
  if (grp.potentialType === 'enhance' && variant.value !== 'pot') return null
  const kind = grp.potentialType === 'new' ? '新增' : '强化'
  return `潜能${lv}·${kind}`
}
</script>

<template>
  <div class="skill-group">
    <div class="skill-kind-row">
      <span class="key-glyph">
        <!-- 图标位：默认 HollowImage 候选链；邦布等可经 #glyph 插槽替换（如字母占位框） -->
        <slot name="glyph">
          <HollowImage :srcs="props.srcs" :alt="row.zh" :fallback="props.glyph" />
        </slot>
        <em v-if="row.keyEn" class="mono">{{ row.keyEn }}</em>
      </span>
      <h3 class="skill-kind serif">{{ row.zh }}</h3>
      <!-- 大类含受潜能影像影响的技能时，显示「潜能激发」切换开关（默认打开） -->
      <button
        v-if="hasPot"
        type="button"
        class="pot-switch mono"
        role="switch"
        aria-label="潜能激发"
        :aria-checked="variant === 'pot'"
        @click="variant = variant === 'pot' ? 'base' : 'pot'"
      >
        <span class="sw-track" :class="{ on: variant === 'pot' }"><span class="sw-thumb"></span></span>
        <span class="sw-label">潜能激发</span>
      </button>
      <!-- 等级滑块与技能名同条，靠右对齐；窄屏允许换行 -->
      <div v-if="row.hasNumbers" class="level-row">
        <LevelSlider
          v-model="level"
          :min="SKILL_LEVEL_MIN"
          :max="levelCount ?? SKILL_LEVEL_MAX"
          :label="`${row.zh}等级`"
        />
        <span class="level-val mono">Lv.{{ level }}</span>
      </div>
    </div>

    <ul class="action-list">
      <li
        v-for="({ grp, table }, gi) in displayGroups"
        :key="grp.name || 'g' + gi"
        class="row"
      >
        <span class="no mono">{{ String(gi + 1).padStart(2, '0') }}</span>
        <div class="body">
          <h4 class="title title-skill">
            {{ grp.name }}
            <span
              v-if="potTag(grp)"
              class="pot-badge mono"
            >{{ potTag(grp) }}</span>
          </h4>
          <p v-if="grp.desc != null" class="desc" v-html="richDesc(groupDesc(grp, level) ?? '')"></p>
          <!-- 转置表：行=段次，列=指标（如 伤害倍率/失衡倍率），随所选等级取值；
               补充行（充能计数等）紧随表格，仅当可转置时出现，列表用 v-else 保证互斥 -->
          <template v-if="table">
            <table class="metric-table">
              <thead>
                <tr>
                  <th class="metric-row-head" scope="col">{{ table.rowLabel }}</th>
                  <th
                    v-for="c in table.columns"
                    :key="c.propId"
                    class="metric-col-head mono"
                    scope="col"
                  >
                    {{ c.label }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(r, ri) in table.rows" :key="ri">
                  <th class="metric-row-label" scope="row">{{ r.label || '—' }}</th>
                  <td
                    v-for="c in table.columns"
                    :key="c.propId"
                    class="metric-val mono"
                  >
                    {{ r.values[String(c.propId)] ?? '—' }}
                  </td>
                </tr>
              </tbody>
            </table>
            <ul v-if="table.extras?.length" class="metric-extras">
              <li v-for="(en, ei) in table.extras" :key="en.name || 'x' + ei" class="extra-item">
                <span class="extra-name">{{ en.name }}</span>
                <span class="extra-leader" aria-hidden="true"></span>
                <span class="extra-val mono">{{ extraValue(en) }}</span>
              </li>
            </ul>
          </template>
          <ul v-else-if="grp.entries?.length" class="stat-list">
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

/* ---------- 段×指标转置表（无边框：纯间距分层，无任何表格线） ---------- */

.metric-table {
  width: 100%;
  max-width: 560px;
  font-variant-numeric: tabular-nums;
  font-kerning: normal;
}
.metric-table :is(th, td) {
  padding: 10px 14px;
  text-align: right;
  font-size: 13.5px;
}
/* 轴列（段次）：width:1% 收缩至内容宽；指标列自动均分剩余空间 */
.metric-table :is(th, td):first-child {
  width: 1%;
  white-space: nowrap;
  text-align: left;
  padding-left: 0;
  padding-right: 24px;
}
/* 列头：无下缘线，靠字距/弱色/下方留白与数据行分层 */
.metric-table thead th {
  font-weight: 500;
  font-size: 11px;
  letter-spacing: 0.1em;
  color: var(--ink-3);
  padding-top: 0;
  padding-bottom: 12px;
}
/* 行标签（段次）：次级墨色 */
.metric-table .metric-row-label {
  font-weight: 400;
  color: var(--ink-1);
}
/* 数值：琥珀等宽，右对齐逐列对齐 */
.metric-table .metric-val {
  color: var(--amber);
}
/* 补充行：不属共享矩阵的条目（如充能计数），数值紧随名称、不撑满到矩阵列右缘 */
.metric-extras {
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
  max-width: 560px;
}
.extra-item {
  display: flex;
  align-items: baseline;
  padding: 6px 0;
  color: var(--ink-1);
  font-size: 13.5px;
}
.extra-name {
  min-width: 0;
  flex: none;
}
/* 点线引导：名称与数值之间以「·」填充，对齐基线（dot leader，与 KeyValueGrid 同源弱化墨色） */
.extra-leader {
  flex: 1;
  min-width: 16px;
  margin: 0 8px;
  height: 1em;
  border-bottom: 1px dotted color-mix(in srgb, var(--ink-2) 72%, transparent);
  transform: translateY(-0.35em);
}
.extra-val {
  flex: none;
  color: var(--amber);
}
/* 行悬停：极浅抬升（bg-1）——无表格线时是唯一行跟随线索，便于跨列对照 */
.metric-table tbody tr {
  transition: background var(--t-fast) var(--ease);
}
.metric-table tbody tr:hover {
  background: var(--bg-1);
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