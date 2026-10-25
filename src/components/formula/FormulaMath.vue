<script setup lang="ts">
import type { Expr } from '@/data/formulaGuide'

withDefaults(defineProps<{ tokens: Expr[]; size?: 'sm' | 'md' | 'lg' }>(), { size: 'md' })
</script>

<template>
  <div class="fx" :class="`is-${size}`">
    <template v-for="(token, i) in tokens" :key="i">
      <span v-if="token.k === 'var'" class="term">
        {{ token.text }}<sub v-if="token.sub">{{ token.sub }}</sub>
      </span>
      <span v-else-if="token.k === 'num'" class="num">{{ token.text }}</span>
      <span v-else-if="token.k === 'op'" class="op">{{ token.text }}</span>
      <span v-else-if="token.k === 'when'" class="when"><small>{{ token.text }}</small></span>
      <span v-else-if="token.k === 'grp'" class="grp">
        <span class="paren">(</span>
        <FormulaMath :tokens="token.items" />
        <span class="paren">)</span>
      </span>
      <span v-else class="frac">
        <span class="frac-num"><FormulaMath :tokens="token.num" /></span>
        <span class="frac-den"><FormulaMath :tokens="token.den" /></span>
      </span>
    </template>
  </div>
</template>

<style scoped>
.fx {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 7px;
  font-size: var(--fx-size, var(--fs-md));
  line-height: 1.9;
  color: var(--ink-0);
}

.is-sm {
  --fx-size: var(--fs-small);
}

.is-lg {
  --fx-size: var(--fs-lead);
}

.term {
  font-family: var(--serif);
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.term sub {
  font-family: var(--mono);
  font-size: 0.62em;
  letter-spacing: 0.04em;
  color: var(--ink-2);
  margin-left: 1px;
}

.num {
  font-family: var(--mono);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.01em;
}

.op {
  font-family: var(--mono);
  color: var(--amber);
  padding-inline: 1px;
}

.when {
  font-family: var(--sans);
  color: var(--ink-1);
  letter-spacing: 0.02em;
}

.grp {
  display: inline-flex;
  align-items: center;
  gap: 2px 7px;
  white-space: nowrap;
}

.paren {
  font-family: var(--mono);
  color: var(--ink-1);
}

.frac {
  display: inline-flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  vertical-align: middle;
  gap: 1px;
  padding-inline: 3px;
}

.frac-num,
.frac-den {
  display: flex;
  justify-content: center;
  gap: 2px 7px;
  white-space: nowrap;
}

.frac-num {
  padding-bottom: 2px;
}

.frac-den {
  padding-top: 2px;
  border-top: 1px solid var(--ink-1);
}
</style>
