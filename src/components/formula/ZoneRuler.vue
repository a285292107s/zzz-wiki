<script setup lang="ts">
import { computed } from 'vue'
import type { Band } from '@/data/formulaGuide'

const props = withDefaults(
  defineProps<{
    bands: Band[]
    axisMin?: number
    axisMax?: number
    neutral?: number
  }>(),
  { axisMin: 0, axisMax: 10, neutral: 1 },
)

function pct(value: number): number {
  const span = props.axisMax - props.axisMin
  if (span <= 0) return 0
  return Math.min(100, Math.max(0, ((value - props.axisMin) / span) * 100))
}

const segments = computed(() =>
  props.bands.map((band, i) => ({
    key: band.label,
    alt: i > 0,
    style: {
      left: `${pct(band.min)}%`,
      width: `${Math.max(0.6, pct(band.max) - pct(band.min))}%`,
    },
  })),
)

const neutralAt = computed(() =>
  props.neutral >= props.axisMin && props.neutral <= props.axisMax ? pct(props.neutral) : null,
)

const label = computed(() =>
  props.bands
    .map((b) => `${b.label} ×${b.min} 至 ×${b.max}`)
    .join('；') + `（标尺 ${props.axisMin} 至 ${props.axisMax}）`,
)
</script>

<template>
  <div class="ruler" :class="{ 'has-alt': bands.length > 1 }" role="img" :aria-label="label">
    <span class="axis" />
    <span
      v-for="seg in segments"
      :key="seg.key"
      class="band"
      :class="{ alt: seg.alt }"
      :style="seg.style"
    />
    <span v-if="neutralAt !== null" class="datum" :style="{ left: `${neutralAt}%` }" />
  </div>
</template>

<style scoped>
.ruler {
  position: relative;
  height: 14px;
  display: flex;
  align-items: center;
}

.axis {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 1px;
  background: var(--line-1);
}

.band {
  position: absolute;
  top: 50%;
  height: 7px;
  transform: translateY(-50%);
  background: color-mix(in srgb, var(--amber) 22%, transparent);
  border-left: 1px solid var(--amber);
  border-right: 1px solid var(--amber);
}

.band.alt {
  height: 3px;
  background: color-mix(in srgb, var(--ink-1) 26%, transparent);
  border-color: var(--ink-1);
  transform: translateY(-50%) translateY(5px);
}

.has-alt .band:not(.alt) {
  transform: translateY(-50%) translateY(-2px);
}

.datum {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--ink-2);
}

@media (forced-colors: active) {
  .band {
    background: Highlight;
    border-color: Highlight;
  }
  .axis {
    background: GrayText;
  }
  .datum {
    background: CanvasText;
  }
}
</style>
