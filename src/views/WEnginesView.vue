<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useCatalogList } from '@/composables/useCatalogList'
import { useCatalogSort } from '@/composables/useCatalogSort'
import { armPrefetchDetail, prefetchDetail } from '@/composables/useDetailPrefetch'
import { listFor } from '@/data/resources'
import { iconSources } from '@/data/icons'
import { weaponArtCardSources, WEAPON_ART_RATIO } from '@/data/weaponArt'
import type { WEngineListItem } from '@/data/types'
import { pickName } from '@/utils/names'
import { pickText } from '@/domain/lang'
import { fmt } from '@/domain/uiText'
import { useLocale } from '@/composables/useLocale'
import { useUiText } from '@/composables/useUiText'
import { stripRichText } from '@/utils/text'
import { usePageMeta } from '@/composables/usePageMeta'
import { catalogEntry } from '@/domain/catalog'
import { W_ENGINE_LEVEL_MAX, W_ENGINE_LEVEL_MIN, wEnginePropsAtLevel, type StatItem } from '@/domain/sections'
import { AsyncState, CardBlock, CardGrid, FilterDropdown, ListPage, SearchField } from '@/components'
import HollowImage from '@/components/HollowImage.vue'
import Tags from '@/components/Tags.vue'
import Rarity from '@/components/Rarity.vue'

usePageMeta()

const cat = catalogEntry('/w-engines')
const base = cat.path

const { lang } = useLocale()
const { t } = useUiText()

const { data, status, error, reload } = useAsyncResource(() =>
  listFor<WEngineListItem>(cat, lang.value),
)

const { profFilter, query, filtered, count, hasActiveFilter, reset } = useCatalogList<WEngineListItem>({
  items: () => data.value ?? [],
  withProfs: true,
  syncRoute: true,
  keywords: (r) => [r.effect_name ?? '', stripRichText(r.effect_desc)],
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

function warmDwell(r: WEngineListItem): void {
  armPrefetchDetail(cat, r.Id)
}

function warmNow(r: WEngineListItem): void {
  prefetchDetail(cat, r.Id)
}

function artSources(r: WEngineListItem): string[] {
  return weaponArtCardSources(r.icon)
}

function fallbackIconSources(r: WEngineListItem): string[] {
  return iconSources({ Id: r.Id, icon: r.icon }, 'weapon')
}

function specsOf(r: WEngineListItem): StatItem[] {
  return wEnginePropsAtLevel(W_ENGINE_LEVEL_MAX, r.base_property, r.rand_property, r.atk, lang.value)
}

function specNoteOf(r: WEngineListItem): string {
  return r.atk != null
    ? fmt(t.value.detail.maxLevelNote, { n: W_ENGINE_LEVEL_MAX })
    : `Lv.${W_ENGINE_LEVEL_MIN}`
}
</script>

<template>
  <ListPage>
    <header v-reveal class="page-head">
      <p class="eyebrow mono">W-Engines</p>
      <h1 class="page-title">{{ pickText(cat.label, lang) }}</h1>
      <p class="page-sub">
        {{ t.list.wenginesIntro }}
      </p>
    </header>

    <section v-reveal="90" class="toolbar">
      <div class="toolbar-left">
        <FilterDropdown
          :show-attr="false"
          :prof="profFilter"
          @update:prof="profFilter = $event"
        />
      </div>
      <SearchField v-model="query" :count="count" :placeholder="t.list.searchWEngine" />
    </section>

    <AsyncState
      :status="status"
      :error="error"
      :retry="reload"
      :empty="status === 'success' && !data?.length"
    >
      <template #skeleton>
        <CardGrid :items="[]" skeleton class="wengine-grid" min-column="min(360px, 100%)">
          <template #skeleton>
            <span class="bar sk-art" />
            <span class="bar sk-name" />
            <span class="bar sk-meta" />
            <span class="bar sk-line" />
            <span class="bar sk-line" />
            <span class="bar sk-line short" />
            <span class="bar sk-line" />
            <span class="bar sk-line" />
            <span class="bar sk-line short" />
          </template>
        </CardGrid>
      </template>

      <CardGrid
        v-reveal="160"
        class="wengine-grid"
        :items="sorted"
        :key-of="(r) => r.Id"
        min-column="min(360px, 100%)"
        :empty-text="t.noMatch.wengines"
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
              :style="{ aspectRatio: WEAPON_ART_RATIO }"
            >
              <HollowImage
                v-if="artSources(r).length"
                unframed
                :srcs="artSources(r)"
                alt=""
                :loading="index < 3 ? 'eager' : 'lazy'"
                :fetchpriority="index === 0 ? 'high' : undefined"
              />
              <HollowImage
                v-else
                unframed
                :srcs="fallbackIconSources(r)"
                alt=""
                :loading="index < 3 ? 'eager' : 'lazy'"
              />
            </span>

            <span class="card-title">
              <span class="card-name">{{ pickName(r, lang) }}</span>
              <span class="card-meta">
                <Rarity :rank="r.rank" />
                <Tags :specialty="r.type" />
              </span>
            </span>
          </RouterLink>

          <CardBlock v-if="r.base_property?.value != null" :label="t.detail.baseProps" variant="plain">
            <template #note>{{ specNoteOf(r) }}</template>
            <dl class="specs">
              <div v-for="s in specsOf(r)" :key="s.label" class="spec">
                <dt class="spec-k">{{ s.label }}</dt>
                <span class="leader" aria-hidden="true" />
                <dd class="spec-v mono">{{ s.value }}</dd>
              </div>
            </dl>
          </CardBlock>

          <CardBlock v-if="r.effect_desc" :label="t.list.wengineEffect">
            <template #note>{{
              r.effect_refine ? fmt(t.detail.refineRank, { n: r.effect_refine }) : ''
            }}</template>
            <p v-if="r.effect_name" class="effect-name">{{ r.effect_name }}</p>
            <p class="effect-txt">{{ stripRichText(r.effect_desc) }}</p>
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
  gap: var(--space-inline);
  justify-content: space-between;
  margin-bottom: 20px;
}

