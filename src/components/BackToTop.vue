<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const visible = ref(false)
let onScroll: (() => void) | null = null

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  onScroll = () => {
    visible.value = window.scrollY > 320
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})

onUnmounted(() => {
  if (onScroll) window.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <button
    type="button"
    class="back-top mono"
    :class="{ show: visible }"
    :aria-hidden="visible ? undefined : 'true'"
    :tabindex="visible ? 0 : -1"
    aria-label="回到顶部"
    @click="scrollToTop"
  >
    <span class="arrow" aria-hidden="true">↑</span>
    <span class="word">TOP</span>
  </button>
</template>

<style scoped>
.back-top {
  position: fixed;
  right: 22px;
  bottom: 24px;
  z-index: var(--z-overlay);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  font-size: 11px;
  letter-spacing: 0.18em;
  color: var(--ink-2);
  background: color-mix(in srgb, var(--bg-1) 90%, transparent);
  border: 1px solid var(--line-1);
  border-radius: 2px;
  opacity: 0;
  transform: translateY(8px);
  pointer-events: none;
  transition: opacity var(--t-med) var(--ease),
    transform var(--t-med) var(--ease),
    color var(--t-fast) var(--ease),
    border-color var(--t-fast) var(--ease);
}

.back-top.show {
  opacity: 1;
  transform: none;
  pointer-events: auto;
}

.back-top:hover {
  color: var(--amber-hi);
  border-color: var(--amber);
}

.back-top .arrow {
  font-size: 14px;
  line-height: 1;
}

@media (prefers-reduced-motion: reduce) {
  .back-top {
    transition: none;
  }
}
</style>
