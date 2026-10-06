<script setup lang="ts">
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useCatalogList } from '@/composables/useCatalogList'
import { useCatalogSort } from '@/composables/useCatalogSort'
import { listFor } from '@/data/resources'
import { iconSources } from '@/data/icons'
import type { BangbooListItem } from '@/data/types'
import { pickName } from '@/utils/names'
import { usePageMeta } from '@/composables/usePageMeta'
import { catalogEntry, HIDDEN_ITEM_IDS } from '@/domain/catalog'
import { AsyncState, CatalogTable, CatalogTableSkeleton, ListPage, NameCell, SearchField, type CatalogColumn, CopyLinkButton } from '@/components'
import Rarity from '@/components/Rarity.vue'

usePageMeta()

/**
 * 不入收藏簿的邦布 ID 清单已提升至 domain/catalog（HIDDEN_ITEM_IDS）：
 * 名录页与详情页翻页共用同一份策展过滤，翻页序列不会出现名录中不存在的条目。
 */
const HIDDEN_BANGBOO_IDS = HIDDEN_ITEM_IDS.get('/bangboos')!

/** 详情路由前缀与名录取数均由 catalog 派生（单一事实源） */
const cat = catalogEntry('/bangboos')
const base = cat.path

const { data, status, error, reload } = useAsyncResource(() => listFor<BangbooListItem>(cat))

const { query, filtered, count, hasActiveFilter, reset } = useCatalogList<BangbooListItem>({
  items: () => (data.value ?? []).filter((r) => !HIDDEN_BANGBOO_IDS.has(r.Id)),
  syncRoute: true,
  keywords: (row) => [row.codename ?? ''],
})

const columns: CatalogColumn[] = [
  { key: 'name', label: '型号', sortable: true },
  { key: 'code', label: '代号' },
  { key: 'rarity', label: '稀有度', sortable: true },
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
      <p class="eyebrow mono">Bangboo</p>
      <h1 class="page-title">邦布</h1>
      <p class="page-sub">空洞里的好搭档。检索型号或按稀有度浏览。</p>
    </header>

    <div v-reveal="90" class="toolbar">
      <SearchField v-model="query" :count="count" placeholder="检索邦布…" />
      <!-- 筛选/搜索生效时 URL 带状态：显式给出「复制此视图链接」入口 -->
      <CopyLinkButton v-if="hasActiveFilter || !sortIsDefault" label="复制筛选链接" />
    </div>

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
        caption="邦布名录：型号、代号与稀有度"
        :show-clear="hasActiveFilter"
        empty-text="无匹配邦布"
        @clear="reset"
        @update:sort="toggle"
      >
        <template #cell-name="{ row }">
          <NameCell
            :to="`${base}/${row.Id}`"
            :srcs="iconSources({ Id: row.Id, icon: row.icon }, 'bangboo', 'thumb')"
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