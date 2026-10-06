<script setup lang="ts">
/* 陈列形态决策（架构评审 2026-09）：驱动盘刻意保留卡片栅格、不并入 CatalogTable——
 * 2/4 件套效果是长文本（stripRichText 后仍数行），表格行的信息密度不适配；
 * 与其它名录共享的部分（筛选/排序/取数）已分别经 useCatalogList/useCatalogSort/resources 收敛，
 * 未共享的仅剩排序按钮与骨架的视觉外壳，强行抽公共 grid-list 的收益低于接口成本。 */
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useCatalogList } from '@/composables/useCatalogList'
import { useCatalogSort } from '@/composables/useCatalogSort'
import { listFor } from '@/data/resources'
import { iconSources } from '@/data/icons'
import { stripRichText } from '@/utils/text'
import type { DiskDriveListItem } from '@/data/types'
import { usePageMeta } from '@/composables/usePageMeta'
import { catalogEntry } from '@/domain/catalog'
import { AsyncState, ListPage, SearchField } from '@/components'
import HollowImage from '@/components/HollowImage.vue'
import { prefetchDetail, armPrefetchDetail } from '@/composables/useDetailPrefetch'

usePageMeta()

/** 详情路由前缀与名录取数均由 catalog 派生（单一事实源） */
const cat = catalogEntry('/disks')
const base = cat.path

const { data, status, error } = useAsyncResource(() => listFor<DiskDriveListItem>(cat))

const { query, filtered, count, hasActiveFilter, reset } = useCatalogList<DiskDriveListItem>({
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

/** 悬停卡片头即预热详情（驻留 90ms 发射），pointerdown 立即——与 NameCell 同一回路 */
function warmDwell(id: number | string): void {
  armPrefetchDetail(cat, id)
}
function warmNow(id: number | string): void {
  prefetchDetail(cat, id)
}
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
    </div>

    <!-- 空态分工：AsyncState 只管「数据级为空」；「筛掉全部结果」由下方 .disk-empty 承担 -->
    <AsyncState
      :status="status"
      :error="error"
      :empty="status === 'success' && !data?.length"
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

      <!-- 空态（检索无匹配）：此前只留空白栅格 —— 卡片栅格用 li 呈现，
           与表格名录同一套文案与「清除」动作（CatalogTable 侧是实现同名空态） -->
      <div v-if="!sorted.length" class="disk-empty">
        <p class="empty-title mono">无匹配驱动盘</p>
        <p class="empty-hint">换个关键词，或清除检索条件查看全部档案。</p>
        <button v-if="hasActiveFilter" type="button" class="empty-clear mono" @click="reset()">
          清除检索与筛选
        </button>
      </div>

      <ul v-else v-reveal="160" class="disk-grid">
        <li v-for="d in sorted" :key="d.Id" class="disk-card">
          <RouterLink :to="`${base}/${d.Id}`" class="card-head" @pointerenter="warmDwell(d.Id)" @pointerdown="warmNow(d.Id)" @focus="warmNow(d.Id)">
            <span class="thumb">
              <!-- alt 置空：盘名文本紧随同链接内，图再念一遍名字是冗余朗读（axe image-redundant-alt） -->
              <HollowImage
                :srcs="iconSources({ Id: d.Id, icon: d.icon }, 'disc')"
                alt=""
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
  font-size: var(--fs-subhead);
  font-weight: 500;
  letter-spacing: 0.02em;
  transition: color var(--t-fast) var(--ease);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (hover: hover) {
  .card-head:hover .name {
    color: var(--amber-hi);
  }
}

.set {
  border-top: var(--rule);
  padding-top: 10px;
}

.set4 {
  padding-top: 10px;
}

.set-lbl {
  font-size: var(--fs-nano);
  letter-spacing: 0.2em;
  /* ink-1 而非 ink-2/ink-3：本标签是 10px 小字，须过 4.5:1。ink-3 仅 2.06:1；
     ink-2 在卡片底色 --bg-2（比页面底色亮的档位，ink-2 的 4.87:1 是在 bg-0/bg-1
     上标定的）上实测 4.40:1 仍差一点 —— 故取 ink-1（6.98:1）。
     层级由字号/字距/等宽小字承担，不再靠压暗颜色。 */
  color: var(--ink-1);
}

.set-txt {
  margin-top: 6px;
  font-size: var(--fs-caption);
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
  animation: skel-pulse var(--t-skel) ease-in-out infinite;
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
/* ---------- 空态（检索无匹配）---------- */

.disk-empty {
  padding: 46px 16px 50px;
  text-align: center;
  border: 1px solid var(--line-0);
  border-radius: 2px;
}

.empty-title {
  font-size: var(--fs-micro);
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--ink-1);
}

.empty-hint {
  margin-top: 10px;
  font-size: var(--fs-caption);
  color: var(--ink-2);
}

.empty-clear {
  margin-top: 18px;
  padding: 7px 14px;
  background: none;
  border: 1px solid var(--line-1);
  border-radius: 2px;
  color: var(--ink-1);
  font-size: var(--fs-caption);
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease);
}

@media (hover: hover) {
  .empty-clear:hover {
    color: var(--amber-hi);
    border-color: var(--amber);
  }
}

.empty-clear:focus-visible {
  outline: 1px solid var(--focus);
  outline-offset: 2px;
}
</style>
