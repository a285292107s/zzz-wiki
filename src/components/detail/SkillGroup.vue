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

/** 技能等级：支持外部 v-model:level（连携技/终结技共享同一槽位等级时由父级注入）；
 *  未绑定时内部自管，默认最高级（= levelCount，如邦布 10/5 级） */
const levelModel = defineModel<number>('level')
const internalLevel = ref(props.levelCount ?? SKILL_LEVEL_DEFAULT)

/** 生效等级：外部绑定优先（共享源），否则用内部自管等级 */
const level = computed<number>({
  get: () => levelModel.value ?? internalLevel.value,
  set: (v) => {
    if (levelModel.value != null) levelModel.value = v
    else internalLevel.value = v
  },
})

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
 *  派生技能子块（derived）不悬挂徽标（非真实招式，仅为数值展示）；同名双形态（enhance）
 *  仅在潜能版显示；非门控返回 null */
function potTag(grp: SkillGroup): string | null {
  if (grp.derived) return null
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
            <span v-if="grp.derived" class="pot-badge derived-badge mono">派生技能</span>
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
}
/* 组间分隔：大类之间用主分隔线 + 组距（父级强于行间细线，修复层级倒挂） */
.skill-group + .skill-group {
  border-top: var(--rule);
  padding-top: var(--space-group);
}
.skill-kind-row {
  display: flex;
  align-items: center;
  gap: var(--row-gap);
  margin-bottom: 12px;
  /* 与招式行同款 4px 左右内边：图标列与 01/02 编号列同一纵向轴线 */
  padding: 0 4px;
  flex-wrap: wrap;
  row-gap: 10px;
}
.key-glyph {
  /* 与招式行编号列同宽：图标与 01/02 编号纵向同一轴线 */
  width: var(--label-col);
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}
.key-glyph :deep(.frame) {
  width: var(--label-col);
  height: var(--label-col);
  border-radius: 2px;
}
.key-glyph em {
  font-style: normal;
  font-size: var(--fs-badge);
  letter-spacing: 0.14em;
  color: var(--ink-3);
}
.skill-kind {
  font-family: var(--serif);
  font-size: var(--fs-lead);
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
  /* 招式行（同大类内子项）用细分隔线；大类间分隔见 .skill-group + .skill-group。
     不带 hover：行是垂直串读单元，无跨行对照需求，背景反馈只会暗示可点击 */
  border-bottom: 1px solid var(--line-0);
}
.no {
  color: var(--ink-3);
  font-size: var(--fs-caption);
  padding-top: 2px;
}
.body {
  min-width: 0;
}
.title {
  font-weight: 500;
  font-size: var(--fs-lead);
  line-height: 1.4;
  margin-bottom: 6px;
  color: var(--ink-0);
}
/* 派生技能徽标（「派生技能」）：复用 pot-badge 基座（base.css 细线小签），仅覆盖颜色为紫色——
   派生技能不是可操作招式，仅为数值面板（如「涡流集束手雷基础倍率」） */
.derived-badge {
  border-color: var(--violet);
  color: var(--violet);
}
.desc {
  color: var(--ink-1);
  font-size: var(--fs-small);
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
  /* 与转置表同宽：同一技能块内的数值区右缘一致 */
  max-width: 560px;
}
.stat-item {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding: 6px 0;
  color: var(--ink-1);
  font-size: var(--fs-small);
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
  font-size: var(--fs-small);
}

/* ---------- 段×指标转置表（无边框：纯间距分层，无任何表格线） ---------- */

.metric-table {
  width: 100%;
  max-width: 560px;
  /* collapse：无边框亦生效——separate 模型下 cell 间默认 2px 间隙会露出页面底色，
     hover 行背景被切割成数段；collapse 让行背景跨 cell 连续 */
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
  font-kerning: normal;
}
.metric-table :is(th, td) {
  padding: 10px 14px;
  text-align: right;
  font-size: var(--fs-small);
}
/* 轴列（段次）：width:1% 收缩至内容宽；指标列自动均分剩余空间。
   左留 8px 避让行悬停时行首的琥珀标注（2px 条 + 6px 间距） */
.metric-table :is(th, td):first-child {
  width: 1%;
  white-space: nowrap;
  text-align: left;
  padding-left: 8px;
  padding-right: 24px;
}
/* 列头：无下缘线，靠字距/弱色/下方留白与数据行分层 */
.metric-table thead th {
  font-weight: 500;
  font-size: var(--fs-micro);
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
  font-size: var(--fs-small);
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
/* 行悬停：无表格线时唯一的行跟随线索，便于跨列对照 ——
   面锚定用 bg-3（token 预置的 hover 层级，明显可感知而不刺眼），
   行首加 2px 琥珀竖条作定向标注（内缩式，非边框线，不破坏无表格线承诺），避免扫视看岔。
   竖条挂首个 cell 而非 tr：table-row 上的 absolute 伪元素会破坏 Chrome 列轨道计算
   （thead/tbody 列错位一格），挂 table-cell 是安全用法 */
.metric-table tbody tr {
  transition: background var(--t-fast) var(--ease);
}
.metric-table tbody :is(th, td):first-child {
  position: relative;
}
.metric-table tbody :is(th, td):first-child::before {
  content: '';
  position: absolute;
  left: 0;
  top: 6px;
  bottom: 6px;
  width: 2px;
  background: var(--amber);
  opacity: 0;
  transition: opacity var(--t-fast) var(--ease);
}
.metric-table tbody tr:hover {
  background: var(--bg-3);
}
.metric-table tbody tr:hover :is(th, td):first-child::before {
  opacity: 1;
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
  font-size: var(--fs-caption);
  color: var(--amber);
  min-width: 3.4em;
  text-align: right;
}

/* 窄屏：转置表列距收紧（多列指标并列时不挤压，保持可读） */
@media (max-width: 560px) {
  .metric-table :is(th, td) {
    padding: 9px 8px;
  }
  .metric-table :is(th, td):first-child {
    padding-left: 6px;
    padding-right: 14px;
  }
  .metric-table thead th {
    padding-bottom: 10px;
  }
}
</style>