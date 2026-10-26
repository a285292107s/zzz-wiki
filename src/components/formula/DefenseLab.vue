<script setup lang="ts">
import { computed, reactive } from 'vue'
import {
  defenseZone,
  enemyDefense,
  formatFactor,
  formatPercent,
  formatStat,
} from '@/domain/combatMath'
import { ENEMY_PRESETS, type EnemyPresetId } from '@/data/formulaGuide'
import LevelSlider from '@/components/detail/LevelSlider.vue'
import LabFrame from './LabFrame.vue'

const CANDIDATE_BONUS = 0.3
const CANDIDATE_PEN = 0.24

const input = reactive({ pen: 0, defDown: 0, enemy: 'boss' as EnemyPresetId })

const SCENARIOS: { label: string; pen: number; defDown: number; note: string }[] = [
  { label: '无其他穿透', pen: 0, defDown: 0, note: '裸装：仅候选 24% 穿透率' },
  { label: '妮可 40% 减防', pen: 0, defDown: 0.4, note: '减防与穿透率乘算，收益摊薄' },
  { label: '丽娜 30% 穿透', pen: 0.3, defDown: 0, note: '穿透率加算，24% 并入 54%' },
]

const rows = computed(() =>
  ENEMY_PRESETS.map((e) => {
    const def = enemyDefense(e.base1) * (e.shield ? 1.8 : 1)
    const zone = defenseZone(def)
    return { id: e.id, name: e.name, def, zone, pierce: 1 / zone }
  }),
)

const picked = computed(() => rows.value.find((r) => r.id === input.enemy) ?? rows.value[2])

const gain = computed(() => {
  const def = picked.value.def
  const before = defenseZone(def, { penRate: input.pen, defDown: input.defDown })
  const after = defenseZone(def, { penRate: input.pen + CANDIDATE_PEN, defDown: input.defDown })
  return after / before - 1
})

const threshold = computed(() => (gain.value > 0 ? CANDIDATE_BONUS / gain.value : Number.POSITIVE_INFINITY))

const scenarioRows = computed(() =>
  SCENARIOS.map((s) => {
    const def = picked.value.def
    const before = defenseZone(def, { penRate: s.pen, defDown: s.defDown })
    const after = defenseZone(def, { penRate: s.pen + CANDIDATE_PEN, defDown: s.defDown })
    const g = after / before - 1
    return { ...s, gain: g, threshold: CANDIDATE_BONUS / g }
  }),
)

function useScenario(s: (typeof SCENARIOS)[number]) {
  input.pen = s.pen
  input.defDown = s.defDown
}
</script>

