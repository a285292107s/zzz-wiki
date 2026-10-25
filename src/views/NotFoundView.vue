<script setup lang="ts">
import { usePageMeta } from '@/composables/usePageMeta'
import { useUiText } from '@/composables/useUiText'

const { t } = useUiText()
usePageMeta()
</script>

<template>
  <div class="wrap page">
    <section class="err" aria-labelledby="h-404">
      <p class="eyebrow mono">Error 404</p>
      <h1 id="h-404" class="page-title">{{ t.notFound.title }}</h1>
      <p class="page-sub">
        {{ t.notFound.body }}
      </p>
      <p class="hint mono">
        <RouterLink to="/" class="back mono">{{ t.notFound.back }}</RouterLink>
      </p>
    </section>
  </div>
</template>

<style scoped>
.page {
  min-height: 60dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-block: calc(var(--pad-section) * 1.1);
}
@media (min-width: 861px) {
  .page {
    min-height: 72dvh;
  }
}
.err {
  text-align: center;
  max-width: 520px;
}
.eyebrow {
  justify-content: center;
}
.eyebrow::after {
  content: '';
  width: 18px;
  height: 1px;
  background: var(--amber);
}
.hint {
  margin-top: 40px;
  display: flex;
  justify-content: center;
}
.back {
  font-size: var(--fs-caption);
  color: var(--ink-2);
  letter-spacing: 0.12em;
  transition: color var(--t-fast) var(--ease);
}
.back:hover {
  color: var(--amber-hi);
}
</style>
