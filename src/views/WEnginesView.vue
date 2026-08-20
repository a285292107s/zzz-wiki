<script setup lang="ts">
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useCatalogList } from '@/composables/useCatalogList'
import { useCatalogSort } from '@/composables/useCatalogSort'
import { api } from '@/data/api'
import { iconSources } from '@/data/icons'
import type { WEngineListItem } from '@/data/types'
import { pickName } from '@/utils/names'
import { usePageMeta } from '@/composables/usePageMeta'
import { catalogByPath } from '@/domain/catalog'
import { AsyncState, CatalogTable, CatalogTableSkeleton, FilterDropdown, ListPage, NameCell, SearchField, type CatalogColumn } from '@/components'
import Tags from '@/components/Tags.vue'
import Rarity from '@/components/Rarity.vue'

usePageMeta()

/** 详情路由前缀由 catalog 派生（单一事实源） */
const base = catalogByPath('/w-engines')?.path ?? '/w-engines'

const { data, status, error } = useAsyncResource(() => api.wengines())

const { profFilter, query, filtered, count } = useCatalogList<WEngineListItem>({
  items: () => data.value ?? [],
  withProfs: true,
  syncRoute: true,
})

const columns: CatalogColumn[] = [
  { key: 'name', label: '音擎', sortable: true },
  { key: 'rarity', label: '稀有度', sortable: true },
  { key: 'prof', label: '职业定位' },
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
      <p class="eyebrow mono">W-Engines</p>
      <h1 class="page-title">音擎</h1>
      <p class="page-sub">武装终端图鉴。按职业定位筛选或检索名称。</p>
    </header>

    <section class="toolbar">
      <FilterDropdown
        :show-attr="false"
        :prof="profFilter"
        @update:prof="profFilter = $event"
      />
      <SearchField v-model="query" :count="count" placeholder="检索音擎…" />
    </section>

    <AsyncState
      :status="status"
      :error="error"
      :empty="status === 'success' && filtered.length === 0"
    >
      <template #skeleton>
        <CatalogTableSkeleton :cols="3" />
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
            :srcs="iconSources({ Id: row.Id, icon: row.icon }, 'weapon')"
            :alt="pickName(row)"
            :fallback="pickName(row)"
            :name="pickName(row)"
          />
        </template>
        <template #cell-rarity="{ row }">
          <Rarity :rank="row.rank" />
        </template>
        <template #cell-prof="{ row }">
          <Tags :specialty="row.type" />
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
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 20px;
}
</style>