<script setup lang="ts">
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useCatalogList } from '@/composables/useCatalogList'
import { useCatalogSort } from '@/composables/useCatalogSort'
import { listFor } from '@/data/resources'
import { iconSources } from '@/data/icons'
import type { WEngineListItem } from '@/data/types'
import { pickName } from '@/utils/names'
import { usePageMeta } from '@/composables/usePageMeta'
import { catalogEntry } from '@/domain/catalog'
import { AsyncState, CatalogTable, CatalogTableSkeleton, CopyLinkButton, FilterDropdown, ListPage, NameCell, SearchField, type CatalogColumn } from '@/components'
import Tags from '@/components/Tags.vue'
import Rarity from '@/components/Rarity.vue'

usePageMeta()

/** 详情路由前缀与名录取数均由 catalog 派生（单一事实源） */
const cat = catalogEntry('/w-engines')
const base = cat.path

const { data, status, error, reload } = useAsyncResource(() => listFor<WEngineListItem>(cat))

const { profFilter, query, filtered, count, hasActiveFilter, reset } = useCatalogList<WEngineListItem>({
  items: () => data.value ?? [],
  withProfs: true,
  syncRoute: true,
})

const columns: CatalogColumn[] = [
  { key: 'name', label: '音擎', sortable: true },
  { key: 'rarity', label: '稀有度', sortable: true },
  { key: 'prof', label: '职业定位' },
]

const { sorted, sortKey, sortDir, toggle, isDefault: sortIsDefault } = useCatalogSort(
  filtered,
  [
    { key: 'id', value: (r) => r.Id },
    { key: 'name', value: (r) => pickName(r) },
    { key: 'rarity', value: (r) => r.rank ?? -1 },
  ],
  { defaultKey: 'id', defaultDir: 'desc', syncRoute: true },
)
</script>

<template>
  <ListPage>
    <header v-reveal class="page-head">
      <p class="eyebrow mono">W-Engines</p>
      <h1 class="page-title">音擎</h1>
      <p class="page-sub">武装终端图鉴。按职业定位筛选或检索名称。</p>
    </header>

    <section v-reveal="90" class="toolbar">
      <FilterDropdown
        :show-attr="false"
        :prof="profFilter"
        @update:prof="profFilter = $event"
      />
      <SearchField v-model="query" :count="count" placeholder="检索音擎…" />
      <!-- 筛选/搜索生效时 URL 带状态：显式给出「复制此视图链接」入口 -->
      <CopyLinkButton v-if="hasActiveFilter || !sortIsDefault" label="复制筛选链接" />
    </section>

    <!-- 空态分工：AsyncState 只管「数据级为空」；「筛掉全部结果」由 CatalogTable 空态行承担 -->
    <AsyncState
      :status="status"
      :error="error"
      :retry="reload"
      :empty="status === 'success' && !data?.length"
    >
      <template #skeleton>
        <CatalogTableSkeleton :cols="3" />
      </template>
      <CatalogTable
        v-reveal="160"
        :columns="columns"
        :items="sorted"
        :sort="sortKey"
        :sort-dir="sortDir"
        caption="音擎名录：名称、职业定位与稀有度"
        :show-clear="hasActiveFilter"
        empty-text="无匹配音擎"
        @clear="reset"
        @update:sort="toggle"
      >
        <template #cell-name="{ row }">
          <NameCell
            :to="`${base}/${row.Id}`"
            :srcs="iconSources({ Id: row.Id, icon: row.icon }, 'weapon', 'thumb')"
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
  gap: var(--space-inline);
  justify-content: space-between;
  margin-bottom: 20px;
}
</style>