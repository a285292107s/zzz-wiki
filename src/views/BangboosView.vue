<script setup lang="ts">
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useCatalogList } from '@/composables/useCatalogList'
import { useCatalogSort } from '@/composables/useCatalogSort'
import { listFor } from '@/data/resources'
import { iconSources } from '@/data/icons'
import type { BangbooListItem } from '@/data/types'
import { pickName } from '@/utils/names'
import { usePageMeta } from '@/composables/usePageMeta'
import { catalogEntry } from '@/domain/catalog'
import { AsyncState, CatalogTable, CatalogTableSkeleton, ListPage, NameCell, SearchField, type CatalogColumn } from '@/components'
import Rarity from '@/components/Rarity.vue'

usePageMeta()

/**
 * 不入收藏簿的邦布 ID：伊埃斯（55098）是绳匠专属的 H.D.D. 搭档，
 * 不是可获取的收藏型号（源站名录即空 icon / 占位 desc 的桩数据），
 * 故从邦布名录浏览列表隐藏；详情页仍可经直接链接到达。
 */
const HIDDEN_BANGBOO_IDS = new Set<number>([55098])

/** 详情路由前缀与名录取数均由 catalog 派生（单一事实源） */
const cat = catalogEntry('/bangboos')
const base = cat.path

const { data, status, error } = useAsyncResource(() => listFor<BangbooListItem>(cat))

const { query, filtered, count } = useCatalogList<BangbooListItem>({
  items: () => (data.value ?? []).filter((r) => !HIDDEN_BANGBOO_IDS.has(r.Id)),
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