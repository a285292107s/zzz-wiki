<script setup lang="ts">
import { computed, reactive } from 'vue'
import { dazeRecoverySeconds, dazeRecoverySpeed, formatPercent, formatSeconds } from '@/domain/combatMath'
import LevelSlider from '@/components/detail/LevelSlider.vue'
import LabFrame from './LabFrame.vue'

const SPEEDS = [
  { id: 'fast', label: '50%／秒', note: '袭扰猎兵、劫掠者、恶灵等：恢复 2 秒' },
  { id: 'normal', label: '15.38%／秒', note: '其他普通敌人：恢复 6.5 秒' },
  { id: 'elite', label: '10%／秒', note: '其他精英敌人：恢复 10 秒' },
  { id: 'boss', label: '8.33%／秒', note: '其他首领敌人（含渔人蟹）：恢复 12 秒' },
  { id: 'heavy', label: '7.69%／秒', note: '「卫士」、法布提、凶心疯汉、巴罗姆：恢复 13 秒' },
]

const SPEED_VALUE: Record<string, number> = {
  fast: 0.5,
  normal: 0.1538,
  elite: 0.1,
  boss: 0.0833,
  heavy: 0.0769,
}

const PRESETS = [
  { label: '凶心疯汉 · 怀表 +60% / T 型拐 −9%', speed: 0.0769, adjust: 51 },
  { label: '装甲哈提 · 枯败花圃 +100% / T 型拐 −13%', speed: 0.0833, adjust: 87 },
]

const input = reactive({ speed: 'boss', adjust: 0, compensation: false })

const baseSpeed = computed(() => SPEED_VALUE[input.speed] ?? 0.0833)
const speed = computed(() => dazeRecoverySpeed(baseSpeed.value, [input.adjust / 100]))
const recovery = computed(() => dazeRecoverySeconds(baseSpeed.value, [input.adjust / 100]))
const totalWindow = computed(() => 1 + (input.compensation ? 1 : 0) + recovery.value)

const presetRows = computed(() =>
  PRESETS.map((p) => ({
    ...p,
    speed: dazeRecoverySpeed(p.speed, [p.adjust / 100]),
    seconds: dazeRecoverySeconds(p.speed, [p.adjust / 100]),
  })),
)

function applyPreset(p: (typeof PRESETS)[number]) {
  const found = Object.entries(SPEED_VALUE).find(([, v]) => Math.abs(v - p.speed) < 0.0005)
  input.speed = found?.[0] ?? 'boss'
  input.adjust = p.adjust
  input.compensation = false
}

const segments = computed(() => {
  const list = [
    { id: 'crit', label: '临界时间', seconds: 1 },
    { id: 'comp', label: '连携补偿', seconds: input.compensation ? 1 : 0 },
    { id: 'rec', label: '失衡恢复期', seconds: recovery.value },
  ]
  return list.filter((s) => s.seconds > 0)
})

const selectedSpeed = computed(() => SPEEDS.find((s) => s.id === input.speed) ?? SPEEDS[3])
</script>

