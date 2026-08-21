<script setup lang="ts">
import type { GuideFormula } from '@/data/formulaGuide'

defineProps<{ formula: GuideFormula }>()
</script>

<template>
  <div class="eq">
    <div class="eq-line">
      <span class="eq-label">{{ formula.label }}</span>
      <span class="eq-chain">
        <template v-for="(t, i) in formula.terms" :key="i">
          <span v-if="i > 0" class="op" aria-hidden="true">×</span>
          <span class="term">{{ t }}</span>
        </template>
      </span>
    </div>
    <p v-if="formula.note" class="eq-note">{{ formula.note }}</p>
  </div>
</template>

<style scoped>
/* 无框公式行：label + 乘区链同一基线、自然换行；外框由页面「书脊」(.eq-list)聚合，
   避免每则公式各自成盒造成的叠卡感 */
.eq {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.eq-line {
  display: inline-flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px 16px;
}

.eq-label {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.18em;
  color: var(--amber);
}

.eq-chain {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 12px;
  font-family: var(--mono);
  font-size: 15px;
  letter-spacing: 0.01em;
  color: var(--ink-0);
  line-height: 1.7;
  font-feature-settings: 'tnum' 1;
}

.eq-chain .op {
  color: var(--amber);
}

.eq-note {
  max-width: 68ch;
  font-size: 13px;
  color: var(--ink-2);
  line-height: 1.7;
}
</style>