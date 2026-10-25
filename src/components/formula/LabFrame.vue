<script setup lang="ts">
defineProps<{ anchor: string; title: string; en: string; lead: string }>()
</script>

<template>
  <section class="lab" :aria-labelledby="`${anchor}-title`">
    <div class="lab-head">
      <h3 :id="`${anchor}-title`" class="lab-title">{{ title }}</h3>
      <span class="lab-en mono">{{ en }}</span>
    </div>
    <p class="lab-lead">{{ lead }}</p>
    <slot />
  </section>
</template>

<style scoped>
.lab {
  border-top: var(--rule);
  padding-top: 24px;
  margin-bottom: var(--space-group);
}

.lab-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 12px;
}

.lab-title {
  font-family: var(--serif);
  font-weight: 500;
  font-size: var(--fs-lead);
  color: var(--ink-0);
}

.lab-en {
  font-size: var(--fs-nano);
  letter-spacing: 0.2em;
  color: var(--ink-2);
}

.lab-lead {
  margin-top: 10px;
  max-width: 66ch;
  font-size: var(--fs-md);
  line-height: 1.85;
  color: var(--ink-1);
}
</style>