<template>
  <LabFrame
    anchor="defense-lab"
    title="穿透率与防御区"
    en="THE DEFENSE LEDGER"
    lead="防御区只取决于攻方等级基数（60 级为 794）与受方有效防御，24% 穿透率的收益随之浮动。驱动盘 V 位「24% 穿透率」与「30% 属性增伤」的取舍即由此计算；下方可调穿透率与减防。"
  >
    <div v-scroll-region="'防御数据表（可横向滚动）'" class="def-table-wrap">
      <table class="hairline-table def-table">
        <caption class="sr-only">60 级各目标的防御、默认防御区与贯穿伤害倍数</caption>
        <thead>
          <tr>
            <th scope="col">目标</th>
            <th scope="col">60 级防御</th>
            <th scope="col">默认防御区</th>
            <th scope="col">贯穿伤害倍数</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id" :class="{ picked: r.id === input.enemy }">
            <th scope="row">
              <button type="button" class="pick" :aria-pressed="r.id === input.enemy" @click="input.enemy = r.id">
                {{ r.name }}
              </button>
            </th>
            <td class="mono">{{ formatStat(r.def) }}</td>
            <td class="mono">{{ formatFactor(r.zone) }}</td>
            <td class="mono">{{ formatFactor(r.pierce) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="lab-note">
      同等基础伤害下，贯穿伤害视防御区为 ×1，对{{ picked.name }}是常规伤害的
      <span class="mono">{{ formatFactor(picked.pierce) }}</span>。点选目标即可切换。
    </p>

    <div class="tradeoff">
      <div class="tradeoff-controls">
        <p class="ctl-group-label mono">已有增益</p>
        <div class="ctl">
          <label class="ctl-head" for="def-lab-pen">
            <span class="ctl-label">已有穿透率</span>
            <span class="ctl-value mono">{{ Math.round(input.pen * 100) }}%</span>
          </label>
          <LevelSlider
            id="def-lab-pen"
            :model-value="Math.round(input.pen * 100)"
            :min="0"
            :max="80"
            :step="1"
            label="已有穿透率"
            :value-text="`${Math.round(input.pen * 100)}%`"
            @update:model-value="input.pen = $event / 100"
          />
        </div>
        <div class="ctl">
          <label class="ctl-head" for="def-lab-defdown">
            <span class="ctl-label">已有减防</span>
            <span class="ctl-value mono">{{ Math.round(input.defDown * 100) }}%</span>
          </label>
          <LevelSlider
            id="def-lab-defdown"
            :model-value="Math.round(input.defDown * 100)"
            :min="0"
            :max="80"
            :step="1"
            label="已有减防"
            :value-text="`${Math.round(input.defDown * 100)}%`"
            @update:model-value="input.defDown = $event / 100"
          />
        </div>
        <div class="scenario-btns" role="group" aria-label="快捷情景">
          <button
            v-for="s in SCENARIOS"
            :key="s.label"
            type="button"
            class="seg mono"
            @click="useScenario(s)"
          >{{ s.label }}</button>
        </div>
      </div>

      <div class="tradeoff-out">
        <p class="out-mode mono">候选：+{{ CANDIDATE_BONUS * 100 }}% 增伤 ／ +{{ CANDIDATE_PEN * 100 }}% 穿透率</p>
        <p class="out-big mono">{{ formatFactor(1 + gain) }}</p>
        <p class="out-sub">
          24% 穿透率的提升为 <span class="mono">{{ formatPercent(gain) }}</span>
        </p>
        <p class="verdict">
          <template v-if="Number.isFinite(threshold)">
            原增伤区高于
            <b class="mono">{{ formatPercent(threshold) }}</b> 时，24% 穿透率优于 +30% 增伤。
          </template>
          <template v-else>防御已至下限，穿透无收益。</template>
        </p>
        <p class="out-foot">
          30% 增伤的相对收益是 30 ÷ 原增伤区，穿透则只看防御被削减的比例。
        </p>
      </div>
    </div>

    <div class="scenarios">
      <p class="ctl-group-label mono">原文算例（目标：{{ picked.name }}）</p>
      <ul class="scenario-list">
        <li v-for="s in scenarioRows" :key="s.label" class="scenario">
          <span class="s-name">{{ s.label }}</span>
          <span class="s-gain mono">穿透收益 {{ formatPercent(s.gain) }}</span>
          <span class="s-th mono">临界增伤区 {{ formatPercent(s.threshold) }}</span>
          <span class="s-note">{{ s.note }}</span>
        </li>
      </ul>
    </div>
  </LabFrame>
</template>

<style scoped>
.def-table-wrap {
  position: relative;
  margin-top: 18px;
  overflow-x: auto;
}

.def-table {
  min-width: 420px;
  font-size: var(--fs-caption);
}

.def-table td {
  font-size: var(--fs-caption);
  color: var(--ink-0);
  white-space: nowrap;
}

.def-table tr.picked th,
.def-table tr.picked td {
  background: var(--bg-2);
}

.pick {
  font-family: var(--serif);
  font-size: var(--fs-small);
  color: var(--ink-1);
  background: transparent;
  border: 0;
  border-bottom: 1px dotted var(--line-2);
  padding: 2px 0;
  cursor: pointer;
}

.def-table tr.picked .pick {
  color: var(--amber-hi);
  border-bottom-color: var(--amber);
}

.lab-note {
  margin-top: 10px;
  max-width: 66ch;
  font-size: var(--fs-small);
  line-height: 1.8;
  color: var(--ink-2);
}

.tradeoff {
  display: grid;
  gap: clamp(18px, 3vw, 32px);
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px solid var(--line-0);
}

.tradeoff-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
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

.scenario-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.seg {
  font-size: var(--fs-caption);
  letter-spacing: 0.04em;
  color: var(--ink-1);
  background: transparent;
  border: 1px solid var(--line-1);
  border-radius: 2px;
  padding: 5px 10px;
  min-height: 24px;
  cursor: pointer;
  transition: color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease);
}

@media (hover: hover) {
  .seg:hover {
    color: var(--ink-0);
    border-color: var(--line-2);
  }
}

.tradeoff-out {
  min-width: 0;
}

.out-mode {
  font-size: var(--fs-nano);
  letter-spacing: 0.16em;
  color: var(--ink-2);
}

.out-big {
  margin-top: 6px;
  font-size: var(--fs-hero);
  color: var(--ink-0);
  line-height: 1.15;
}

.out-sub {
  margin-top: 6px;
  font-size: var(--fs-small);
  line-height: 1.8;
  color: var(--ink-1);
}

.verdict {
  margin-top: 10px;
  padding: 10px 12px;
  border-left: 2px solid var(--amber);
  background: var(--bg-2);
  font-size: var(--fs-small);
  line-height: 1.8;
  color: var(--ink-1);
  text-wrap: balance;
}

.verdict b {
  color: var(--ink-0);
}

.out-foot {
  margin-top: 10px;
  font-size: var(--fs-caption);
  line-height: 1.8;
  color: var(--ink-2);
}

.scenarios {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--line-0);
}

.scenario-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
}

.scenario {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 2px 16px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--line-0);
}

.s-name {
  font-family: var(--serif);
  font-size: var(--fs-small);
  color: var(--ink-0);
}

.s-gain,
.s-th {
  font-size: var(--fs-caption);
  color: var(--ink-1);
}

.s-note {
  font-size: var(--fs-caption);
  line-height: 1.7;
  color: var(--ink-2);
}

@media (min-width: 860px) {
  .tradeoff {
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  }

  .scenario {
    grid-template-columns: minmax(140px, 0.9fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.4fr);
    align-items: baseline;
    padding-bottom: 8px;
  }
}
</style>
