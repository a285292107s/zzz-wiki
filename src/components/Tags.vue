<script setup lang="ts">
import { computed } from 'vue'
import { ELEMENTS, PROFESSIONS, type AttrCode, type SpecCode } from '@/data/types'
import { pickText } from '@/domain/lang'
import { useLocale } from '@/composables/useLocale'

const props = defineProps<{
  element?: AttrCode | number | null
  /** 属性展示名覆盖：有特殊属性（如 烈霜）时传入，优先于基础 element 名 */
  elementLabel?: string | null
  specialty?: SpecCode | number | null
}>()

const { lang } = useLocale()

const el = computed(() => {
  if (props.element == null) return null
  const base = ELEMENTS[props.element as AttrCode]
  if (!base) return null
  // 特殊属性名来自数据（已随语言），无则取基础属性当前语言名
  return { color: base.color, text: props.elementLabel ?? pickText(base.label, lang.value) }
})

const spec = computed(() =>
  props.specialty != null ? (PROFESSIONS[props.specialty as SpecCode] ?? null) : null,
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
      {{ el.text }}
    </span>
    <span v-if="spec" class="tag prof">{{ pickText(spec.label, lang) }}</span>
  </span>
</template>

<style scoped>
.tags {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

/* 基础标签样式见 base.css .tag（全站共用）；此处只留属性/职业变体 */

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