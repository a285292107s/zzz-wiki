<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { richDesc } from '@/utils/rich'
import { skillIconSources } from '@/data/icons'
import { AWAKEN_PANEL_TEXTURE, awakenLevelPlate } from '@/data/awakenImageSources'
import { useUiText } from '@/composables/useUiText'
import { SKILL_KEYS, type PotentialCinema, type PotentialGate, type SkillSlotKey } from '@/domain/sections'
import HollowImage from '@/components/HollowImage.vue'

const props = defineProps<{
  cinema: PotentialCinema[]
  gates: Record<string, PotentialGate[]>
  art?: string
  name?: string
  crop?: string
}>()

const { t } = useUiText()

const active = ref(0)

watch(
  () => props.cinema,
  () => {
    active.value = 0
  },
)

const panelId = (p: PotentialCinema) => `potential-tier-${p.no}`
const pad = (n: number) => String(n).padStart(2, '0')

const ROWS_BY_TIER = computed(() => {
  const out: Record<string, { slot: SkillSlotKey; items: PotentialGate[] }[]> = {}
  for (const p of props.cinema) {
    const bySlot = new Map<SkillSlotKey, PotentialGate[]>()
    for (const g of props.gates[p.no] ?? []) {
      if (g.derived) continue
      const list = bySlot.get(g.slot) ?? []
      list.push(g)
      bySlot.set(g.slot, list)
    }
    out[p.no] = [...bySlot.entries()].map(([slot, items]) => ({ slot, items }))
  }
  return out
})

const rowsOf = (p: PotentialCinema) => ROWS_BY_TIER.value[p.no] ?? []

const kindLabel = computed<Record<PotentialGate['kind'], string>>(() => ({
  new: t.value.detail.additive,
  enhance: t.value.detail.enhance,
  extend: t.value.detail.extend,
}))

const glyphOf = (slot: SkillSlotKey) => SKILL_KEYS[slot]?.glyph ?? '—'
</script>

<template>
  <div class="awaken" :class="{ solo: !art }" :style="{ '--panel-texture': `url(${AWAKEN_PANEL_TEXTURE})` }">
    <figure v-if="art" class="plate">
      <HollowImage v-if="name" class="plate-name" unframed :srcs="[name]" alt="" loading="lazy" />
      <HollowImage
        class="plate-art"
        unframed
        :srcs="[art]"
        alt=""
        loading="lazy"
        :imgStyle="{ 'object-position': crop ?? '50% 50%' }"
      />
    </figure>
    <div class="strips" role="group" :aria-label="t.detail.potentialFootage">
      <div v-for="(p, i) in cinema" :key="p.no" class="strip" :class="{ on: i === active }">
        <button
          type="button"
          class="strip-head"
          :aria-expanded="i === active"
          :aria-controls="panelId(p)"
          :aria-label="`${pad(p.level)} ${p.label || p.base}`"
          @click="active = i"
        >
          <img class="strip-no" :src="awakenLevelPlate(p.level)" alt="" loading="lazy" decoding="async" />
          <span class="strip-name serif">{{ p.label || p.base }}</span>
          <span class="strip-kicker mono">Talent Info</span>
        </button>
        <div v-show="i === active" :id="panelId(p)" class="strip-body">
          <p class="strip-effect" v-if="p.name">{{ p.name }}</p>
          <ul v-if="rowsOf(p).length" class="gates">
            <li v-for="row in rowsOf(p)" :key="row.slot" class="gate">
              <span class="gate-icon">
                <HollowImage :srcs="skillIconSources(row.slot)" :fallback="glyphOf(row.slot)" alt="" />
              </span>
              <span class="gate-body">
                <template v-for="(g, gi) in row.items" :key="gi">
                  <span class="gate-kind mono">{{ kindLabel[g.kind] }}</span>
                  <span class="gate-name">{{ g.name }}</span>
                  <span v-if="gi < row.items.length - 1" class="gate-sep" aria-hidden="true">{{ t.common.listSep }}</span>
                </template>
              </span>
            </li>
          </ul>
          <p v-else-if="p.desc" class="strip-desc" v-html="richDesc(p.desc)"></p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.awaken {
  display: grid;
  gap: var(--space-group);
}

