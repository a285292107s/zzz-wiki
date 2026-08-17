<script setup lang="ts">
import type { StatItem } from '@/domain/sections'

defineProps<{
  items: StatItem[]
}>()
</script>

<template>
  <div v-if="items.length" class="stat-grid">
    <div v-for="it in items" :key="it.label" class="stat">
      <span class="k">{{ it.label }}</span>
      <span class="v mono">{{ it.value }}</span>
      <span v-if="it.tag" class="tag-lbl">{{ it.tag }}</span>
    </div>
  </div>
</template>

<style scoped>
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1px;
  background: var(--line-1);
  border: var(--rule);
}
.stat {
  background: var(--bg-2);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.k {
  font-size: 12px;
  color: var(--ink-2);
  letter-spacing: 0.1em;
}
.v {
  font-size: 18px;
  color: var(--ink-0);
}
.tag-lbl {
  font-size: 11px;
  letter-spacing: 0.14em;
  color: var(--ink-3);
}
</style>
