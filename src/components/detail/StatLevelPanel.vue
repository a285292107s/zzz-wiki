<script setup lang="ts">
defineProps<{
  lvLabel: string
  meta?: string
}>()
</script>

<template>
  <div class="stat-level">
    <div v-if="$slots.control" class="stat-level-head">
      <span class="stat-level-lv mono" aria-hidden="true">{{ lvLabel }}</span>
      <slot name="control" />
    </div>
    <div v-if="meta" class="stat-level-meta mono">
      <span>{{ meta }}</span>
    </div>
    <slot />
  </div>
</template>

<style scoped>
.stat-level {
  border: var(--rule);
  padding: 14px clamp(16px, 2vw, 28px) 12px;
}

.stat-level-head {
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
}

.stat-level-lv {
  flex: none;
  font-size: var(--fs-title);
  color: var(--amber);
  letter-spacing: 0.04em;
  min-width: 3.2em;
}

.stat-level-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 14px;
  min-height: 36px;
  margin-top: 4px;
  font-size: var(--fs-nano);
  letter-spacing: 0.14em;
  color: var(--ink-2);
}

.stat-level-meta > span {
  color: var(--amber);
}
</style>
