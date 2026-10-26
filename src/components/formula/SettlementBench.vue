<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  bonusZone,
  chainProduct,
  critExpectation,
  critZone,
  defenseZone,
  enemyDefense,
  formatFactor,
  formatInt,
  formatStat,
  resistZone,
  stunVulnerabilityZone,
  vulnerabilityZone,
} from '@/domain/combatMath'
import LevelSlider from '@/components/detail/LevelSlider.vue'
import { ENEMY_PRESETS, type EnemyPresetId } from '@/data/formulaGuide'

type EnemyId = EnemyPresetId
type Key =
  | 'atk'
  | 'ratio'
  | 'bonus'
  | 'critRate'
  | 'critDmg'
  | 'pierceBonus'
  | 'pen'
  | 'defDown'
  | 'res'
  | 'vuln'
  | 'stunRate'

interface Row {
  key: Key
  label: string
  min: number
  max: number
  step: number
  fmt: (v: number) => string
}

interface Group {
  id: 'base' | 'attacker' | 'defender' | 'window'
  label: string
  rows: Row[]
}

const ENEMIES = ENEMY_PRESETS

const INITIAL: Record<Key, number> = {
  atk: 2000,
  ratio: 500,
  bonus: 120,
  critRate: 60,
  critDmg: 120,
  pierceBonus: 60,
  pen: 0,
  defDown: 0,
  res: 0,
  vuln: 0,
  stunRate: 100,
}

const state = reactive({ ...INITIAL })
const pierceMode = ref(false)
const enemyId = ref<EnemyId>('boss')
const stunned = ref(false)

const signedPercent = (v: number) => `${v > 0 ? '+' : ''}${v}%`

const GROUPS: Group[] = [
  {
    id: 'base',
    label: '基础',
    rows: [
      { key: 'atk', label: '攻击力', min: 500, max: 4000, step: 50, fmt: (v) => formatInt(v) },
      { key: 'ratio', label: '技能倍率', min: 50, max: 2000, step: 10, fmt: (v) => `${v}%` },
    ],
  },
  {
    id: 'attacker',
    label: '攻方',
    rows: [
      { key: 'bonus', label: '增伤区', min: 0, max: 600, step: 5, fmt: (v) => formatFactor(bonusZone(v / 100)) },
      { key: 'critRate', label: '暴击率', min: 0, max: 100, step: 1, fmt: (v) => `${v}%` },
      { key: 'critDmg', label: '暴击伤害', min: 50, max: 500, step: 5, fmt: (v) => `${v}%` },
    ],
  },
  {
    id: 'defender',
    label: '受方',
    rows: [
      { key: 'pen', label: '穿透率', min: 0, max: 100, step: 1, fmt: (v) => `${v}%` },
      { key: 'defDown', label: '减防', min: 0, max: 100, step: 1, fmt: (v) => `${v}%` },
      { key: 'res', label: '敌人抗性', min: -60, max: 60, step: 5, fmt: signedPercent },
    ],
  },
  {
    id: 'window',
    label: '窗口',
    rows: [
      { key: 'vuln', label: '减易伤', min: -60, max: 100, step: 5, fmt: signedPercent },
    ],
  },
]

const PIERCE_ROW: Row = {
  key: 'pierceBonus',
  label: '贯穿增伤',
  min: 0,
  max: 900,
  step: 5,
  fmt: (v) => formatFactor(1 + v / 100),
}

const STUN_ROW: Row = {
  key: 'stunRate',
  label: '失衡易伤倍率',
  min: 0,
  max: 200,
  step: 5,
  fmt: (v) => `${v}%`,
}

const visibleGroups = computed<Group[]>(() =>
  GROUPS.map((group) => {
    if (group.id === 'attacker' && pierceMode.value) {
      return { ...group, rows: [...group.rows, PIERCE_ROW] }
    }
    if (group.id === 'defender' && pierceMode.value) {
      return { ...group, rows: group.rows.filter((r) => r.key === 'res') }
    }
    if (group.id === 'window' && stunned.value) {
      return { ...group, rows: [...group.rows, STUN_ROW] }
    }
    return group
  }),
)

