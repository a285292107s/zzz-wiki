<script setup lang="ts">
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useCatalogList } from '@/composables/useCatalogList'
import { api } from '@/data/api'
import { iconSources } from '@/data/icons'
import type { CharacterListItem } from '@/data/types'
import { pickName } from '@/utils/names'
import { usePageMeta } from '@/composables/usePageMeta'
import { AsyncState, CatalogTable, FilterChips, SearchField, type CatalogColumn } from '@/components'

usePageMeta()
import Tags from '@/components/Tags.vue'
import Rarity from '@/components/Rarity.vue'
import HollowImage from '@/components/HollowImage.vue'

const { data, status, error } = useAsyncResource(() => api.characters())

const { attrFilter, profFilter, query, filtered, count } =
  useCatalogList<CharacterListItem>({
    items: () => data.value ?? [],
    withAttrs: true,
    withProfs: true,
  })

const columns: CatalogColumn[] = [
  { key: 'name', label: '代号' },
  { key: 'attr', label: '属性' },
  { key: 'prof', label: '职业' },
  { key: 'camp', label: '阵营', cls: 'camp mono' },
  { key: 'rarity', label: '稀有度', align: 'right' },
]
</script>

<template>
  <div class="wrap page">
    <header class="page-head">
      <p class="eyebrow mono">Agents</p>
      <h1 class="page-title">代理人</h1>
      <p class="page-sub">
        新艾利都登记在册的代理人名录。可按属性、职业筛选，或输入姓名检索。
      </p>
    </header>

    <section class="toolbar">
      <FilterChips
        :attr="attrFilter"
        :prof="profFilter"
        @update:attr="attrFilter = $event"
        @update:prof="profFilter = $event"
      />
      <SearchField v-model="query" :count="count" placeholder="检索姓名…" />
    </section>

    <AsyncState
      :status="status"
      :error="error"
      :empty="status === 'success' && filtered.length === 0"
    >
      <CatalogTable :columns="columns" :items="filtered">
        <template #cell-name="{ row }">
          <RouterLink :to="`/agents/${row.Id}`" class="name-cell">
            <span class="mini-icon">
              <HollowImage
                :srcs="iconSources({ Id: row.Id, icon: row.icon }, 'list', 'character', { excludeHoney: true })"
                :alt="pickName(row)"
                :fallback="pickName(row)" fit="contain" />
            </span>
            <span class="name-link">{{ pickName(row) }}</span>
          </RouterLink>
        </template>
        <template #cell-attr="{ row }">
          <Tags :element="row.element" />
        </template>
        <template #cell-prof="{ row }">
          <Tags :specialty="row.type" />
        </template>
        <template #cell-camp="{ row }">
          <span class="camp mono">C{{ String(row.camp ?? '—').padStart(2, '0') }}</span>
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

.name-link {
  font-size: 15px;
  letter-spacing: 0.02em;
  transition: color var(--t-fast) var(--ease);
}

.name-link:hover {
  color: var(--amber-hi);
}

/* 由 CatalogTable 列 cls 应用（子组件作用域，用 :deep 穿透） */
:deep(.camp) {
  color: var(--ink-2);
  font-size: 12px;
  letter-spacing: 0.12em;
}
</style>