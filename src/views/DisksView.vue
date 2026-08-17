<script setup lang="ts">
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useCatalogList } from '@/composables/useCatalogList'
import { api } from '@/data/api'
import { iconSources } from '@/data/icons'
import { stripRichText } from '@/utils/text'
import type { DiskDriveListItem } from '@/data/types'
import { usePageMeta } from '@/composables/usePageMeta'
import { AsyncState, CatalogTable, SearchField, type CatalogColumn } from '@/components'

usePageMeta()
import HollowImage from '@/components/HollowImage.vue'

const { data, status, error } = useAsyncResource(() => api.disks())

const { query, filtered, count } = useCatalogList<DiskDriveListItem>({
  items: () => data.value ?? [],
  name: (d) => d.zh?.name ?? '',
})

const columns: CatalogColumn[] = [
  { key: 'name', label: '套装' },
  { key: 'desc2', label: '2 件套' },
  { key: 'desc4', label: '4 件套' },
]
</script>

<template>
  <div class="wrap page">
    <header class="page-head">
      <p class="eyebrow mono">Disk Drives</p>
      <h1 class="page-title">驱动盘</h1>
      <p class="page-sub">
        驱动盘套装总览。2 件套效果与 4 件套效果直接陈列于表中。
      </p>
    </header>

    <div class="toolbar">
      <SearchField v-model="query" :count="count" placeholder="检索套装…" />
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
                :srcs="iconSources({ Id: row.Id, icon: row.icon }, 'list', 'disc')"
                :alt="row.zh?.name ?? '—'"
                :fallback="row.zh?.name ?? '—'" fit="contain" />
            </span>
            <span class="name">{{ row.zh?.name ?? '—' }}</span>
          </span>
        </template>
        <template #cell-desc2="{ row }">
          <span class="effect">{{ stripRichText(row.zh?.desc2) }}</span>
        </template>
        <template #cell-desc4="{ row }">
          <span class="effect">{{ stripRichText(row.zh?.desc4) }}</span>
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
  width: 44px;
  height: 16px; /* 横幅头像 180x64 ≈ 2.8:1，contain 完整显示 */
  flex: none;
  display: block;
}

.mini-icon :deep(.frame) {
  border-radius: 2px;
}

.name {
  font-size: 15px;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.effect {
  color: var(--ink-1);
  font-size: 13px;
  line-height: 1.6;
  max-width: 46ch;
  display: inline-block;
}
</style>