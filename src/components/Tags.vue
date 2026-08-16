<script setup lang="ts">
import { computed } from 'vue'
import { ATTRIBUTES, PROFESSIONS, type Attribute, type Profession } from '@/data/types'

const props = defineProps<{
  attribute?: Attribute | string
  profession?: Profession | string
  showZh?: boolean
}>()

const attr = computed(() => {
  if (!props.attribute) return null
  const a = ATTRIBUTES[props.attribute as Attribute]
  return a ?? null
})

const prof = computed(() => {
  if (!props.profession) return null
  return PROFESSIONS[props.profession as Profession] ?? props.profession
})
</script>

<template>
  <span class="tags">
    <span
      v-if="attr"
      class="tag attr"
      :style="{ '--tag-color': attr.color }"
    >
      <span class="swatch" />
      {{ props.showZh === false ? attribute : attr.zh }}
    </span>
    <span v-if="prof" class="tag prof">{{ prof }}</span>
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