<template>
  <LabFrame
    anchor="daze-lab"
    title="失衡窗口构成"
    en="THE STUN WINDOW"
    lead="失衡窗口由瘫痪 1 秒（临界时间）与按失衡恢复速度计算的恢复期构成；「失衡持续时间提升 50%」实际改的是速度，秒数因敌人而异。下方可选择初始速度与调整量。"
  >
    <div class="daze-grid">
      <div class="daze-controls">
        <p class="ctl-group-label mono">初始失衡恢复速度</p>
        <div class="speed-btns" role="group" aria-label="初始失衡恢复速度">
          <button
            v-for="s in SPEEDS"
            :key="s.id"
            type="button"
            class="seg mono"
            :class="{ on: input.speed === s.id }"
            :aria-pressed="input.speed === s.id"
            @click="input.speed = s.id"
          >{{ s.label }}</button>
        </div>
        <p class="ctl-hint">{{ selectedSpeed.note }}</p>

        <div class="ctl">
          <label class="ctl-head" for="daze-adjust">
            <span class="ctl-label">恢复速度调整</span>
            <span class="ctl-value mono">{{ input.adjust > 0 ? '+' : '' }}{{ input.adjust }}%</span>
          </label>
          <LevelSlider
            id="daze-adjust"
            v-model="input.adjust"
            :min="-40"
            :max="160"
            :step="1"
            label="失衡恢复速度调整"
            :value-text="`${input.adjust > 0 ? '+' : ''}${input.adjust}%`"
          />
        </div>

        <div class="ctl">
          <div class="ctl-head">
            <span class="ctl-label">连携补偿</span>
            <button
              type="button"
              class="seg mono"
              role="switch"
              :aria-checked="input.compensation"
              @click="input.compensation = !input.compensation"
            >{{ input.compensation ? '已补偿 +1 秒' : '无补偿' }}</button>
          </div>
        </div>

        <div class="presets" role="group" aria-label="原文算例">
          <button
            v-for="p in PRESETS"
            :key="p.label"
            type="button"
            class="seg mono"
            @click="applyPreset(p)"
          >{{ p.label }}</button>
        </div>
      </div>

      <div class="daze-out">
        <p class="out-mode mono">失衡恢复期</p>
        <output class="out-value mono">{{ formatSeconds(recovery) }}</output>
        <p class="out-sub">
          调整后速度 <span class="mono">{{ formatPercent(speed) }}／秒</span>
          <span class="sep" aria-hidden="true">·</span>
          完整窗口 <span class="mono">{{ formatSeconds(totalWindow) }}</span>
        </p>

        <div class="timeline" aria-hidden="true">
          <span
            v-for="s in segments"
            :key="s.id"
            class="tl-seg"
            :class="`is-${s.id}`"
            :style="{ flexGrow: s.seconds }"
          />
        </div>
        <ul class="tl-legend">
          <li v-for="s in segments" :key="s.id" :class="`is-${s.id}`">
            <i aria-hidden="true" />
            <span>{{ s.label }} <b class="mono">{{ formatSeconds(s.seconds) }}</b></span>
          </li>
        </ul>

        <p class="out-foot">
          百分比调整改的是速度：加减先合并，再乘到初始速度；固定「延长失衡恢复时间 n 秒」
          只推迟恢复起点，可叠加。
        </p>
      </div>
    </div>

    <div class="preset-table">
      <p class="ctl-group-label mono">原文算例复核</p>
      <ul class="pr-list">
        <li v-for="p in presetRows" :key="p.label" class="pr">
          <span class="pr-name">{{ p.label }}</span>
          <span class="pr-speed mono">{{ formatPercent(p.speed) }}／秒</span>
          <span class="pr-time mono">{{ formatSeconds(p.seconds) }}</span>
        </li>
      </ul>
    </div>
  </LabFrame>
</template>

<style scoped>
.daze-grid {
  display: grid;
  gap: clamp(18px, 3vw, 32px);
  margin-top: 18px;
}

.daze-controls {
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

.speed-btns,
.presets {
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
  transition: color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease),
    background var(--t-fast) var(--ease);
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

.ctl-hint {
  font-size: var(--fs-nano);
  letter-spacing: 0.04em;
  line-height: 1.7;
  color: var(--ink-2);
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

.daze-out {
  min-width: 0;
}

.out-mode {
  font-size: var(--fs-nano);
  letter-spacing: 0.2em;
  color: var(--ink-2);
}

.out-value {
  margin-top: 4px;
  font-size: var(--fs-hero);
  color: var(--ink-0);
  line-height: 1.15;
}

.out-sub {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  margin-top: 6px;
  font-size: var(--fs-small);
  line-height: 1.7;
  color: var(--ink-1);
}

.out-sub .sep {
  color: var(--line-2);
}

.timeline {
  display: flex;
  gap: 2px;
  height: 12px;
  margin-top: 16px;
}

.tl-seg {
  flex-basis: 0;
  min-width: 4px;
}

.tl-seg.is-crit {
  background: var(--amber);
}

.tl-seg.is-comp {
  background: var(--amber-hi);
}

.tl-seg.is-rec {
  background: var(--line-2);
}

.tl-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin-top: 8px;
  font-size: var(--fs-caption);
  color: var(--ink-1);
}

.tl-legend li {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tl-legend i {
  width: 12px;
  height: 5px;
  background: var(--line-2);
}

.tl-legend li.is-crit i {
  background: var(--amber);
}

.tl-legend li.is-comp i {
  background: var(--amber-hi);
}

.tl-legend b {
  color: var(--ink-0);
  font-weight: 400;
}

.out-foot {
  margin-top: 14px;
  max-width: 62ch;
  font-size: var(--fs-caption);
  line-height: 1.8;
  color: var(--ink-2);
}

.preset-table {
  margin-top: 20px;
  padding-top: 14px;
  border-top: 1px solid var(--line-0);
}

.pr-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.pr {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--line-0);
}

.pr-name {
  flex: 1 1 240px;
  font-size: var(--fs-caption);
  color: var(--ink-1);
}

.pr-speed,
.pr-time {
  font-size: var(--fs-caption);
  color: var(--ink-0);
}

@media (min-width: 860px) {
  .daze-grid {
    grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
  }
}
</style>