const enemy = computed(() => ENEMIES.find((e) => e.id === enemyId.value) ?? ENEMIES[2])
const enemyDef = computed(() => {
  const base = enemyDefense(enemy.value.base1)
  return enemy.value.shield ? base * 1.8 : base
})
const enemyDefText = computed(() => formatStat(enemyDef.value))

const base = computed(() => state.atk * (state.ratio / 100))
const bonusFactor = computed(() => bonusZone(state.bonus / 100))
const critExpect = computed(() => critExpectation(state.critRate / 100, state.critDmg / 100))
const critHit = computed(() => critZone(state.critDmg / 100))
const defenseFactor = computed(() =>
  defenseZone(enemyDef.value, { penRate: state.pen / 100, defDown: state.defDown / 100 }),
)
const resistFactor = computed(() => resistZone(state.res / 100))
const vulnFactor = computed(() => vulnerabilityZone(state.vuln / 100))
const stunFactor = computed(() => stunVulnerabilityZone(stunned.value, stunned.value ? state.stunRate / 100 : 0))
const pierceFactor = computed(() => 1 + state.pierceBonus / 100)

interface Gate {
  id: string
  name: string
  factor: number
}

const gates = computed<Gate[]>(() => [
  { id: 'bonus', name: '增伤区', factor: bonusFactor.value },
  { id: 'crit', name: '暴击区（期望）', factor: critExpect.value },
  pierceMode.value
    ? { id: 'pierce', name: '贯穿增伤区', factor: pierceFactor.value }
    : { id: 'def', name: '防御区', factor: defenseFactor.value },
  { id: 'res', name: '抗性区', factor: resistFactor.value },
  { id: 'vuln', name: '减易伤区', factor: vulnFactor.value },
  { id: 'stun', name: '失衡易伤区', factor: stunFactor.value },
  { id: 'special', name: '特殊乘区', factor: 1 },
])

const total = computed(() => chainProduct(gates.value.map((g) => g.factor)))
const expectDamage = computed(() => base.value * total.value)
const critDamage = computed(() => base.value * (total.value / critExpect.value) * critHit.value)

const trimmed = computed(() => {
  const notes: string[] = []
  if (state.bonus / 100 > 5) notes.push('增伤区达上限 ×6')
  if (state.vuln / 100 < -0.8) notes.push('减易伤区达下限 ×0.2')
  if (state.res / 100 > 1) notes.push('抗性区达下限 ×0')
  if (stunned.value && state.stunRate / 100 > 4) notes.push('失衡易伤区达上限 ×5')
  return notes
})

function barStyle(factor: number) {
  const width = Math.max(-50, Math.min(50, (Math.log2(factor) / 4) * 100))
  return width >= 0
    ? { left: '50%', width: `${width}%` }
    : { right: '50%', width: `${-width}%` }
}

function applyPreset(id: 'clean' | 'pen' | 'stun' | 'shield') {
  Object.assign(state, INITIAL)
  pierceMode.value = false
  enemyId.value = 'boss'
  stunned.value = false
  if (id === 'pen') state.pen = 24
  if (id === 'stun') stunned.value = true
  if (id === 'shield') {
    enemyId.value = 'shield'
    state.vuln = -25
  }
}
</script>

