<script setup lang="ts">
import type { StatItem } from '@/domain/sections'

withDefaults(
  defineProps<{
    items: StatItem[]
    /** grid=细线网格（默认）；ledger=点线规格表（打印档案质感） */
    variant?: 'grid' | 'ledger'
  }>(),
  { variant: 'grid' },
)
</script>

<template>
  <div v-if="items.length" :class="['stat-grid', `v-${variant}`]">
    <template v-if="variant === 'ledger'">
      <div v-for="it in items" :key="it.label" class="ledger-row">
        <span class="k">{{ it.label }}</span>
        <span class="leader" aria-hidden="true" />
        <span class="v mono">{{ it.value }}</span>
      </div>
    </template>
    <template v-else>
      <div v-for="it in items" :key="it.label" class="stat">
        <span class="k">{{ it.label }}</span>
        <span class="v mono">{{ it.value }}</span>
        <span v-if="it.tag" class="tag-lbl">{{ it.tag }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* ---------- grid：细线网格 ---------- */

.stat-grid.v-grid {
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

.tag-lbl {
  font-size: 11px;
  letter-spacing: 0.14em;
  color: var(--ink-3);
}

/* ---------- ledger：点线规格表 ---------- */

.stat-grid.v-ledger {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr));
  column-gap: clamp(32px, 4vw, 64px);
  border: var(--rule);
  padding: 6px clamp(16px, 2vw, 28px);
}

.ledger-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding-block: 11px;
}

.leader {
  flex: 1;
  min-width: 24px;
  border-bottom: 1px dotted color-mix(in srgb, var(--ink-2) 72%, transparent);
  transform: translateY(-4px);
}

/* ---------- shared ---------- */

.k {
  font-size: 12px;
  color: var(--ink-2);
  letter-spacing: 0.1em;
}

.v {
  font-size: 18px;
  color: var(--ink-0);
}

.v-ledger .k {
  flex: none;
}

.v-ledger .v {
  flex: none;
  font-size: 15px;
}
</style>
