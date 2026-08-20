<script setup lang="ts">
import { computed } from 'vue'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useCatalogList } from '@/composables/useCatalogList'
import { useCatalogSort } from '@/composables/useCatalogSort'
import { api } from '@/data/api'
import { iconSources } from '@/data/icons'
import type { CharacterListItem } from '@/data/types'
import { pickName } from '@/utils/names'
import { usePageMeta } from '@/composables/usePageMeta'
import { catalogByPath } from '@/domain/catalog'
import { AsyncState, CatalogTable, CatalogTableSkeleton, FilterDropdown, ListPage, NameCell, SearchField, type CatalogColumn } from '@/components'
import Tags from '@/components/Tags.vue'
import Rarity from '@/components/Rarity.vue'

usePageMeta()

/** 详情路由前缀由 catalog 派生（单一事实源，禁止手写第二份类目路径） */
const base = catalogByPath('/agents')?.path ?? '/agents'

const { data, status, error } = useAsyncResource(() => api.characters())

const { attrFilter, profFilter, campFilter, query, filtered, count } =
  useCatalogList<CharacterListItem>({
    items: () => data.value ?? [],
    withAttrs: true,
    withProfs: true,
    withCamps: true,
    syncRoute: true,
    keywords: (row) => [row.camp_name ?? ''],
  })

/** 阵营候选项：由数据动态提取（数字码 + 展示名），按码排序 */
const camps = computed(() => {
  const map = new Map<number, string>()
  for (const row of data.value ?? []) {
    if (row.camp !== undefined && row.camp_name) map.set(row.camp, row.camp_name)
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([code, name]) => ({ code, name }))
})

const columns: CatalogColumn[] = [
  { key: 'name', label: '代号', sortable: true },
  { key: 'attr', label: '属性' },
  { key: 'prof', label: '职业' },
  { key: 'camp', label: '阵营', cls: 'camp mono' },
  { key: 'rarity', label: '稀有度', align: 'right', sortable: true },
]

const { sorted, sortKey, sortDir, toggle } = useCatalogSort(
  filtered,
  [
    { key: 'id', value: (r) => r.Id },
    { key: 'name', value: (r) => pickName(r) },
    { key: 'rarity', value: (r) => r.rank ?? -1 },
  ],
  { defaultKey: 'id', defaultDir: 'desc' },
)
</script>

<template>
  <ListPage>
    <header class="page-head">
      <p class="eyebrow mono">Agents</p>
      <h1 class="page-title">代理人</h1>
      <p class="page-sub">
        新艾利都登记在册的代理人名录。可按属性、职业、阵营筛选，或输入姓名检索。
      </p>
    </header>

    <div class="toolbar">
      <FilterDropdown
        :attr="attrFilter"
        :prof="profFilter"
        :camp="campFilter"
        :camps="camps"
        @update:attr="attrFilter = $event"
        @update:prof="profFilter = $event"
        @update:camp="campFilter = $event"
      />
      <SearchField v-model="query" :count="count" placeholder="检索姓名…" />
    </div>

    <AsyncState
      :status="status"
      :error="error"
      :empty="status === 'success' && filtered.length === 0"
    >
      <template #skeleton>
        <CatalogTableSkeleton :cols="5" with-index />
      </template>
      <CatalogTable
        :columns="columns"
        :items="sorted"
        :sort="sortKey"
        :sort-dir="sortDir"
        @update:sort="toggle"
      >
        <template #cell-name="{ row }">
          <NameCell
            :to="`${base}/${row.Id}`"
            :srcs="iconSources({ Id: row.Id, icon: row.icon }, 'character')"
            :alt="pickName(row)"
            :fallback="pickName(row)"
            :name="pickName(row)"
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
    </AsyncState>
  </ListPage>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
}

.toolbar :deep(.search) {
  width: auto;
  min-width: 280px;
}

/* 由 CatalogTable 列 cls 应用（子组件作用域，用 :deep 穿透） */
:deep(.camp) {
  color: var(--ink-2);
  font-size: 12px;
  letter-spacing: 0.12em;
}
</style>