<template>
  <section class="bench" aria-labelledby="bench-title">
    <header class="bench-head">
      <div class="bench-title-row">
        <h3 id="bench-title" class="bench-title">结算台</h3>
        <span class="bench-en mono">SETTLEMENT BENCH</span>
      </div>
      <p class="bench-intro">
        同一份基础伤害依次经过七道闸。拖动读数，看最终伤害与各闸占比。
      </p>
      <div class="bench-modes" role="group" aria-label="伤害类型">
        <button
          type="button"
          class="seg mono"
          :class="{ on: !pierceMode }"
          :aria-pressed="!pierceMode"
          @click="pierceMode = false"
        >常规伤害</button>
        <button
          type="button"
          class="seg mono"
          :class="{ on: pierceMode }"
          :aria-pressed="pierceMode"
          @click="pierceMode = true"
        >贯穿伤害</button>
      </div>
    </header>

    <div class="bench-body">
      <div class="bench-controls">
        <div class="presets" role="group" aria-label="预设">
          <button type="button" class="seg mono" @click="applyPreset('clean')">裸装配</button>
          <button type="button" class="seg mono" @click="applyPreset('pen')">24% 穿透</button>
          <button type="button" class="seg mono" @click="applyPreset('stun')">失衡窗口</button>
          <button type="button" class="seg mono" @click="applyPreset('shield')">持秽盾首领</button>
        </div>

        <div v-for="group in visibleGroups" :key="group.id" class="ctl-group">
          <p class="ctl-group-label mono">{{ group.label }}</p>

          <div v-if="group.id === 'defender'" class="ctl-enemies-row">
            <div class="ctl-enemies" role="group" aria-label="敌人档次">
              <button
                v-for="e in ENEMIES"
                :key="e.id"
                type="button"
                class="seg"
                :class="{ on: enemyId === e.id }"
                :aria-pressed="enemyId === e.id"
                @click="enemyId = e.id"
              >{{ e.name }}</button>
            </div>
            <p class="ctl-hint mono">{{ enemy.note }}，有效防御 {{ enemyDefText }}</p>
          </div>

          <div v-if="group.id === 'window'" class="ctl">
            <div class="ctl-head">
              <span class="ctl-label">是否失衡</span>
              <button
                type="button"
                class="seg mono"
                role="switch"
                :aria-checked="stunned"
                @click="stunned = !stunned"
              >{{ stunned ? '失衡中' : '未失衡' }}</button>
            </div>
            <p class="ctl-hint">
              {{ stunned ? '按失衡易伤倍率结算。' : '按「未失衡时失衡易伤」计，默认 0，本区 ×1。' }}
            </p>
          </div>

          <div v-for="row in group.rows" :key="row.key" class="ctl">
            <label class="ctl-head" :for="`bench-${row.key}`">
              <span class="ctl-label">{{ row.label }}</span>
              <span class="ctl-value mono">{{ row.fmt(state[row.key]) }}</span>
            </label>
            <LevelSlider
              :id="`bench-${row.key}`"
              v-model="state[row.key]"
              :min="row.min"
              :max="row.max"
              :step="row.step"
              :label="row.label"
              :value-text="row.fmt(state[row.key])"
            />
          </div>
        </div>
      </div>

      <div class="bench-output">
        <p class="out-mode mono">{{ pierceMode ? '贯穿伤害' : '常规伤害' }} · 期望伤害</p>
        <output class="out-value mono">{{ formatInt(expectDamage) }}</output>
        <p class="out-sub">
          暴击时 <span class="mono">{{ formatInt(critDamage) }}</span>
          <span class="sep" aria-hidden="true">·</span>
          基础伤害 <span class="mono">{{ formatInt(base) }}</span>
          <span class="sep" aria-hidden="true">·</span>
          总倍率 <span class="mono">{{ formatFactor(total) }}</span>
        </p>

        <ol class="gates">
          <li v-for="g in gates" :key="g.id" class="gate">
            <span class="g-name">{{ g.name }}</span>
            <span class="g-factor mono">{{ formatFactor(g.factor) }}</span>
            <span class="g-bar" aria-hidden="true">
              <i class="g-datum" />
              <i class="g-fill" :class="{ loss: g.factor < 1 }" :style="barStyle(g.factor)" />
            </span>
          </li>
        </ol>
        <p class="gates-legend">
          横条自中心 ×1 起算：向右放大，向左衰减；长度取对数，×2 与 ×0.5 等长。
        </p>

        <p v-if="trimmed.length" class="out-warn" role="status">
          有效范围已截断：{{ trimmed.join('；') }}。
        </p>
        <p class="out-foot">
          期望值以（1 + 暴击率 × 暴击伤害）折算暴击区。距离衰减按站桩（×1）计入，特殊乘区恒为 ×1；
          远程代理人拉开距离时低于 1。
        </p>
        <p class="out-hint">
          读数越过有效范围后不再变化，超出的加成不计入结算。
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.bench {
  border: var(--rule);
  padding: clamp(16px, 2.4vw, 26px);
  margin-bottom: var(--space-group);
}

