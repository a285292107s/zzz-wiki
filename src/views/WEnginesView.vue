<script setup lang="ts">
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useCatalogList } from '@/composables/useCatalogList'
import { useCatalogSort } from '@/composables/useCatalogSort'
import { api } from '@/data/api'
import { iconSources } from '@/data/icons'
import type { WEngineListItem } from '@/data/types'
import { pickName } from '@/utils/names'
import { usePageMeta } from '@/composables/usePageMeta'
import { AsyncState, CatalogTable, CatalogTableSkeleton, FilterDropdown, ListPage, SearchField, type CatalogColumn } from '@/components'

usePageMeta()
import Tags from '@/components/Tags.vue'
import Rarity from '@/components/Rarity.vue'
import HollowImage from '@/components/HollowImage.vue'

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
          <RouterLink :to="`/w-engines/${row.Id}`" class="name-cell">
            <span class="mini-icon">
              <HollowImage
                :srcs="iconSources({ Id: row.Id, icon: row.icon }, 'weapon')"
                :alt="pickName(row)"
                :fallback="pickName(row)" fit="contain" />
            </span>
            <span class="name">{{ pickName(row) }}</span>
          </RouterLink>
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
  gap: 18px;
  justify-content: space-between;
  margin-bottom: 20px;
}

.name-cell {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  color: inherit;
  text-decoration: none;
}

a.name-cell:hover .name {
  color: var(--amber-hi);
}

a.name-cell .name {
  transition: color var(--t-fast) var(--ease);
}

.mini-icon {
  width: 40px;
  height: 40px; /* 音擎图标 143×143 方形，contain 完整显示 */
  flex: none;
  display: block;
}

.mini-icon :deep(.frame) {
  border-radius: 2px;
}

.name {
  letter-spacing: 0.02em;
}
</style>