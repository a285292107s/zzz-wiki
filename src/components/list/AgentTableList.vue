<script setup lang="ts">
import { computed } from 'vue'
import { iconSources } from '@/data/icons'
import type { CharacterListItem } from '@/data/types'
import { pickName } from '@/utils/names'
import { useLocale } from '@/composables/useLocale'
import { useUiText } from '@/composables/useUiText'
import CatalogTable, { type CatalogColumn } from './CatalogTable.vue'
import NameCell from './NameCell.vue'
import Tags from '@/components/Tags.vue'
import Rarity from '@/components/Rarity.vue'

defineProps<{
  items: CharacterListItem[]
  base: string
  emptyText?: string
  showClear?: boolean
}>()

const emit = defineEmits<{ (e: 'clear'): void }>()

const { t } = useUiText()
const { lang } = useLocale()

const columns = computed<CatalogColumn[]>(() => [
  { key: 'name', label: t.value.list.code, width: '38%' },
  { key: 'attr', label: t.value.list.element, width: '13%' },
  { key: 'prof', label: t.value.list.profession, width: '11%' },
  { key: 'camp', label: t.value.list.camp, cls: 'camp mono', width: '27%' },
  { key: 'rarity', label: t.value.list.rarity, align: 'right', width: '11%' },
])
</script>

<template>
  <CatalogTable
    :columns="columns"
    :items="items"
    :caption="t.list.agentsSub"
    :show-clear="showClear"
    :empty-text="emptyText"
    @clear="emit('clear')"
  >
    <template #cell-name="{ row }">
      <NameCell
        :to="`${base}/${row.Id}`"
        :srcs="iconSources({ Id: row.Id, icon: row.icon }, 'character')"
        :alt="pickName(row, lang)"
        :fallback="pickName(row, lang)"
        :name="pickName(row, lang)"
        thumb="banner"
      />
    </template>
    <template #cell-attr="{ row }">
      <Tags :element="row.element" :element-label="row.special_element" />
    </template>
    <template #cell-prof="{ row }">
      <Tags :specialty="row.type" />
    </template>
    <template #cell-camp="{ row }">
      <span class="camp">
        {{ row.camp_name ?? `C${String(row.camp ?? '—').padStart(2, '0')}` }}
      </span>
    </template>
    <template #cell-rarity="{ row }">
      <Rarity :rank="row.rank" />
    </template>
  </CatalogTable>
</template>

<style scoped>
:deep(.camp) {
  color: var(--ink-2);
  font-size: var(--fs-caption);
  letter-spacing: 0.12em;
}
</style>
