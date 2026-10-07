<script setup lang="ts">
/* 陈列形态决策（2026-10，对齐驱动盘名录）：音擎从三列表格改为卡片栅格——
 * 表格只有「名称/稀有度/职业」三列，宽屏下大片留白，而音擎真正被检索的信息
 * （满级面板 + 音擎效果正文）藏在详情里。卡片直接陈列这两块，与驱动盘卡片同构。
 * 卡壳/骨架/空态由 CardGrid + CardBlock 收起（两页共用），本页只声明「一张卡陈列什么」。
 *
 * 效果正文与副属性中文名由构建期注入名录（scripts/build/domains.ts，与详情同源同解析），
 * 故运行时仍只看一个本地名录文件，零额外请求。 */
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useCatalogList } from '@/composables/useCatalogList'
import { useCatalogSort } from '@/composables/useCatalogSort'
import { listFor } from '@/data/resources'
import { iconSources } from '@/data/icons'
import type { WEngineListItem } from '@/data/types'
import { pickName } from '@/utils/names'
import { stripRichText } from '@/utils/text'
import { usePageMeta } from '@/composables/usePageMeta'
import { catalogEntry } from '@/domain/catalog'
import { W_ENGINE_LEVEL_MAX, W_ENGINE_LEVEL_MIN, wEnginePropsAtLevel, type StatItem } from '@/domain/sections'
import { AsyncState, CardBlock, CardGrid, CopyLinkButton, FilterDropdown, ListPage, NameCell, SearchField, SortButton } from '@/components'
import Tags from '@/components/Tags.vue'
import Rarity from '@/components/Rarity.vue'

usePageMeta()

/** 详情路由前缀与名录取数均由 catalog 派生（单一事实源） */
const cat = catalogEntry('/w-engines')
const base = cat.path

const { data, status, error, reload } = useAsyncResource(() => listFor<WEngineListItem>(cat))

/** 检索面：名称 + 音擎效果（效果名与正文）。正文走 stripRichText，
 *  否则查询会命中 <color=#…> 这类标记本身（如输入 "color" 全表皆中）。 */
const { profFilter, query, filtered, count, hasActiveFilter, reset } = useCatalogList<WEngineListItem>({
  items: () => data.value ?? [],
  withProfs: true,
  syncRoute: true,
  keywords: (r) => [r.effect_name ?? '', stripRichText(r.effect_desc)],
})

const { sorted, sortKey, sortDir, toggle, isDefault: sortIsDefault } = useCatalogSort(
  filtered,
  [
    { key: 'id', value: (r) => r.Id },
    { key: 'name', value: (r) => pickName(r) },
    { key: 'rarity', value: (r) => r.rank ?? -1 },
  ],
  { defaultKey: 'id', defaultDir: 'desc', syncRoute: true },
)

/** 卡片「基础属性」块：复用详情页同一取值函数（sections.wEnginePropsAtLevel），
 *  故卡片上的满级面板与详情页默认档逐字一致；名录缺满级值（atk）时该函数回退 Lv.1 静态值。 */
function specsOf(r: WEngineListItem): StatItem[] {
  return wEnginePropsAtLevel(W_ENGINE_LEVEL_MAX, r.base_property, r.rand_property, r.atk)
}

/** 卡片标注的档位：有名录满级值才敢说「满级」，否则如实说回退档（Lv.1 静态值） */
function specNoteOf(r: WEngineListItem): string {
  return r.atk != null ? `满级 Lv.${W_ENGINE_LEVEL_MAX}` : `Lv.${W_ENGINE_LEVEL_MIN}`
}
</script>

<template>
  <ListPage>
    <header v-reveal class="page-head">
      <p class="eyebrow mono">W-Engines</p>
      <h1 class="page-title">音擎</h1>
      <p class="page-sub">
        武装终端图鉴。满级面板与音擎效果直接陈列于卡片中；可按职业定位筛选，或按名称、效果检索。
      </p>
    </header>

    <section v-reveal="90" class="toolbar">
      <div class="toolbar-left">
        <FilterDropdown
          :show-attr="false"
          :prof="profFilter"
          @update:prof="profFilter = $event"
        />
        <!-- 排序表头随表格形态一并消失，改为工具栏排序钮（与驱动盘名录同一件） -->
        <SortButton
          label="名称"
          :active="sortKey === 'name'"
          :dir="sortKey === 'name' ? sortDir : null"
          @toggle="toggle('name')"
        />
        <SortButton
          label="稀有度"
          :active="sortKey === 'rarity'"
          :dir="sortKey === 'rarity' ? sortDir : null"
          @toggle="toggle('rarity')"
        />
      </div>
      <SearchField v-model="query" :count="count" placeholder="检索音擎或效果…" />
      <!-- 筛选/搜索生效时 URL 带状态：显式给出「复制此视图链接」入口 -->
      <CopyLinkButton v-if="hasActiveFilter || !sortIsDefault" label="复制筛选链接" />
    </section>

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
        :key-of="(r) => r.Id"
        min-column="300px"
        empty-text="无匹配音擎"
        :show-clear="hasActiveFilter"
        @clear="reset"
      >
        <template #default="{ item: r }">
          <NameCell
            :to="`${base}/${r.Id}`"
            :srcs="iconSources({ Id: r.Id, icon: r.icon }, 'weapon', 'thumb')"
            alt=""
            :fallback="pickName(r)"
            :name="pickName(r)"
            thumb="square"
            name-style="card"
          />

          <div class="card-meta">
            <Rarity :rank="r.rank" />
            <Tags :specialty="r.type" />
          </div>

          <!-- 数值账目排印（点线规格表），与详情页基础属性同语言 -->
          <CardBlock v-if="r.base_property?.value != null" label="基础属性" variant="plain">
            <template #note>{{ specNoteOf(r) }}</template>
            <dl class="specs">
              <div v-for="s in specsOf(r)" :key="s.label" class="spec">
                <dt class="spec-k">{{ s.label }}</dt>
                <span class="leader" aria-hidden="true" />
                <dd class="spec-v mono">{{ s.value }}</dd>
              </div>
            </dl>
          </CardBlock>

          <CardBlock v-if="r.effect_desc" label="音擎效果">
            <template #note>{{ r.effect_refine ? `精炼 ${r.effect_refine} 阶` : '' }}</template>
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

.card-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

/* ---------- 基础属性：点线规格表（KeyValueGrid ledger 的卡内紧凑版） ---------- */

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

/* 点线规格表：标签取 ink-1（卡片底色 --bg-2 上 ink-2 仅 4.40:1，12px 正文过不了 4.5:1） */
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
</style>
