<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ value?: number | number[] }>()

const stars = computed(() => {
  const v = props.value
  if (typeof v === 'number') return v
  if (Array.isArray(v)) return Math.max(...v)
  return 0
})
</script>

<template>
  <span v-if="stars > 0" class="stars" :class="`s${stars}`" aria-label="稀有度">
    <template v-for="_ in stars" :key="_">
      <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true">
        <path
          d="M6 0.8 L7.5 4.2 L11.2 4.7 L8.6 7.1 L9.4 10.8 L6 9 L2.6 10.8 L3.4 7.1 L0.8 4.7 L4.5 4.2 Z"
          fill="currentColor"
        />
      </svg>
    </template>
  </span>
</template>

<style scoped>
.stars {
  display: inline-flex;
  gap: 2px;
  color: var(--ink-2);
}

.stars.s2 {
  color: #7dae7a;
}

.stars.s3 {
  color: #6fa7d8;
}

.stars.s4 {
  color: #b98ad4;
}

.stars.s5 {
  color: var(--amber-hi);
}
</style>