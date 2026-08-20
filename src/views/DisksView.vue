<script setup lang="ts">
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useCatalogList } from '@/composables/useCatalogList'
import { useCatalogSort } from '@/composables/useCatalogSort'
import { api } from '@/data/api'
import { iconSources } from '@/data/icons'
import { stripRichText } from '@/utils/text'
import type { DiskDriveListItem } from '@/data/types'
import { usePageMeta } from '@/composables/usePageMeta'
import { catalogByPath } from '@/domain/catalog'
import { AsyncState, ListPage } from '@/components'
import HollowImage from '@/components/HollowImage.vue'

usePageMeta()

/** 详情路由前缀由 catalog 派生（单一事实源） */
const base = catalogByPath('/disks')?.path ?? '/disks'

const { data, status, error } = useAsyncResource(() => api.disks())

const { query, filtered, count } = useCatalogList<DiskDriveListItem>({
  items: () => data.value ?? [],
  name: (d) => d.zh?.name ?? '',
  syncRoute: true,
  keywords: (d) => [d.zh?.desc2 ?? '', d.zh?.desc4 ?? ''],
})

const { sorted, sortKey, sortDir, toggle } = useCatalogSort(
  filtered,
  [
    { key: 'id', value: (d) => d.Id },
    { key: 'name', value: (d) => d.zh?.name ?? '' },
  ],
  { defaultKey: 'id', defaultDir: 'desc' },
)
</script>

<template>
  <ListPage>
    <header class="page-head">
      <p class="eyebrow mono">Disk Drives</p>
      <h1 class="page-title">驱动盘</h1>
      <p class="page-sub">
        驱动盘套装总览。2 件套与 4 件套效果直接陈列于卡片中；可按名称检索或排序。
      </p>
    </header>

    <div class="toolbar">
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
    </div>

    <AsyncState
      :status="status"
      :error="error"
      :empty="status === 'success' && filtered.length === 0"
    >
      <template #skeleton>
        <ul class="disk-grid" aria-hidden="true">
          <li v-for="i in 6" :key="i" class="disk-card skel">
            <span class="bar thumb-bar" />
            <span class="bar name-bar" />
            <span class="bar body-bar" />
            <span class="bar body-bar" />
          </li>
        </ul>
      </template>

      <ul class="disk-grid">
        <li v-for="d in sorted" :key="d.Id" class="disk-card">
          <RouterLink :to="`${base}/${d.Id}`" class="card-head">
            <span class="thumb">
              <HollowImage
                :srcs="iconSources({ Id: d.Id, icon: d.icon }, 'disc')"
                :alt="d.zh?.name ?? '—'"
                :fallback="d.zh?.name ?? '—'"
                fit="contain"
              />
            </span>
            <span class="name">{{ d.zh?.name ?? '—' }}</span>
          </RouterLink>

          <div class="set">
            <span class="set-lbl mono">2 件套</span>
            <p class="set-txt">{{ stripRichText(d.zh?.desc2) }}</p>
          </div>
          <div class="set set4">
            <span class="set-lbl mono">4 件套</span>
            <p class="set-txt">{{ stripRichText(d.zh?.desc4) }}</p>
          </div>
        </li>
      </ul>
    </AsyncState>
  </ListPage>
</template>

<style scoped>

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
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
  font-size: 12px;
  letter-spacing: 0.14em;
  color: var(--ink-2);
  border: 1px solid var(--line-1);
  border-radius: 2px;
  padding: 6px 12px;
  transition: color var(--t-fast) var(--ease),
    border-color var(--t-fast) var(--ease),
    background var(--t-fast) var(--ease);
}

.sort-btn:hover {
  color: var(--ink-0);
  border-color: var(--line-2);
}

.sort-btn.on {
  color: var(--amber-hi);
  border-color: var(--amber);
  background: var(--amber-dim);
}

.sort-arrow {
  font-size: 10px;
}

/* ---------- card grid ---------- */

.disk-grid {
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1px;
  background: var(--line-1);
  border: var(--rule);
}

.disk-card {
  background: var(--bg-2);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card-head {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  color: inherit;
  min-width: 0;
}

.thumb {
  width: 40px;
  height: 40px; /* 驱动盘图标 151×151 方形，contain 完整显示 */
  flex: none;
  display: block;
}

.thumb :deep(.frame) {
  border-radius: 2px;
}

.name {
  font-family: var(--serif);
  font-size: 17px;
  font-weight: 500;
  letter-spacing: 0.02em;
  transition: color var(--t-fast) var(--ease);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-head:hover .name {
  color: var(--amber-hi);
}

.set {
  border-top: var(--rule);
  padding-top: 10px;
}

.set4 {
  padding-top: 10px;
}

.set-lbl {
  font-size: 10px;
  letter-spacing: 0.2em;
  color: var(--ink-3);
}

.set-txt {
  margin-top: 6px;
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--ink-1);
  max-width: 46ch;
}

/* ---------- skeleton ---------- */

.skel {
  gap: 14px;
}

.skel .bar {
  display: block;
  height: 12px;
  background: linear-gradient(
    90deg,
    var(--bg-1) 0%,
    var(--bg-3) 50%,
    var(--bg-1) 100%
  );
  background-size: 200% 100%;
  animation: skel-pulse 1.4s ease-in-out infinite;
}

.skel .thumb-bar {
  width: 40px;
  height: 40px;
}

.skel .name-bar {
  width: 50%;
  height: 16px;
}

.skel .body-bar {
  width: 100%;
  height: 12px;
  margin-top: 10px;
}

@media (prefers-reduced-motion: reduce) {
  .skel .bar {
    animation: none;
    background: var(--bg-1);
  }
}
</style>