.bench-head {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.bench-title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 12px;
}

.bench-title {
  font-family: var(--serif);
  font-weight: 500;
  font-size: var(--fs-lead);
  color: var(--ink-0);
}

.bench-en {
  font-size: var(--fs-nano);
  letter-spacing: 0.2em;
  color: var(--ink-2);
}

.bench-intro {
  max-width: 62ch;
  font-size: var(--fs-small);
  line-height: 1.8;
  color: var(--ink-1);
}

.bench-modes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.seg {
  font-size: var(--fs-caption);
  letter-spacing: 0.06em;
  color: var(--ink-1);
  background: transparent;
  border: 1px solid var(--line-1);
  border-radius: 2px;
  padding: 5px 10px;
  min-height: 24px;
  transition: color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease),
    background var(--t-fast) var(--ease);
  cursor: pointer;
}

.seg.on {
  color: var(--ink-0);
  border-color: var(--amber);
  background: var(--amber-dim);
}

@media (hover: hover) {
  .seg:hover {
    color: var(--ink-0);
    border-color: var(--line-2);
  }
}

.bench-body {
  display: grid;
  gap: clamp(20px, 3vw, 32px);
  margin-top: 20px;
}

.bench-controls {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
}

.ctl-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ctl-group-label {
  font-size: var(--fs-nano);
  letter-spacing: 0.18em;
  color: var(--ink-2);
  padding-bottom: 6px;
  border-bottom: 1px solid var(--line-0);
}

.ctl {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ctl-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.ctl-label {
  font-size: var(--fs-caption);
  letter-spacing: 0.06em;
  color: var(--ink-1);
}

.ctl-value {
  font-size: var(--fs-small);
  color: var(--ink-0);
  font-variant-numeric: tabular-nums;
}

.ctl-enemies-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ctl-enemies {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ctl-hint {
  font-size: var(--fs-nano);
  letter-spacing: 0.04em;
  line-height: 1.6;
  color: var(--ink-2);
}

.presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-top: 4px;
}

.bench-output {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.out-mode {
  font-size: var(--fs-nano);
  letter-spacing: 0.2em;
  color: var(--ink-2);
}

.out-value {
  font-size: var(--fs-display);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.01em;
  color: var(--ink-0);
  line-height: 1.1;
}

.out-sub {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  font-size: var(--fs-small);
  color: var(--ink-1);
  line-height: 1.7;
}

.out-sub .sep {
  color: var(--line-2);
}

.gates {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(112px, 1fr));
  gap: 10px 16px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: var(--rule);
}

.gate {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.g-name {
  font-size: var(--fs-nano);
  letter-spacing: 0.08em;
  color: var(--ink-2);
}

.g-factor {
  font-size: var(--fs-body);
  color: var(--ink-0);
  font-variant-numeric: tabular-nums;
}

.g-bar {
  position: relative;
  display: block;
  height: 10px;
}

.g-bar::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 1px;
  background: var(--line-0);
}

.g-datum {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--line-2);
}

.g-fill {
  position: absolute;
  top: 2px;
  bottom: 2px;
  background: var(--amber);
}

.g-fill.loss {
  background: var(--ink-1);
}

.gates-legend {
  margin-top: 8px;
  max-width: 62ch;
  font-size: var(--fs-nano);
  line-height: 1.8;
  color: var(--ink-2);
}

.out-warn {
  margin-top: 10px;
  padding: 8px 10px;
  border-left: 2px solid var(--amber);
  background: var(--bg-2);
  font-size: var(--fs-caption);
  line-height: 1.7;
  color: var(--ink-1);
}

.out-foot,
.out-hint {
  margin-top: 12px;
  max-width: 62ch;
  font-size: var(--fs-caption);
  line-height: 1.8;
  color: var(--ink-2);
}

.out-hint {
  font-size: var(--fs-nano);
  letter-spacing: 0.02em;
}

@media (min-width: 900px) {
  .bench-body {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .bench-output {
    padding-left: clamp(20px, 3vw, 36px);
    border-left: 1px solid var(--line-0);
  }
}
</style>
