<script setup lang="ts">
import { ELEMENTS, PROFESSIONS, type AttrCode, type SpecCode } from '@/domain/enums'
import { elementIconUrl, professionIconUrl } from '@/domain/filterIcons'

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
    <div v-if="props.showAttr" class="group" data-group="attr">
      <span class="group-label mono">属性</span>
      <button
        class="chip"
        :class="{ on: attr === 'all' }"
        :aria-pressed="attr === 'all'"
        @click="emit('update:attr', 'all')"
      >
        全部属性
      </button>
      <button
        v-for="[key, a] in attrs"
        :key="key"
        class="chip attr"
        :class="{ on: attr === Number(key) }"
        :aria-pressed="attr === Number(key)"
        :style="{ '--chip-color': a.color }"
        @click="emit('update:attr', attr === Number(key) ? 'all' : (Number(key) as AttrCode))"
      >
        <img
          v-if="elementIconUrl(Number(key) as AttrCode)"
          class="chip-ic"
          :src="elementIconUrl(Number(key) as AttrCode)!"
          :alt="a.zh"
          loading="lazy"
        />
        <svg
          v-else
          class="chip-ic chip-fallback"
          viewBox="0 0 16 16"
          :style="{ '--ph-color': a.color }"
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="6" fill="none" stroke="var(--ph-color)" stroke-width="2" />
        </svg>
        {{ a.zh }}
      </button>
    </div>

    <div v-if="props.showProf" class="group" data-group="prof">
      <span class="group-label mono">职业</span>
      <button
        class="chip"
        :class="{ on: prof === 'all' }"
        :aria-pressed="prof === 'all'"
        @click="emit('update:prof', 'all')"
      >
        全部职业
      </button>
      <button
        v-for="[key, p] in profs"
        :key="key"
        class="chip"
        :class="{ on: prof === Number(key) }"
        :aria-pressed="prof === Number(key)"
        @click="emit('update:prof', prof === Number(key) ? 'all' : (Number(key) as SpecCode))"
      >
        <img
          v-if="professionIconUrl(Number(key) as SpecCode)"
          class="chip-ic"
          :src="professionIconUrl(Number(key) as SpecCode)!"
          :alt="p.zh"
          loading="lazy"
        />
        <svg v-else class="chip-ic chip-fallback" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="6" fill="none" stroke="var(--ink-2)" stroke-width="2" />
        </svg>
        {{ p.zh }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
}
.group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.group-label {
  flex: none;
  font-size: 11px;
  letter-spacing: 0.18em;
  color: var(--ink-2);
  margin-right: 4px;
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
.chip-ic {
  width: 15px;
  height: 15px;
  object-fit: contain;
  flex: none;
  display: block;
}
.chip-fallback {
  stroke-width: 2;
}
</style>