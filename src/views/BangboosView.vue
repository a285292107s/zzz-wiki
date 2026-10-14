<script setup lang="ts">
import { computed } from 'vue'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useCatalogList } from '@/composables/useCatalogList'
import { useCatalogSort } from '@/composables/useCatalogSort'
import { listFor } from '@/data/resources'
import { iconSources } from '@/data/icons'
import type { BangbooListItem } from '@/data/types'
import { pickName } from '@/utils/names'
import { pickText } from '@/domain/lang'
import { useLocale } from '@/composables/useLocale'
import { useUiText } from '@/composables/useUiText'
import { usePageMeta } from '@/composables/usePageMeta'
import { catalogEntry, HIDDEN_ITEM_IDS } from '@/domain/catalog'
import { AsyncState, CatalogTable, CatalogTableSkeleton, ListPage, NameCell, SearchField, type CatalogColumn } from '@/components'
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

/** 当前展示语言（名录按语言落盘，语言一变下面的取数会重新拉） */
const { lang } = useLocale()
const { t } = useUiText()

const { data, status, error, reload } = useAsyncResource(() =>
  listFor<BangbooListItem>(cat, lang.value),
)

const { query, filtered, count, hasActiveFilter, reset } = useCatalogList<BangbooListItem>({
  items: () => (data.value ?? []).filter((r) => !HIDDEN_BANGBOO_IDS.has(r.Id)),
  syncRoute: true,
  keywords: (row) => [row.codename ?? ''],
})

const columns = computed<CatalogColumn[]>(() => [
  { key: 'name', label: t.value.list.model, sortable: true },
  { key: 'code', label: t.value.list.code },
  { key: 'rarity', label: t.value.list.rarity, sortable: true },
])

const { sorted, sortKey, sortDir, toggle } = useCatalogSort(
  filtered,
  [
    { key: 'id', value: (r) => r.Id },
    { key: 'name', value: (r) => pickName(r, lang.value) },
    { key: 'rarity', value: (r) => r.rank ?? -1 },
  ],
  { defaultKey: 'id', defaultDir: 'desc', syncRoute: true },
)
</script>

<template>
  <ListPage>
    <header v-reveal class="page-head">
      <p class="eyebrow mono">Bangboo</p>
      <h1 class="page-title">{{ pickText(cat.label, lang) }}</h1>
      <p class="page-sub">{{ t.list.bangboosIntro }}</p>
    </header>

    <div v-reveal="90" class="toolbar">
      <SearchField v-model="query" :count="count" :placeholder="t.list.searchBangboo" />
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
        :caption="t.list.bangboosSub"
        :show-clear="hasActiveFilter"
        :empty-text="t.noMatch.bangboos"
        @clear="reset"
        @update:sort="toggle"
      >
        <template #cell-name="{ row }">
          <NameCell
            :to="`${base}/${row.Id}`"
            :srcs="iconSources({ Id: row.Id, icon: row.icon }, 'bangboo', 'thumb')"
            :alt="pickName(row, lang)"
            :fallback="pickName(row, lang)"
            :name="pickName(row, lang)"
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