<script setup lang="ts">
import { computed, ref } from 'vue'
import LabFrame from './LabFrame.vue'

const LEVELS = [1, 2, 3, 4, 5, 6]

const ATTACKS = [
  { label: '普通攻击 / 冲刺攻击', level: 1, note: '多为 1 或 2 级' },
  { label: '特殊技', level: 2, note: '' },
  { label: '强化特殊技 / 闪避反击 / 支援突击', level: 4, note: '' },
  { label: '轻招架支援', level: 4, note: '「无视招架」的招式降 2 级' },
  { label: '连携技 / 终结技 / 重招架', level: 6, note: '「无视招架」的招式降 4 级' },
]

const TARGETS = [
  { label: '代理人 / 邦布', level: 1, note: '默认 1 级' },
  { label: '普通敌人', level: 1, note: '曼德拉、绞杀藤等为 99 级' },
  { label: '精英敌人', level: 3, note: '强化型为 5 级' },
  { label: '大型精英 / 强化型精英', level: 5, note: '' },
  { label: '首领敌人', level: 5, note: '工程机械类为 99 级' },
]

const attackIdx = ref(2)
const targetIdx = ref(4)

const attackItem = computed(() => ATTACKS[attackIdx.value] ?? ATTACKS[0])
const targetItem = computed(() => TARGETS[targetIdx.value] ?? TARGETS[0])
const breaks = computed(() => attackItem.value.level >= targetItem.value.level)
</script>

<template>
  <LabFrame
    anchor="interrupt-lab"
    title="一次比较，不是一条韧性条"
    en="THE INTERRUPT CHECK"
    lead="打断只看两个数：攻击的打断等级，目标的抗打断等级。前者 ≥ 后者就打断，落在目标身上是一段硬直。等级相等即可——不需要「削掉」什么。两边都是变量：同一个攻击打不同目标、同一个目标面对不同攻击，结论都可能不同。"
  >
    <div v-scroll-region="'打断判定表（可横向滚动）'" class="grid-wrap">
      <table class="grid">
        <caption class="sr-only">打断等级与抗打断等级的判定表：攻击等级大于等于目标等级时才能打断</caption>
        <thead>
          <tr>
            <th scope="col" class="corner">攻击等级 ／ 目标等级</th>
            <th v-for="l in LEVELS" :key="l" scope="col" :class="{ hl: l === targetItem.level }">Lv{{ l }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in LEVELS" :key="a" :class="{ hl: a === attackItem.level }">
            <th scope="row" :class="{ hl: a === attackItem.level }">Lv{{ a }}</th>
            <td
              v-for="t in LEVELS"
              :key="t"
              :class="{ ok: a >= t, hl: a === attackItem.level && t === targetItem.level }"
            >
              <span v-if="a >= t" class="mark ok" aria-hidden="true">✓</span>
              <span v-else class="mark no" aria-hidden="true">—</span>
              <span class="sr-only">{{ a >= t ? '可打断' : '不可打断' }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="choose">
      <div class="choose-col">
        <p class="ctl-group-label mono">攻击方</p>
        <div class="chips">
          <button
            v-for="(a, i) in ATTACKS"
            :key="a.label"
            type="button"
            class="chip"
            :class="{ on: attackIdx === i }"
            :aria-pressed="attackIdx === i"
            @click="attackIdx = i"
          >{{ a.label }}<span class="chip-lv mono">Lv{{ a.level }}</span></button>
        </div>
      </div>
      <div class="choose-col">
        <p class="ctl-group-label mono">目标</p>
        <div class="chips">
          <button
            v-for="(t, i) in TARGETS"
            :key="t.label"
            type="button"
            class="chip"
            :class="{ on: targetIdx === i }"
            :aria-pressed="targetIdx === i"
            @click="targetIdx = i"
          >{{ t.label }}<span class="chip-lv mono">Lv{{ t.level }}</span></button>
        </div>
      </div>
    </div>

    <p class="verdict" role="status">
      {{ attackItem.label }}（Lv{{ attackItem.level }}）打 {{ targetItem.label }}（Lv{{ targetItem.level }}）：
      <b>{{ breaks ? '可以打断' : '打不断' }}</b>。
      <span class="verdict-note">
        打断的是敌人的攻击时触发「破招」，回复 10 点喧响值。
      </span>
    </p>
    <p v-if="attackItem.note || targetItem.note" class="foot-note">
      <template v-if="attackItem.note">{{ attackItem.label }}：{{ attackItem.note }}。</template>
      <template v-if="targetItem.note"> {{ targetItem.label }}：{{ targetItem.note }}。</template>
    </p>
  </LabFrame>
</template>

<style scoped>
.grid-wrap {
  position: relative;
  margin-top: 18px;
  overflow-x: auto;
}

.grid {
  border-collapse: collapse;
  font-size: var(--fs-caption);
}

.grid th,
.grid td {
  padding: 7px 10px;
  border-right: 1px solid var(--line-0);
  border-bottom: 1px solid var(--line-0);
  text-align: center;
}

.grid thead th {
  border-top: 1px solid var(--line-0);
}

.grid tr th:first-child,
.grid tr td:first-child {
  border-left: 1px solid var(--line-0);
}

.grid thead th {
  font-family: var(--mono);
  font-weight: 400;
  font-size: var(--fs-nano);
  letter-spacing: 0.08em;
  color: var(--ink-2);
}

.grid .corner {
  text-align: left;
  font-size: var(--fs-nano);
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.grid tbody th {
  font-family: var(--mono);
  font-weight: 400;
  font-size: var(--fs-nano);
  color: var(--ink-2);
}

.grid th.hl,
.grid td.hl {
  background: var(--amber-dim);
}

.mark {
  font-family: var(--mono);
  font-size: var(--fs-small);
}

.mark.ok {
  color: var(--amber);
}

.mark.no {
  color: var(--ink-3);
}

.choose {
  display: grid;
  gap: 14px;
  margin-top: 20px;
}

.choose-col {
  min-width: 0;
}

.ctl-group-label {
  font-size: var(--fs-nano);
  letter-spacing: 0.18em;
  color: var(--ink-2);
  padding-bottom: 6px;
  border-bottom: 1px solid var(--line-0);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.chip {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  font-size: var(--fs-caption);
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

.chip.on {
  color: var(--ink-0);
  border-color: var(--amber);
  background: var(--amber-dim);
}

@media (hover: hover) {
  .chip:hover {
    color: var(--ink-0);
    border-color: var(--line-2);
  }
}

.chip-lv {
  font-size: var(--fs-nano);
  color: var(--ink-2);
}

.verdict {
  margin-top: 18px;
  padding: 10px 12px;
  border-left: 2px solid var(--amber);
  background: var(--bg-2);
  max-width: 70ch;
  font-size: var(--fs-small);
  line-height: 1.8;
  color: var(--ink-1);
}

.verdict b {
  color: var(--ink-0);
  font-weight: 400;
}

.verdict-note {
  color: var(--ink-2);
}

.foot-note {
  margin-top: 10px;
  max-width: 70ch;
  font-size: var(--fs-caption);
  line-height: 1.8;
  color: var(--ink-2);
}

@media (min-width: 780px) {
  .choose {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 24px;
  }
}
</style>
