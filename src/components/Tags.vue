<script setup lang="ts">
import { computed } from 'vue'
import { ELEMENTS, PROFESSIONS, type AttrCode, type SpecCode } from '@/data/types'

const props = defineProps<{
  element?: AttrCode | number | null
  specialty?: SpecCode | number | null
}>()

const el = computed(() =>
  props.element != null ? ELEMENTS[props.element as AttrCode] : null,
)

const spec = computed(() =>
  props.specialty != null ? PROFESSIONS[props.specialty as SpecCode] : null,
)
</script>

<template>
  <span class="tags">
    <span
      v-if="el"
      class="tag attr"
      :style="{ '--tag-color': el.color }"
    >
      <span class="swatch" />
      {{ el.zh }}
    </span>
    <span v-if="spec" class="tag prof">{{ spec.zh }}</span>
  </span>
</template>

<style scoped>
.tags {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  letter-spacing: 0.1em;
  padding: 3px 9px;
  border: 1px solid var(--line-1);
  border-radius: 2px;
  color: var(--ink-1);
  white-space: nowrap;
}

.tag.attr {
  color: var(--tag-color);
  border-color: color-mix(in srgb, var(--tag-color) 34%, var(--line-1));
}

.swatch {
  width: 7px;
  height: 7px;
  background: var(--tag-color);
  flex: none;
}
</style>