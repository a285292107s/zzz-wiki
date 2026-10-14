<script setup lang="ts">
/* 新版代理人名录（卡片版）：与表格版 AgentsView 同一份数据、同一套筛选/检索，
 * 只是把陈列从五列表格换成 9:16 立绘格 + 图下标本签。
 *
 * **本页不摆排序控件**：排序钮与标本签陈列挤在同一行工具栏，而两版共用「筛选 + 检索」这套
 * 工具栏语言更干净（表格版也一并移除了表头排序，两版行为一致）。
 * 陈列顺序取 useCatalogSort 的默认（编号倒序），地址栏里的 ?sort=&dir= 仍照读——
 * 历史分享出去的排序链接打开仍是同一份视图。
 *
 * 两版的可见控件不同，故工具栏 markup 各写一份；共用的**逻辑**收在 useCatalogList /
 * useCatalogSort 里，这里只重复排布、不重复实现——两版由 /agents 的版本外壳按读者
 * 的本地偏好择一渲染（见 AgentsRouteView）。 */

import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useCatalogList } from '@/composables/useCatalogList'
import { useCatalogSort } from '@/composables/useCatalogSort'
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
  AsyncState,
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

/** 陈列顺序：默认编号倒序（本页与表格版共用同一组键 id/name/rarity + id desc），
 *  故历史 ?sort=&dir= 链接在两版打开都是同一份视图。 */
const { sorted } = useCatalogSort(
  filtered,
  [
    { key: 'id', value: (r) => r.Id },
    { key: 'name', value: (r) => pickName(r, lang.value) },
    { key: 'rarity', value: (r) => r.rank ?? -1 },
  ],
  { defaultKey: 'id', defaultDir: 'desc', syncRoute: true },
)

/* ---------- 渐进加载：首屏一屏半，往下滚自动续 ----------
   61 张立绘一次全下会白下大半（卡片是首屏外的图）。首屏给 18 格（约一屏半），
   滚到剩 400px 时续下一批；图片本身走原生 loading="lazy"，两者叠加不冲突。
   筛选/检索/排序一变就回到首屏——换了条件就该从头顶重新看。 */

const PAGE_SIZE = 18
const shown = ref(PAGE_SIZE)
const visibleItems = computed(() => sorted.value.slice(0, shown.value))
const hasMore = computed(() => shown.value < sorted.value.length)

watch(sorted, () => {
  shown.value = PAGE_SIZE
})

function loadMore(): void {
  shown.value += PAGE_SIZE
}

/** 无 IntersectionObserver（老浏览器 / 单测的 jsdom）时退回显式「显示更多」按钮，
 *  不让自动续加载成为唯一出路 */
const canAutoLoad = typeof IntersectionObserver === 'function'
const sentinel = ref<HTMLElement | null>(null)
let io: IntersectionObserver | null = null

watch(
  sentinel,
  (el) => {
    io?.disconnect()
    io = null
    if (!canAutoLoad || !el) return
    io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore()
      },
      { rootMargin: '400px' },
    )
    io.observe(el)
  },
  { flush: 'post' },
)

onBeforeUnmount(() => {
  io?.disconnect()
  io = null
})
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

    <!-- 工具行与表格版同为普通块：它既不是页面骨架，也不承担 landmark -->
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
      <SearchField v-model="query" :count="count" :placeholder="t.list.searchName" />
    </div>

    <!-- 空态分工：AsyncState 只管「数据级为空」；「筛掉全部结果」由 AgentCardGrid 承担 -->
    <AsyncState
      :status="status"
      :error="error"
      :retry="reload"
      :empty="status === 'success' && !data?.length"
    >
      <template #skeleton>
        <AgentCardGrid skeleton :items="[]" :base="base" />
      </template>

      <AgentCardGrid
        v-reveal="160"
        :items="visibleItems"
        :base="base"
        :show-clear="hasActiveFilter"
        :empty-text="t.noMatch.agents"
        @clear="reset"
      />

      <!-- 续加载哨兵：滚到附近自动续；没有观察器的环境显示成一颗按钮 -->
      <div v-if="hasMore" ref="sentinel" class="more">
        <button v-if="!canAutoLoad" type="button" class="more-btn mono" @click="loadMore">
          {{ t.list.loadMore }}
        </button>
        <p v-else class="more-count mono" aria-live="polite">
          {{ visibleItems.length }} / {{ sorted.length }}
        </p>
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

/* 左组：筛选下拉（属性/职业/阵营） */
.toolbar-left {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.toolbar :deep(.search) {
  width: auto;
  min-width: 280px;
}

/* ---------- 手机断点：工具栏两行，右缘与版心对齐（与表格版逐条同源） ---------- */
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

  .toolbar :deep(.search) {
    width: 100%;
    min-width: 0;
  }
}

/* ---------- 续加载 ---------- */

.more {
  display: flex;
  justify-content: center;
  padding: 26px 0 6px;
}

.more-btn {
  padding: 8px 18px;
  background: none;
  border: 1px solid var(--line-1);
  border-radius: 2px;
  color: var(--ink-1);
  font-size: var(--fs-caption);
  letter-spacing: 0.12em;
  cursor: pointer;
  transition: color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease);
}

@media (hover: hover) {
  .more-btn:hover {
    color: var(--amber-hi);
    border-color: var(--amber);
  }
}

.more-btn:focus-visible {
  outline: 1px solid var(--focus);
  outline-offset: 2px;
}

/* 自动续加载时的可见计数器：读者知道「下面还有」，也不至于以为列表到这儿就完了。
   取 --ink-2 而非 --ink-3：这行承载信息（已显示 / 总数），要过 4.5:1。 */
.more-count {
  font-size: var(--fs-micro);
  letter-spacing: 0.16em;
  color: var(--ink-2);
}
</style>
