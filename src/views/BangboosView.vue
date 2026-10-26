<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useCatalogList } from '@/composables/useCatalogList'
import { useCatalogSort } from '@/composables/useCatalogSort'
import { armPrefetchDetail, prefetchDetail } from '@/composables/useDetailPrefetch'
import { listFor } from '@/data/resources'
import { iconSources } from '@/data/icons'
import { bangbooArtCardSources, BANGBOO_ART_RATIO } from '@/data/bangbooArt'
import type { BangbooListItem } from '@/data/types'
import { pickName } from '@/utils/names'
import { latinDecor } from '@/utils/latinDecor'
import { pickText } from '@/domain/lang'
import { useLocale } from '@/composables/useLocale'
import { useUiText } from '@/composables/useUiText'
import { usePageMeta } from '@/composables/usePageMeta'
import { catalogEntry, HIDDEN_ITEM_IDS } from '@/domain/catalog'
import { AsyncState, CardGrid, ListPage, SearchField } from '@/components'
import HollowImage from '@/components/HollowImage.vue'
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
const eyebrow = computed(() => latinDecor('Bangboo', pickText(cat.label, lang.value)))

const { data, status, error, reload } = useAsyncResource(() =>
  listFor<BangbooListItem>(cat, lang.value),
)

const { query, filtered, count, hasActiveFilter, reset } = useCatalogList<BangbooListItem>({
  items: () => (data.value ?? []).filter((r) => !HIDDEN_BANGBOO_IDS.has(r.Id)),
  syncRoute: true,
  keywords: (row) => [row.codename ?? ''],
})

const { sorted } = useCatalogSort(
  filtered,
  [
    { key: 'id', value: (r) => r.Id },
    { key: 'name', value: (r) => pickName(r, lang.value) },
    { key: 'rarity', value: (r) => r.rank ?? -1 },
  ],
  { defaultKey: 'id', defaultDir: 'desc', syncRoute: true },
)

function warmDwell(r: BangbooListItem): void {
  armPrefetchDetail(cat, r.Id)
}

function warmNow(r: BangbooListItem): void {
  prefetchDetail(cat, r.Id)
}

function artSources(r: BangbooListItem): string[] {
  return bangbooArtCardSources(r.icon)
}

function fallbackIconSources(r: BangbooListItem): string[] {
  return iconSources({ Id: r.Id, icon: r.icon }, 'bangboo')
}
</script>

<template>
  <ListPage>
    <header v-reveal class="page-head">
      <p v-if="eyebrow" class="eyebrow mono">{{ eyebrow }}</p>
      <h1 class="page-title">{{ pickText(cat.label, lang) }}</h1>
      <p class="page-sub">{{ t.list.bangboosIntro }}</p>
    </header>

    <div v-reveal="90" class="toolbar">
      <SearchField v-model="query" :count="count" :placeholder="t.list.searchBangboo" />
    </div>

    <!-- 空态分工：AsyncState 只管「数据级为空」；「筛掉全部结果」由 CardGrid 承担 -->
    <AsyncState
      :status="status"
      :error="error"
      :retry="reload"
      :empty="status === 'success' && !data?.length"
    >
      <template #skeleton>
        <CardGrid :items="[]" skeleton min-column="min(248px, 100%)">
          <template #skeleton>
            <span class="bar sk-art" />
            <span class="bar sk-name" />
            <span class="bar sk-meta" />
          </template>
        </CardGrid>
      </template>

      <CardGrid
        v-reveal="160"
        class="bangboo-grid"
        :items="sorted"
        :key-of="(r) => r.Id"
        min-column="min(248px, 100%)"
        :empty-text="t.noMatch.bangboos"
        :show-clear="hasActiveFilter"
        @clear="reset"
      >
        <template #default="{ item: r, index }">
          <RouterLink
            class="card-link"
            :to="`${base}/${r.Id}`"
            @pointerenter="warmDwell(r)"
            @pointerdown="warmNow(r)"
            @focus="warmNow(r)"
          >
            <span
              class="card-art"
              :class="{ 'icon-only': !artSources(r).length }"
              :style="{ aspectRatio: BANGBOO_ART_RATIO }"
            >
              <HollowImage
                v-if="artSources(r).length"
                unframed
                :srcs="artSources(r)"
                alt=""
                :loading="index < 4 ? 'eager' : 'lazy'"
                :fetchpriority="index === 0 ? 'high' : undefined"
              />
              <HollowImage
                v-else
                unframed
                :srcs="fallbackIconSources(r)"
                alt=""
                :loading="index < 4 ? 'eager' : 'lazy'"
              />
            </span>

            <span class="card-title">
              <span class="card-name">{{ pickName(r, lang) }}</span>
              <span class="card-meta">
                <Rarity :rank="r.rank" />
                <span v-if="r.codename" class="code mono">{{ r.codename }}</span>
              </span>
            </span>
          </RouterLink>
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
  gap: var(--space-inline);
  margin-bottom: 20px;
}

.bangboo-grid :deep(.card) {
  position: relative;
  padding: 12px;
}

.card-link {
  display: flex;
  flex-direction: column;
  gap: var(--space-inline);
  color: inherit;
  text-decoration: none;
}

.card-link::after {
  content: '';
  position: absolute;
  inset: 0;
}

.card-link:active {
  filter: none;
}

.card-link:active .card-art,
.card-link:active .card-title {
  filter: brightness(0.82);
}

.card-art {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  border: var(--rule);
  border-radius: 2px;
  background: var(--bg-1);
  transition: border-color var(--t-fast) var(--ease);
}

.card-art :deep(img) {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.card-art.icon-only :deep(img) {
  width: auto;
  height: auto;
  max-width: 58%;
  max-height: 82%;
}

.card-title {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.card-name {
  overflow: hidden;
  font-family: var(--serif);
  font-size: var(--fs-subhead);
  font-weight: 500;
  letter-spacing: 0.01em;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--ink-0);
  transition: color var(--t-fast) var(--ease);
}

.card-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.code {
  overflow: hidden;
  color: var(--ink-1);
  font-size: var(--fs-caption);
  letter-spacing: 0.08em;
  white-space: nowrap;
  text-overflow: ellipsis;
}

@media (hover: hover) {
  .bangboo-grid :deep(.card:hover) .card-art {
    border-color: var(--amber);
  }

  .bangboo-grid :deep(.card:hover) .card-name {
    color: var(--amber-hi);
  }
}

.sk-art {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 5 / 4;
}

.sk-name {
  width: 55%;
  height: 16px;
  margin-top: 8px;
}

.sk-meta {
  width: 46%;
  height: 24px;
}
</style>
