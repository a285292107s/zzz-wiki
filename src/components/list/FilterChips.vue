<script setup lang="ts">
import { ELEMENTS, PROFESSIONS, type AttrCode, type SpecCode } from '@/domain/enums'

const props = withDefaults(
  defineProps<{
    attr?: 'all' | AttrCode
    prof?: 'all' | SpecCode
    /** 是否渲染属性筛选组（默认 true；音擎等无属性概念时设 false） */
    showAttr?: boolean
    /** 是否渲染职业筛选组（默认 true） */
    showProf?: boolean
  }>(),
  { showAttr: true, showProf: true },
)

const emit = defineEmits<{
  (e: 'update:attr', v: 'all' | AttrCode): void
  (e: 'update:prof', v: 'all' | SpecCode): void
}>()

const attrs = Object.entries(ELEMENTS) as Array<[string, { zh: string; color: string }]>
const profs = Object.entries(PROFESSIONS) as Array<[string, { zh: string }]>
</script>

<template>
  <div class="filters">
    <template v-if="props.showAttr">
      <button class="chip" :class="{ on: attr === 'all' }" @click="emit('update:attr', 'all')">
        全部属性
      </button>
      <button
        v-for="[key, a] in attrs"
        :key="key"
        class="chip attr"
        :class="{ on: attr === Number(key) }"
        :style="{ '--chip-color': a.color }"
        @click="emit('update:attr', attr === Number(key) ? 'all' : (Number(key) as AttrCode))"
      >
        <span class="swatch" />
        {{ a.zh }}
      </button>
    </template>

    <span v-if="props.showAttr && props.showProf" class="sep" />

    <template v-if="props.showProf">
      <button class="chip" :class="{ on: prof === 'all' }" @click="emit('update:prof', 'all')">
        全部职业
      </button>
      <button
        v-for="[key, p] in profs"
        :key="key"
        class="chip"
        :class="{ on: prof === Number(key) }"
        @click="emit('update:prof', prof === Number(key) ? 'all' : (Number(key) as SpecCode))"
      >
        {{ p.zh }}
      </button>
    </template>
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.chip {
  font-size: 12.5px;
  letter-spacing: 0.08em;
  padding: 5px 12px;
  border: 1px solid var(--line-1);
  border-radius: 2px;
  color: var(--ink-1);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all var(--t-fast) var(--ease);
}
.chip:hover {
  border-color: var(--line-2);
  color: var(--ink-0);
}
.chip.on {
  border-color: var(--amber);
  color: var(--ink-0);
  background: var(--amber-dim);
}
.chip.attr.on {
  border-color: var(--chip-color);
  color: var(--chip-color);
}
.swatch {
  width: 7px;
  height: 7px;
  background: var(--chip-color, var(--ink-2));
  flex: none;
}
.sep {
  width: 1px;
  height: 18px;
  background: var(--line-1);
  margin-inline: 6px;
}
</style>
