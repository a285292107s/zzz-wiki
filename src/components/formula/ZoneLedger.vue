<script setup lang="ts">
import { computed } from 'vue'
import { zoneById, type Zone } from '@/data/formulaGuide'
import FormulaMath from './FormulaMath.vue'
import ZoneRuler from './ZoneRuler.vue'

const props = defineProps<{ ids: string[] }>()

const zones = computed(() =>
  props.ids.map((id) => zoneById(id)).filter((z): z is Zone => Boolean(z)),
)

const AXIS: Record<string, { min: number; max: number; note?: string }> = {
  def: { min: 0, max: 1.2, note: '本行单独取 0–1.2 轴：防御区只减不增' },
}

function axisOf(id: string) {
  return AXIS[id] ?? { min: 0, max: 10 }
}

function rangeText(zone: Zone): string {
  return zone.bands?.map((b) => `×${b.min} – ×${b.max}`).join(' ／ ') ?? ''
}
</script>

<template>
  <div class="ledger">
    <p class="ledger-axis mono">
      标尺为各乘区系数刻度（0–10 轴）；竖线为 ×1 不增不减位；色带为有效范围，
      越界不计入结算。
    </p>

    <article v-for="zone in zones" :id="`z-${zone.id}`" :key="zone.id" class="zone">
      <span class="z-no mono" aria-hidden="true">{{ zone.no }}</span>

      <div class="z-main">
        <header class="z-head">
          <h3 class="z-name">{{ zone.name }}</h3>
          <span class="z-en mono">{{ zone.en }}</span>
        </header>

        <p class="z-summary">{{ zone.summary }}</p>

        <div class="z-math">
          <FormulaMath :tokens="zone.formula" />
        </div>

        <ul v-if="zone.variants?.length" class="z-variants">
          <li v-for="v in zone.variants" :key="v.label" class="z-variant">
            <span class="v-label mono">{{ v.label }}</span>
            <FormulaMath :tokens="v.formula" size="sm" />
          </li>
        </ul>

        <dl v-if="zone.facts?.length" class="z-facts">
          <div v-for="f in zone.facts" :key="f.k" class="z-fact">
            <dt>{{ f.k }}</dt>
            <dd>{{ f.v }}</dd>
          </div>
        </dl>

        <ul v-if="zone.traps?.length" class="z-traps">
          <li v-for="(t, i) in zone.traps" :key="i">{{ t }}</li>
        </ul>
      </div>

      <div v-if="zone.bands?.length" class="z-side">
        <ZoneRuler
          :bands="zone.bands"
          :axis-min="axisOf(zone.id).min"
          :axis-max="axisOf(zone.id).max"
        />
        <p class="z-range mono">{{ rangeText(zone) }}</p>
        <ul v-if="zone.bands.length > 1" class="z-band-legend">
          <li v-for="(b, i) in zone.bands" :key="b.label" :class="{ alt: i > 0 }">
            <i aria-hidden="true" />
            <span>{{ b.label }}</span>
          </li>
        </ul>
        <p v-if="axisOf(zone.id).note" class="z-axis-note">{{ axisOf(zone.id).note }}</p>
      </div>
    </article>
  </div>
</template>

<style scoped>
.ledger {
  border-top: var(--rule);
}

.ledger-axis {
  padding: 12px 0 0;
  font-size: var(--fs-nano);
  line-height: 1.9;
  letter-spacing: 0.02em;
  color: var(--ink-2);
}

.zone {
  display: grid;
  grid-template-columns: 62px minmax(0, 1fr);
  gap: 4px 22px;
  padding: 30px 0;
  border-bottom: var(--rule);
}

.z-no {
  font-size: var(--fs-micro);
  letter-spacing: 0.1em;
  color: var(--ink-3);
  padding-top: 6px;
}

.z-main {
  min-width: 0;
}

.z-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 12px;
}

.z-name {
  font-family: var(--serif);
  font-weight: 500;
  font-size: var(--fs-subhead);
  letter-spacing: 0.01em;
  color: var(--ink-0);
}

.z-en {
  font-size: var(--fs-nano);
  letter-spacing: 0.2em;
  color: var(--ink-2);
}

.z-summary {
  margin-top: 8px;
  max-width: 64ch;
  font-size: var(--fs-md);
  line-height: 1.85;
  color: var(--ink-1);
}

.z-math {
  margin-top: 14px;
  padding: 10px 14px;
  border-left: 2px solid var(--amber);
  background: var(--bg-2);
}

.z-variants {
  margin-top: 10px;
  padding-left: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.z-variant {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 14px;
}

.v-label {
  flex: none;
  min-width: 52px;
  font-size: var(--fs-nano);
  letter-spacing: 0.14em;
  color: var(--ink-2);
}

.z-facts {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 66ch;
}

.z-fact {
  display: grid;
  grid-template-columns: 118px minmax(0, 1fr);
  gap: 4px 14px;
  align-items: baseline;
}

.z-fact dt {
  font-size: var(--fs-caption);
  letter-spacing: 0.08em;
  color: var(--ink-2);
}

.z-fact dd {
  font-size: var(--fs-small);
  line-height: 1.8;
  color: var(--ink-1);
}

.z-traps {
  margin-top: 14px;
  max-width: 66ch;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.z-traps li {
  position: relative;
  padding-left: 20px;
  font-size: var(--fs-small);
  line-height: 1.8;
  color: var(--ink-1);
}

.z-traps li::before {
  content: '!';
  position: absolute;
  left: 0;
  top: 0;
  font-family: var(--mono);
  font-size: var(--fs-caption);
  color: var(--amber);
}

.z-side {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-left: 8px;
  margin-top: 12px;
}

.z-range {
  font-size: var(--fs-micro);
  letter-spacing: 0.06em;
  color: var(--ink-1);
}

.z-band-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  font-size: var(--fs-nano);
  color: var(--ink-2);
}

.z-band-legend li {
  display: flex;
  align-items: center;
  gap: 6px;
}

.z-band-legend i {
  width: 14px;
  height: 5px;
  background: color-mix(in srgb, var(--amber) 22%, transparent);
  border-left: 1px solid var(--amber);
  border-right: 1px solid var(--amber);
}

.z-band-legend li.alt i {
  height: 2px;
  background: color-mix(in srgb, var(--ink-1) 26%, transparent);
  border-color: var(--ink-1);
}

.z-axis-note {
  font-size: var(--fs-nano);
  line-height: 1.7;
  color: var(--ink-2);
}

@media (min-width: 1040px) {
  .zone {
    grid-template-columns: 62px minmax(0, 1fr) 180px;
  }

  .z-side {
    grid-column: auto;
    padding-left: 0;
    margin-top: 4px;
    padding-top: 6px;
    border-left: 1px solid var(--line-0);
    padding-left: 18px;
  }
}

@media (max-width: 600px) {
  .zone {
    grid-template-columns: 1fr;
    gap: 6px;
    padding: 26px 0;
  }

  .z-no {
    padding-top: 0;
  }

  .z-fact {
    grid-template-columns: 1fr;
    gap: 2px;
  }

  .z-math {
    padding: 10px 12px;
  }
}
</style>
