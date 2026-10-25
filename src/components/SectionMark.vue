<script setup lang="ts">
const scroll =
  'M276.4 12 C271 12 267 10 264 7 C261.5 4.4 257.8 4.4 256.2 6.6 C254.6 8.8 255.8 11.4 258.2 11.8 C259.9 12.1 261.2 10.8 260.6 9.4'
const endScroll =
  'M514 12 C520 12 524 10.2 526.8 7.4 C529.2 4.9 533.4 5.1 535.2 7.6 C537 10.2 535.2 12.6 532.8 12.4 C530.8 12.2 530 10.4 531.2 9.1'
</script>

<template>
  <span class="section-mark" aria-hidden="true">
    <svg viewBox="0 0 560 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M46 12 H244" />
      <path d="M316 12 H514" />
      <path class="mark-accent" d="M-3 0 L0 -3 L3 0 L0 3 Z" transform="translate(248 12)" />
      <path class="mark-accent" d="M-3 0 L0 -3 L3 0 L0 3 Z" transform="translate(312 12)" />
      <path class="mark-accent" d="M280 5.5 L283.6 12 L280 18.5 L276.4 12 Z" />
      <path :d="scroll" />
      <path :d="scroll" transform="translate(560 0) scale(-1 1)" />
      <path :d="endScroll" />
      <path :d="endScroll" transform="translate(560 0) scale(-1 1)" />
    </svg>
  </span>
</template>