.plate {
  position: relative;
  margin: 0;
  overflow: hidden;
  aspect-ratio: 4 / 5;
  border: 1px solid var(--line-2);
  background: var(--bg-2);
}

.plate-name {
  position: absolute;
  z-index: 2;
  left: 14px;
  bottom: 12px;
  height: 6.6%;
  width: auto;
  max-width: none;
  opacity: 0.66;
  pointer-events: none;
}

.plate-art {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.strips {
  display: flex;
  gap: 1px;
  padding: 1px;
  background: var(--line-1);
  border: 1px solid var(--line-1);
}

.strip {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-1);
  transition: flex-grow var(--t-med) var(--ease);
}

.strip.on {
  flex-grow: 6;
  background-color: var(--bg-2);
  background-image: var(--panel-texture);
  background-size: cover;
  background-position: center;
}

.strip-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  gap: 10px;
  width: 100%;
  padding: 16px 8px 18px;
  border-top: 1px solid transparent;
  color: var(--ink-2);
  cursor: pointer;
}

.strip.on .strip-head {
  flex: none;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding-inline: 16px;
  border-top-color: var(--amber);
  color: var(--ink-0);
}

.strip-no {
  height: clamp(18px, 1.45vw, 26px);
  width: auto;
  display: block;
  opacity: 0.8;
}

.strip.on .strip-no {
  opacity: 1;
}

.strip-name {
  display: none;
  font-size: var(--fs-subhead);
  letter-spacing: 0.02em;
  line-height: 1.3;
  color: var(--ink-0);
}

.strip.on .strip-name {
  display: block;
}

.strip-kicker {
  margin-top: auto;
  writing-mode: vertical-rl;
  font-size: var(--fs-nano);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--amber);
  margin-bottom: 8px;
}

.strip.on .strip-kicker {
  display: none;
}

.strip-body {
  padding: 0 16px 20px;
}

.strip-effect {
  font-size: var(--fs-caption);
  line-height: 1.6;
  color: var(--ink-1);
  margin-bottom: 10px;
}

.gates {
  list-style: none;
}

.gate {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  column-gap: 10px;
  align-items: start;
  padding: 9px 0;
  border-bottom: var(--rule);
}

.gate:last-child {
  border-bottom: none;
}

.gate-icon {
  display: flex;
  width: 22px;
  height: 22px;
  flex: none;
}

.gate-icon :deep(.frame) {
  width: 22px;
  height: 22px;
  border-radius: 2px;
}

.gate-body {
  min-width: 0;
}

.gate-kind {
  font-size: var(--fs-nano);
  letter-spacing: 0.14em;
  color: var(--amber);
  margin-right: 0.4em;
}

.gate-name {
  font-size: var(--fs-small);
  line-height: 1.7;
  color: var(--ink-1);
}

.gate-sep {
  color: var(--ink-2);
  white-space: pre;
}

.strip-desc {
  font-size: var(--fs-small);
  line-height: 1.8;
  color: var(--ink-1);
  text-wrap: balance;
}

@media (min-width: 1024px) {
  .awaken {
    grid-template-columns: auto minmax(0, 1fr);
    align-items: start;
  }

  .awaken.solo {
    grid-template-columns: minmax(0, 1fr);
  }

  .plate {
    height: clamp(430px, 30vw, 600px);
    width: auto;
  }

  .strips {
    align-self: stretch;
    min-height: clamp(430px, 30vw, 600px);
  }
}

@media (max-width: 1023px) {
  .plate {
    width: 100%;
    max-width: min(100%, 380px);
    margin-inline: auto;
  }

  .strips {
    display: block;
    padding: 0;
    background: none;
    border: 0;
  }

  .strip {
    border-bottom: var(--rule);
  }

  .strip-head {
    flex: none;
    flex-direction: row;
    align-items: center;
    gap: 12px;
    padding: 12px 2px;
  }

  .strip-name {
    display: block;
  }

  .strip-kicker {
    display: none;
  }

  .strip-body {
    padding: 0 2px 18px;
  }
}
</style>
