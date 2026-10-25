<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { FORMULA_GUIDE, zoneById, type Zone } from '@/data/formulaGuide'

const families = FORMULA_GUIDE.families

const damageZones = computed<Zone[]>(() => {
  const used = new Set(families.flatMap((f) => f.chain))
  return FORMULA_GUIDE.zones.filter((z) => used.has(z.id))
})

function nameOf(id: string): string {
  return zoneById(id)?.name ?? id
}

const pivotNote = '贯穿伤害以「贯穿增伤区」取代「防御区」，其余乘区与常规伤害一致。'
</script>

<template>
  <!-- 四条链并排：差别只在被标出的那一处 -->
  <div class="chains">
    <div v-for="f in families" :key="f.id" class="chain">
      <p class="chain-head">
        <span class="chain-name">{{ f.name }}</span>
        <span class="chain-en mono">{{ f.en }}</span>
        <span class="chain-badge mono">{{ f.badge }}</span>
      </p>
      <p class="chain-terms">
        <template v-for="(id, i) in f.chain" :key="id">
          <span v-if="i > 0" class="op" aria-hidden="true">×</span>
          <RouterLink
            :to="{ hash: `#z-${id}` }"
            class="term"
            :class="{ pivot: id === 'def' || id === 'pierce' }"
          >{{ nameOf(id) }}</RouterLink>
        </template>
      </p>
      <p class="chain-note">{{ f.note }}</p>
    </div>
  </div>

  <div v-scroll-region="'乘区参与对照表（可横向滚动）'" class="matrix-wrap">
    <table class="matrix">
      <caption class="sr-only">
        各伤害类型参与的乘区对照表：● 表示参与，— 表示不参与
      </caption>
      <thead>
        <tr>
          <th scope="col" class="c-zone">乘区</th>
          <th v-for="f in families" :key="f.id" scope="col" class="c-fam">{{ f.name }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="z in damageZones" :key="z.id">
          <th scope="row" class="c-zone">
            <a :href="`#z-${z.id}`" class="zone-link">{{ z.name }}</a>
          </th>
          <td v-for="f in families" :key="f.id" class="c-cell">
            <span v-if="f.chain.includes(z.id)" class="yes" aria-hidden="true">●</span>
            <span v-else class="no" aria-hidden="true">—</span>
            <span class="sr-only">{{ f.chain.includes(z.id) ? '参与' : '不参与' }}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <p class="matrix-legend">
    <span class="lg yes" aria-hidden="true">●</span> 计入这一链
    <span class="sep" aria-hidden="true">·</span>
    <span class="lg no" aria-hidden="true">—</span> 不计入
    <span class="sep" aria-hidden="true">·</span>
    {{ pivotNote }}
  </p>
</template>

<style scoped>
.chains {
  display: flex;
  flex-direction: column;
  gap: var(--space-group);
  margin-bottom: var(--space-group);
}

.chain {
  padding-left: 16px;
  border-left: 1px solid var(--line-1);
}

.chain-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 12px;
}

.chain-name {
  font-family: var(--serif);
  font-size: var(--fs-lead);
  color: var(--ink-0);
}

.chain-en {
  font-size: var(--fs-nano);
  letter-spacing: 0.2em;
  color: var(--ink-2);
}

.chain-badge {
  font-size: var(--fs-nano);
  letter-spacing: 0.08em;
  color: var(--ink-2);
  border: 1px solid var(--line-1);
  border-radius: 2px;
  padding: 1px 6px;
}

.chain-terms {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 3px 8px;
  font-size: var(--fs-md);
}

.op {
  font-family: var(--mono);
  font-size: var(--fs-small);
  color: var(--amber);
}

.term {
  font-family: var(--mono);
  font-size: var(--fs-small);
  letter-spacing: 0.02em;
  color: var(--ink-1);
  border-bottom: 1px dotted var(--line-2);
  transition: color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease);
}

.term.pivot {
  color: var(--amber-hi);
  border-bottom-color: var(--amber);
}

.chain-note {
  margin-top: 8px;
  max-width: 62ch;
  font-size: var(--fs-small);
  line-height: 1.75;
  color: var(--ink-2);
}

.matrix-wrap {
  position: relative;
  overflow-x: auto;
  border-top: var(--rule);
  border-bottom: var(--rule);
}

.matrix {
  width: 100%;
  min-width: 460px;
  border-collapse: collapse;
  font-size: var(--fs-caption);
}

.matrix th,
.matrix td {
  padding: 9px 8px;
  border-bottom: 1px solid var(--line-0);
  text-align: center;
}

.matrix thead th {
  font-family: var(--mono);
  font-weight: 400;
  font-size: var(--fs-nano);
  letter-spacing: 0.12em;
  color: var(--ink-2);
  border-bottom: 1px solid var(--line-2);
}

.matrix .c-zone {
  text-align: left;
  width: 42%;
  font-family: var(--serif);
  font-weight: 400;
  font-size: var(--fs-small);
  color: var(--ink-1);
}

.matrix tbody tr:last-child th,
.matrix tbody tr:last-child td {
  border-bottom: 0;
}

.zone-link {
  color: inherit;
  border-bottom: 1px dotted transparent;
  transition: color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease);
}

.zone-link:hover,
.zone-link:focus-visible {
  color: var(--ink-0);
  border-bottom-color: var(--amber);
}

.yes {
  color: var(--amber);
  font-size: var(--fs-micro);
}

.no {
  color: var(--ink-3);
  font-family: var(--mono);
}

.matrix-legend {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 8px;
  padding-top: 12px;
  max-width: 72ch;
  font-size: var(--fs-caption);
  line-height: 1.75;
  color: var(--ink-2);
}

.matrix-legend .sep {
  color: var(--line-2);
}

.lg {
  font-size: var(--fs-micro);
}

@media (min-width: 900px) {
  .chains {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-group) clamp(28px, 4vw, 56px);
  }
}
</style>
