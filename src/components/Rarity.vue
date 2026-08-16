<script setup lang="ts">
import { computed } from 'vue'
import { RANK_TO_TIER } from '@/data/types'

const props = defineProps<{ rank?: number }>()

const tier = computed(() =>
  props.rank != null ? (RANK_TO_TIER[props.rank] ?? null) : null,
)
</script>

<template>
  <span
    v-if="tier"
    class="tier"
    :class="`t-${tier.toLowerCase()}`"
    aria-label="稀有度"
  >{{ tier }}</span>
</template>

<style scoped>
.tier {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 600;
  border-radius: 2px;
  line-height: 1;
}

.t-s {
  color: #f5d67b;
  border: 1px solid color-mix(in srgb, #f5d67b 45%, transparent);
  background: rgba(245, 214, 123, 0.08);
}

.t-a {
  color: #b98ad4;
  border: 1px solid color-mix(in srgb, #b98ad4 45%, transparent);
  background: rgba(185, 138, 212, 0.08);
}

.t-b {
  color: #7dae7a;
  border: 1px solid color-mix(in srgb, #7dae7a 45%, transparent);
  background: rgba(125, 174, 122, 0.08);
}
</style>