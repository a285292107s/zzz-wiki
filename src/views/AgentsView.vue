<script setup lang="ts">
import { computed } from 'vue'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useCatalogList } from '@/composables/useCatalogList'
import { useCatalogSort } from '@/composables/useCatalogSort'
import { useAgentsViewVersion } from '@/composables/useAgentsViewVersion'
import { listFor } from '@/data/resources'
import type { CharacterListItem } from '@/data/types'
import { pickName } from '@/utils/names'
import { pickText } from '@/domain/lang'
import { useLocale } from '@/composables/useLocale'
import { useUiText } from '@/composables/useUiText'
import { usePageMeta } from '@/composables/usePageMeta'
import { catalogEntry } from '@/domain/catalog'
import {
  AgentCardGrid,
  AgentCardList,
  AgentTableList,
  AsyncState,
  CatalogTableSkeleton,
  FilterDropdown,
  ListPage,
  SearchField,
} from '@/components'

usePageMeta()

/** 详情路由前缀与名录取数均由 catalog 派生（单一事实源，禁止手写第二份类目路径） */
const cat = catalogEntry('/agents')
const base = cat.path

/** 当前展示语言：名录按语言落盘，语言一变这里的取数会重新拉（见 useAsyncResource） */
const { lang } = useLocale()
const { t } = useUiText()

/** 陈列版本：本机偏好（卡片 / 表格），切换入口就在工具栏——读者不必离开名录页 */
const { agentsViewVersion, setAgentsViewVersion } = useAgentsViewVersion()
const isCards = computed(() => agentsViewVersion.value === 'cards')

const { data, status, error, reload } = useAsyncResource(() =>
  listFor<CharacterListItem>(cat, lang.value),
)

const { attrFilter, profFilter, campFilter, query, filtered, count, hasActiveFilter, reset } =
  useCatalogList<CharacterListItem>({
    items: () => data.value ?? [],
    withAttrs: true,
    withProfs: true,
    withCamps: true,
    syncRoute: true,
    keywords: (row) => [row.camp_name ?? ''],
  })

/** 阵营候选项：由数据动态提取（数字码 + 展示名），按码排序 */
const camps = computed(() => {
  const map = new Map<number, string>()
  for (const row of data.value ?? []) {
    if (row.camp !== undefined && row.camp_name) map.set(row.camp, row.camp_name)
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([code, name]) => ({ code, name }))
})

/** 陈列顺序两版共用：默认编号倒序（键 id/name/rarity 照读历史 ?sort=&dir= 深链） */
const { sorted } = useCatalogSort(
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
      <p class="eyebrow mono">Agents</p>
      <h1 class="page-title">{{ pickText(cat.label, lang) }}</h1>
      <p class="page-sub">
        {{ t.list.agentsIntro }}
      </p>
    </header>

    <div v-reveal="90" class="toolbar">
      <div class="toolbar-left">
        <FilterDropdown
          :attr="attrFilter"
          :prof="profFilter"
          :camp="campFilter"
          :camps="camps"
          @update:attr="attrFilter = $event"
          @update:prof="profFilter = $event"
          @update:camp="campFilter = $event"
        />
      </div>
      <div class="toolbar-right">
        <div class="view-switch" role="group" :aria-label="t.list.viewMode">
          <button
            type="button"
            class="view-btn"
            :class="{ on: agentsViewVersion === 'cards' }"
            :aria-pressed="agentsViewVersion === 'cards'"
            @click="setAgentsViewVersion('cards')"
          >
            {{ t.list.viewCards }}
          </button>
          <button
            type="button"
            class="view-btn"
            :class="{ on: agentsViewVersion === 'table' }"
            :aria-pressed="agentsViewVersion === 'table'"
            @click="setAgentsViewVersion('table')"
          >
            {{ t.list.viewTable }}
          </button>
        </div>
        <SearchField v-model="query" :count="count" :placeholder="t.list.searchName" />
      </div>
    </div>

    <AsyncState
      :status="status"
      :error="error"
      :retry="reload"
      :empty="status === 'success' && !data?.length"
    >
      <template #skeleton>
        <AgentCardGrid v-if="isCards" skeleton :items="[]" :base="base" />
        <CatalogTableSkeleton v-else :cols="5" />
      </template>

      <div v-reveal="160" class="list-body">
        <AgentCardList
          v-if="isCards"
          :items="sorted"
          :base="base"
          :show-clear="hasActiveFilter"
          :empty-text="t.noMatch.agents"
          @clear="reset"
        />
        <AgentTableList
          v-else
          :items="sorted"
          :base="base"
          :show-clear="hasActiveFilter"
          :empty-text="t.noMatch.agents"
          @clear="reset"
        />
      </div>
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
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  /* 窄于一行放不下时（约 721–790 区间）这一组单独折到第二行，靠右贴齐版心右缘 */
  margin-left: auto;
}

.toolbar :deep(.search) {
  width: auto;
  min-width: 280px;
}

/* 陈列版本切换：两格方角按钮，选中格琥珀底 + 琥珀字（与筛选触发钮同一套发丝线语言） */
.view-switch {
  display: inline-flex;
  flex: none;
  border: 1px solid var(--line-1);
  border-radius: 2px;
}

.view-btn {
  padding: 7px 12px;
  background: none;
  border: 0;
  border-radius: 0;
  color: var(--ink-1);
  font-size: var(--fs-small);
  letter-spacing: 0.06em;
  white-space: nowrap;
  cursor: pointer;
  transition: color var(--t-fast) var(--ease), background-color var(--t-fast) var(--ease);
}

.view-btn + .view-btn {
  border-left: 1px solid var(--line-1);
}

.view-btn.on {
  color: var(--amber-hi);
  background: var(--amber-dim);
}

@media (hover: hover) {
  .view-btn:not(.on):hover {
    color: var(--ink-0);
    background: var(--bg-2);
  }
}

.view-btn:focus-visible {
  position: relative;
  z-index: 1;
  outline: 1px solid var(--focus);
  outline-offset: 2px;
}

@media (max-width: 860px) {
  .toolbar-right {
    margin-left: 0;
    width: 100%;
  }

  .toolbar :deep(.search) {
    flex: 1 1 auto;
    min-width: 0;
  }
}

/* ---------- 手机断点：工具栏两行（筛选 / 切换 + 检索），右缘与版心对齐 ---------- */
@media (max-width: 720px) {
  .toolbar {
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    gap: 10px;
  }

  .toolbar-left :deep(.filter-dropdown) {
    flex: 1 1 100%;
  }

  .toolbar-left :deep(.filter-dropdown .group) {
    flex: 1 1 auto;
    min-width: 0;
  }

  .toolbar-left :deep(.filter-dropdown .trigger) {
    width: 100%;
  }

  .toolbar-left :deep(.filter-dropdown .caret) {
    margin-left: auto;
  }

  .toolbar-left :deep(.filter-dropdown .trigger-label) {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .toolbar-right {
    width: 100%;
  }

  .view-btn {
    min-height: 44px;
    padding: 7px 12px;
  }

  .toolbar :deep(.search) {
    flex: 1 1 auto;
    width: auto;
    min-width: 0;
  }
}
</style>
