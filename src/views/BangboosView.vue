<script setup lang="ts">
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useCatalogList } from '@/composables/useCatalogList'
import { useCatalogSort } from '@/composables/useCatalogSort'
import { api } from '@/data/api'
import { iconSources } from '@/data/icons'
import type { BangbooListItem } from '@/data/types'
import { pickName } from '@/utils/names'
import { usePageMeta } from '@/composables/usePageMeta'
import { catalogByPath } from '@/domain/catalog'
import { AsyncState, CatalogTable, CatalogTableSkeleton, ListPage, NameCell, SearchField, type CatalogColumn } from '@/components'
import Rarity from '@/components/Rarity.vue'

usePageMeta()

/** 详情路由前缀由 catalog 派生（单一事实源） */
const base = catalogByPath('/bangboos')?.path ?? '/bangboos'

const { data, status, error } = useAsyncResource(() => api.bangboos())

const { query, filtered, count } = useCatalogList<BangbooListItem>({
  items: () => data.value ?? [],
  syncRoute: true,
  keywords: (row) => [row.codename ?? ''],
})

const columns: CatalogColumn[] = [
  { key: 'name', label: '型号', sortable: true },
  { key: 'code', label: '代号' },
  { key: 'rarity', label: '稀有度', sortable: true },
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
      <p class="eyebrow mono">Bangboo</p>
      <h1 class="page-title">邦布</h1>
      <p class="page-sub">空洞里的好搭档。检索型号或按稀有度浏览。</p>
    </header>

    <div class="toolbar">
      <SearchField v-model="query" :count="count" placeholder="检索邦布…" />
    </div>

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
            :srcs="iconSources({ Id: row.Id, icon: row.icon }, 'bangboo')"
            :alt="pickName(row)"
            :fallback="pickName(row)"
            :name="pickName(row)"
          />
        </template>
        <template #cell-code="{ row }">
          <span class="code mono">{{ row.codename ?? '—' }}</span>
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
  /* 唯一控件（搜索框）时右对齐，与其他名录页搜索框位置一致 */
  display: flex;
  justify-content: flex-end;
  margin-bottom: 20px;
}

.code {
  color: var(--ink-2);
  font-size: var(--fs-caption);
  letter-spacing: 0.08em;
}
</style>