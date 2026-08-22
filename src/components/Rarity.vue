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
  /* 与 meta 标签行其他标签统一高度（24px 方框，2px 圆角） */
  width: 24px;
  height: 24px;
  font-family: var(--mono);
  font-size: var(--fs-caption);
  font-weight: 600;
  border-radius: 2px;
  line-height: 1;
  flex: none;
}

.t-s {
  color: var(--rank-s);
  border: 1px solid color-mix(in srgb, var(--rank-s) 45%, transparent);
  background: color-mix(in srgb, var(--rank-s) 8%, transparent);
}

.t-a {
  color: var(--rank-a);
  border: 1px solid color-mix(in srgb, var(--rank-a) 45%, transparent);
  background: color-mix(in srgb, var(--rank-a) 8%, transparent);
}

.t-b {
  color: var(--rank-b);
  border: 1px solid color-mix(in srgb, var(--rank-b) 45%, transparent);
  background: color-mix(in srgb, var(--rank-b) 8%, transparent);
}
</style>