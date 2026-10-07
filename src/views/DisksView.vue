<script setup lang="ts">
/* 陈列形态决策（架构评审 2026-09）：驱动盘刻意保留卡片栅格、不并入 CatalogTable——
 * 2/4 件套效果是长文本（stripRichText 后仍数行），表格行的信息密度不适配。
 * 与音擎名录同构：卡壳/骨架/空态由 CardGrid + CardBlock 收起（两页共用），
 * 本页只声明「一张卡片陈列什么」；筛选/排序/取数分别经 useCatalogList/useCatalogSort/resources 收敛。 */
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useCatalogList } from '@/composables/useCatalogList'
import { useCatalogSort } from '@/composables/useCatalogSort'
import { listFor } from '@/data/resources'
import { iconSources } from '@/data/icons'
import { stripRichText } from '@/utils/text'
import type { DiskDriveListItem } from '@/data/types'
import { usePageMeta } from '@/composables/usePageMeta'
import { catalogEntry } from '@/domain/catalog'
import { AsyncState, CardBlock, CardGrid, CopyLinkButton, ListPage, NameCell, SearchField } from '@/components'

usePageMeta()

/** 详情路由前缀与名录取数均由 catalog 派生（单一事实源） */
const cat = catalogEntry('/disks')
const base = cat.path

const { data, status, error, reload } = useAsyncResource(() => listFor<DiskDriveListItem>(cat))

const { query, filtered, count, hasActiveFilter, reset } = useCatalogList<DiskDriveListItem>({
  items: () => data.value ?? [],
  name: (d) => d.zh?.name ?? '',
  syncRoute: true,
  keywords: (d) => [d.zh?.desc2 ?? '', d.zh?.desc4 ?? ''],
})

const { sorted, sortKey, sortDir, toggle, isDefault: sortIsDefault } = useCatalogSort(
  filtered,
  [
    { key: 'id', value: (d) => d.Id },
    { key: 'name', value: (d) => d.zh?.name ?? '' },
  ],
  { defaultKey: 'id', defaultDir: 'desc', syncRoute: true },
)
</script>

<template>
  <ListPage>
    <header v-reveal class="page-head">
      <p class="eyebrow mono">Disk Drives</p>
      <h1 class="page-title">驱动盘</h1>
      <p class="page-sub">
        驱动盘套装总览。2 件套与 4 件套效果直接陈列于卡片中；可按名称检索或排序。
      </p>
    </header>

    <div v-reveal="90" class="toolbar">
      <div class="toolbar-left">
        <button
          type="button"
          class="sort-btn mono"
          :class="{ on: sortKey === 'name' }"
          :aria-pressed="sortKey === 'name'"
          @click="toggle('name')"
        >
          名称
          <span v-if="sortKey === 'name'" class="sort-arrow" aria-hidden="true">
            {{ sortDir === 'asc' ? '▲' : '▼' }}
          </span>
        </button>
      </div>
      <SearchField v-model="query" :count="count" placeholder="检索套装…" />
      <!-- 筛选/搜索生效时 URL 带状态：显式给出「复制此视图链接」入口 -->
      <CopyLinkButton v-if="hasActiveFilter || !sortIsDefault" label="复制筛选链接" />
    </div>

    <!-- 空态分工：AsyncState 只管「数据级为空」；「筛掉全部结果」由 CardGrid 承担 -->
    <AsyncState
      :status="status"
      :error="error"
      :retry="reload"
      :empty="status === 'success' && !data?.length"
    >
      <template #skeleton>
        <CardGrid :items="[]" skeleton />
      </template>

      <CardGrid
        v-reveal="160"
        :items="sorted"
        :key-of="(d) => d.Id"
        empty-text="无匹配驱动盘"
        :show-clear="hasActiveFilter"
        @clear="reset"
      >
        <template #default="{ item: d }">
          <NameCell
            :to="`${base}/${d.Id}`"
            :srcs="iconSources({ Id: d.Id, icon: d.icon }, 'disc')"
            alt=""
            :fallback="d.zh?.name ?? '—'"
            :name="d.zh?.name ?? '—'"
            thumb="square"
            name-style="card"
          />

          <CardBlock label="2 件套">
            <p>{{ stripRichText(d.zh?.desc2) }}</p>
          </CardBlock>
          <CardBlock label="4 件套">
            <p>{{ stripRichText(d.zh?.desc4) }}</p>
          </CardBlock>
        </template>
      </CardGrid>
    </AsyncState>
  </ListPage>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-inline);
  margin-bottom: 20px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sort-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-caption);
  letter-spacing: 0.14em;
  color: var(--ink-2);
  border: 1px solid var(--line-1);
  border-radius: 2px;
  padding: 6px 12px;
  transition: color var(--t-fast) var(--ease),
    border-color var(--t-fast) var(--ease),
    background var(--t-fast) var(--ease);
}

@media (hover: hover) {
  .sort-btn:hover {
    color: var(--ink-0);
    border-color: var(--line-2);
  }
}

.sort-btn.on {
  color: var(--amber-hi);
  border-color: var(--amber);
  background: var(--amber-dim);
}

.sort-arrow {
  font-size: var(--fs-nano);
}
</style>
