<script setup lang="ts">
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useCatalogList } from '@/composables/useCatalogList'
import { api } from '@/data/api'
import { iconSources } from '@/data/icons'
import type { BangbooListItem } from '@/data/types'
import { pickName } from '@/utils/names'
import { usePageMeta } from '@/composables/usePageMeta'
import { AsyncState, CatalogTable, SearchField, type CatalogColumn } from '@/components'

usePageMeta()
import Rarity from '@/components/Rarity.vue'
import HollowImage from '@/components/HollowImage.vue'

const { data, status, error } = useAsyncResource(() => api.bangboos())

const { query, filtered, count } = useCatalogList<BangbooListItem>({
  items: () => data.value ?? [],
})

const columns: CatalogColumn[] = [
  { key: 'name', label: '型号' },
  { key: 'code', label: '代号' },
  { key: 'rarity', label: '稀有度' },
]
</script>

<template>
  <div class="wrap page">
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
      <CatalogTable :columns="columns" :items="filtered">
        <template #cell-name="{ row }">
          <span class="name-cell">
            <span class="mini-icon">
              <HollowImage
                :srcs="iconSources({ Id: row.Id, icon: row.icon }, 'list', 'bangboo')"
                :alt="pickName(row)"
                :fallback="pickName(row)"
              />
            </span>
            <span class="name">{{ pickName(row) }}</span>
          </span>
        </template>
        <template #cell-code="{ row }">
          <span class="code mono">{{ row.codename ?? '—' }}</span>
        </template>
        <template #cell-rarity="{ row }">
          <Rarity :rank="row.rank" />
        </template>
      </CatalogTable>
    </AsyncState>
  </div>
</template>

<style scoped>
.page {
  padding-top: calc(var(--pad-section) * 0.9);
}

.page-head {
  margin-bottom: var(--pad-section);
}

.toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 20px;
}

.name-cell {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.mini-icon {
  width: 34px;
  height: 34px;
  flex: none;
  display: block;
}

.mini-icon :deep(.frame) {
  border-radius: 2px;
}

.name {
  letter-spacing: 0.02em;
}

.code {
  color: var(--ink-2);
  font-size: 12px;
  letter-spacing: 0.08em;
}
</style>