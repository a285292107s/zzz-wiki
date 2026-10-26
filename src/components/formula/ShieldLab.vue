<script setup lang="ts">
import { computed } from 'vue'
import { defenseZone, enemyDefense, formatFactor, formatPercent } from '@/domain/combatMath'
import LabFrame from './LabFrame.vue'

const BOSS_DEF = enemyDefense(60)
const SHIELD_MULT = 1.8
const SHIELD_TAKEN_DOWN = 0.25

const rows = computed(() => {
  const normalNoShield = defenseZone(BOSS_DEF)
  const normalShield = defenseZone(BOSS_DEF * SHIELD_MULT) * (1 - SHIELD_TAKEN_DOWN)
  const pierceNoShield = 1
  const pierceShield = 1 - SHIELD_TAKEN_DOWN
  return [
    { id: 'n0', label: '常规伤害 · 无盾', value: normalNoShield, note: '只过防御区' },
    { id: 'n1', label: '常规伤害 · 持盾', value: normalShield, note: '防御 ×1.8，再乘 0.75' },
    { id: 'p0', label: '贯穿伤害 · 无盾', value: pierceNoShield, note: '跳过防御区' },
    { id: 'p1', label: '贯穿伤害 · 持盾', value: pierceShield, note: '跳过防御区，只吃减伤' },
  ].map((r) => ({ ...r, ratio: r.value / normalNoShield }))
})

const maxRatio = computed(() => Math.max(...rows.value.map((r) => r.ratio)))
const baseline = computed(() => `${100 / maxRatio.value}%`)
const shieldRatio = computed(() => rows.value[3].value / rows.value[1].value)
</script>

<template>
  <LabFrame
    anchor="shield-lab"
    title="秽盾下的两条链"
    en="THE SHIELD"
    lead="秽浊流界同时抬高防御（×1.8）与减伤（25%）：常规伤害两笔都吃，贯穿伤害只吃减伤，命破占优。下方四条读数以 60 级首领为准。"
  >
    <ul class="bars">
      <li v-for="r in rows" :key="r.id" class="bar-row">
        <span class="bar-label">{{ r.label }}</span>
        <span class="bar-track" aria-hidden="true">
          <i :style="{ width: `${(r.ratio / maxRatio) * 100}%` }" />
          <b class="bar-base" :style="{ left: baseline }" />
        </span>
        <span class="bar-value mono">{{ formatPercent(r.ratio) }}</span>
        <span class="bar-note">{{ r.note }}</span>
      </li>
    </ul>
    <p class="bars-legend">虚竖线＝「常规伤害 · 无盾」的 100% 基准，四条同比例。</p>

    <div class="verdict">
      <p>
        同一份基础伤害：持盾时常规伤害剩
        <b class="mono">{{ formatPercent(rows[1].ratio) }}</b>，贯穿伤害为
        <b class="mono">{{ formatPercent(rows[3].ratio) }}</b>，相差
        <b class="mono">{{ formatFactor(shieldRatio) }}</b>。
      </p>
      <p class="verdict-sub">
        无盾时差距为 <span class="mono">{{ formatFactor(1 / rows[0].value) }}</span>。
        防御与减伤越高，跳过防御区的收益越大；若目标已被减防与穿透压低，则该优势收窄。
      </p>
    </div>

    <div class="miasma">
      <p class="ctl-group-label mono">秽息浸染</p>
      <div class="meter" role="img" aria-label="秽息浸染上限 400，默认每秒衰减 1.5%，满值触发全队当前生命 15% 的伤害">
        <span class="meter-track" />
        <span class="meter-cap" />
        <span class="meter-label start mono">0</span>
        <span class="meter-label end mono">400 · 触发</span>
      </div>
      <p class="miasma-note">
        队伍属性：初始 0、上限 400、默认每秒衰减 1.5%；满值时对全队造成各自当前生命 15% 的伤害，
        无视护盾并击飞。极限闪避、招架支援、回避支援可消除部分浸染值。
      </p>
    </div>
  </LabFrame>
</template>

<style scoped>
.bars {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 18px;
  max-width: 760px;
}

.bar-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 32px;
  gap: 2px 12px;
  align-items: baseline;
}

.bar-label {
  font-size: var(--fs-caption);
  color: var(--ink-1);
}

.bar-value {
  font-size: var(--fs-caption);
  color: var(--ink-0);
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.bar-track {
  grid-column: 1 / -1;
  position: relative;
  display: block;
  height: 8px;
  background: var(--bg-2);
  border-left: 1px solid var(--line-2);
}

.bar-track i {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: var(--amber);
}

.bar-base {
  position: absolute;
  top: -3px;
  bottom: -3px;
  width: 1px;
  border-left: 1px dashed var(--line-2);
}

.bars-legend {
  margin-top: 10px;
  font-size: var(--fs-nano);
  letter-spacing: 0.02em;
  color: var(--ink-2);
}

.bar-row:nth-child(2) .bar-track i {
  background: color-mix(in srgb, var(--amber) 42%, var(--line-2));
}

.bar-note {
  grid-column: 1 / -1;
  font-size: var(--fs-nano);
  letter-spacing: 0.02em;
  color: var(--ink-2);
}

.verdict {
  margin-top: 20px;
  padding: 12px 14px;
  border-left: 2px solid var(--amber);
  background: var(--bg-2);
  max-width: 70ch;
}

.verdict p {
  font-size: var(--fs-small);
  line-height: 1.85;
  color: var(--ink-1);
}

.verdict b {
  color: var(--ink-0);
  font-weight: 400;
}

.verdict .verdict-sub {
  margin-top: 6px;
  color: var(--ink-2);
}

.miasma {
  margin-top: 22px;
  padding-top: 16px;
  border-top: 1px solid var(--line-0);
}

.ctl-group-label {
  font-size: var(--fs-nano);
  letter-spacing: 0.18em;
  color: var(--ink-2);
  padding-bottom: 6px;
  border-bottom: 1px solid var(--line-0);
}

.meter {
  position: relative;
  height: 22px;
  margin-top: 14px;
  max-width: 520px;
}

.meter-track {
  position: absolute;
  left: 0;
  right: 0;
  top: 3px;
  height: 1px;
  background: var(--line-1);
}

.meter-cap {
  position: absolute;
  right: 0;
  top: 0;
  width: 1px;
  height: 7px;
  background: var(--amber);
}

.meter-label {
  position: absolute;
  top: 8px;
  font-size: var(--fs-nano);
  color: var(--ink-2);
}

.meter-label.start {
  left: 0;
}

.meter-label.end {
  right: 0;
  color: var(--amber);
}

.miasma-note {
  margin-top: 18px;
  max-width: 66ch;
  font-size: var(--fs-caption);
  line-height: 1.8;
  color: var(--ink-2);
}
</style>
