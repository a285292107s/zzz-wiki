<script setup lang="ts">
import HollowImage from '@/components/HollowImage.vue'

defineProps<{
  srcs: string[]
  fallback: string
  playing: boolean
  toggle?: boolean
  playLabel: string
  pauseLabel: string
}>()

const emit = defineEmits<{ 'update:playing': [value: boolean] }>()
</script>

<template>
  <div class="figure">
    <HollowImage :srcs="srcs" alt="" :fallback="fallback" ratio="1 / 1" fit="cover" />
    <button
      v-if="toggle"
      class="motion-toggle"
      type="button"
      :aria-label="playing ? pauseLabel : playLabel"
      @click="emit('update:playing', !playing)"
    >
      <svg v-if="playing" viewBox="0 0 10 10" aria-hidden="true">
        <rect x="1.5" y="1" width="2.5" height="8" />
        <rect x="6" y="1" width="2.5" height="8" />
      </svg>
      <svg v-else viewBox="0 0 10 10" aria-hidden="true">
        <path d="M2 1l7 4-7 4z" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.figure {
  position: relative;
}

.figure :deep(.frame) {
  border: 0;
  background: transparent;
}

.motion-toggle {
  position: absolute;
  right: 6px;
  bottom: 6px;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--line-1);
  border-radius: 2px;
  background: var(--bg-0);
  color: var(--ink-2);
  line-height: 0;
  cursor: pointer;
}

.motion-toggle:hover {
  color: var(--amber-hi);
  border-color: var(--line-2);
}

.motion-toggle svg {
  width: 10px;
  height: 10px;
  fill: currentColor;
}
</style>