.toolbar-left {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.wengine-grid :deep(.card) {
  position: relative;
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
  max-width: 62%;
  max-height: 86%;
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
}

@media (hover: hover) {
  .wengine-grid :deep(.card:hover) .card-art {
    border-color: var(--amber);
  }

  .wengine-grid :deep(.card:hover) .card-name {
    color: var(--amber-hi);
  }
}

@media (min-width: 600px) and (max-width: 799px) {
  .wengine-grid :deep(.card-grid) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 480px) {
  .wengine-grid :deep(.card-grid) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .wengine-grid :deep(.card) {
    padding: 10px;
    gap: 8px;
  }

  .wengine-grid :deep(.card-block),
  .wengine-grid :deep(.sk-line) {
    display: none;
  }

  .wengine-grid :deep(.skel) {
    gap: 8px;
  }

  .card-link {
    gap: 8px;
  }
}

@media (max-width: 340px) {
  .wengine-grid :deep(.card-grid) {
    grid-template-columns: minmax(0, 1fr);
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

.sk-line {
  width: 100%;
  margin-top: 12px;
}

.sk-line.short {
  width: 62%;
}

/* ---------- 基础属性：点线规格表 ---------- */

.specs {
  margin: 0;
  display: flex;
  flex-direction: column;
}

.spec {
  display: flex;
  align-items: baseline;
  gap: var(--space-inline);
  padding-block: 3px;
}

.spec-k {
  flex: none;
  font-size: var(--fs-caption);
  letter-spacing: 0.08em;
  color: var(--ink-1);
}

.leader {
  flex: 1;
  min-width: 16px;
  border-bottom: 1px dotted color-mix(in srgb, var(--ink-2) 72%, transparent);
  transform: translateY(-4px);
}

.spec-v {
  flex: none;
  margin: 0;
  font-size: var(--fs-body);
  color: var(--ink-0);
}

/* ---------- 音擎效果 ---------- */

.effect-name {
  font-family: var(--serif);
  font-size: var(--fs-body);
  letter-spacing: 0.02em;
  color: var(--ink-0);
}

.effect-txt {
  margin-top: 4px;
}

.card-block :deep(.block-body) {
  max-width: none;
}
</style>
