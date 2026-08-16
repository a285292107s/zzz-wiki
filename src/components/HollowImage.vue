<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  src: string | null | undefined
  alt?: string
  /** short label rendered while the image is missing/broken */
  fallback?: string
}>()

const failed = ref(false)

watch(
  () => props.src,
  () => {
    failed.value = false
  },
)
</script>

<template>
  <span class="frame" :class="{ broken: failed || !src }">
    <img
      v-if="!failed && src"
      :src="src"
      :alt="alt ?? ''"
      loading="lazy"
      decoding="async"
      @error="failed = true"
    />
    <span v-else class="ph" aria-hidden="true">
      {{ (fallback && fallback.length ? fallback.slice(0, 2) : '—').toUpperCase() }}
    </span>
  </span>
</template>

<style scoped>
.frame {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 1;
  background: var(--bg-1);
  border: 1px solid var(--line-0);
  overflow: hidden;
  position: relative;
}

.frame img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.ph {
  font-family: var(--mono);
  font-size: 0.85rem;
  letter-spacing: 0.08em;
  color: var(--ink-3);
  user-select: none;
}

.frame.broken {
  border-style: dashed;
}
</style>