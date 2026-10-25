<script setup lang="ts">
/* 陈列形态决策（架构评审 2026-09）：驱动盘刻意保留卡片栅格、不并入 CatalogTable——
 * 2/4 件套效果是长文本（stripRichText 后仍数行），表格行的信息密度不适配。
 * 与音擎名录同构：卡壳/骨架/空态由 CardGrid + CardBlock 收起（两页共用），
 * 本页只声明「一张卡片陈列什么」；筛选/取数与陈列顺序经 useCatalogList/useCatalogSort/resources 收敛
 * （**本页不提供排序控件**，陈列顺序取 useCatalogSort 的默认编号倒序）。 */
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useCatalogList } from '@/composables/useCatalogList'
import { useCatalogSort } from '@/composables/useCatalogSort'
import { listFor } from '@/data/resources'
import { iconSources } from '@/data/icons'
import { stripRichText } from '@/utils/text'
import { pickLocaleInfo } from '@/utils/names'
import { pickText } from '@/domain/lang'
import { useLocale } from '@/composables/useLocale'
import { useUiText } from '@/composables/useUiText'
import type { DiskDriveListItem, LocaleInfo } from '@/data/types'
import { usePageMeta } from '@/composables/usePageMeta'
import { catalogEntry } from '@/domain/catalog'
import { AsyncState, CardBlock, CardGrid, ListPage, NameCell, SearchField } from '@/components'

usePageMeta()

/** 详情路由前缀与名录取数均由 catalog 派生（单一事实源） */
const cat = catalogEntry('/disks')
const base = cat.path

/** 当前展示语言（名录按语言落盘，语言一变下面的取数会重新拉） */
const { lang } = useLocale()
const { t } = useUiText()

/** 驱动盘名录的 zh/en/ja/ko 是 `{ name, desc2, desc4 }` 子对象（不是名字字符串），
 *  故按当前语言取子对象、再取字段；缺该语言时由 pickLocaleInfo 回退到其他语言。 */
const infoOf = (d: DiskDriveListItem): LocaleInfo | null => pickLocaleInfo<LocaleInfo>(d, lang.value)

const { data, status, error, reload } = useAsyncResource(() =>
  listFor<DiskDriveListItem>(cat, lang.value),
)

const { query, filtered, count, hasActiveFilter, reset } = useCatalogList<DiskDriveListItem>({
  items: () => data.value ?? [],
  name: (d) => infoOf(d)?.name ?? '',
  syncRoute: true,
  keywords: (d) => [infoOf(d)?.desc2 ?? '', infoOf(d)?.desc4 ?? ''],
})

/** 陈列顺序：默认编号倒序。**本页不提供排序控件**（2026-10 与音擎、代理人名录一同移除）；
 *  排序能力仍在——历史 ?sort=&dir= 深链照读。 */
const { sorted } = useCatalogSort(
  filtered,
  [
    { key: 'id', value: (d) => d.Id },
    { key: 'name', value: (d) => infoOf(d)?.name ?? '' },
  ],
  { defaultKey: 'id', defaultDir: 'desc', syncRoute: true },
)
</script>

<template>
  <ListPage>
    <header v-reveal class="page-head">
      <p class="eyebrow mono">Disk Drives</p>
      <h1 class="page-title">{{ pickText(cat.label, lang) }}</h1>
      <p class="page-sub">
        {{ t.list.disksIntro }}
      </p>
    </header>

    <div v-reveal="90" class="toolbar">
      <SearchField v-model="query" :count="count" :placeholder="t.list.searchDisk" />
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
        class="disk-grid"
        :items="sorted"
        :key-of="(d) => d.Id"
        :empty-text="t.noMatch.disks"
        :show-clear="hasActiveFilter"
        @clear="reset"
      >
        <template #default="{ item: d }">
          <NameCell
            :to="`${base}/${d.Id}`"
            :srcs="iconSources({ Id: d.Id, icon: d.icon }, 'disc')"
            alt=""
            :fallback="infoOf(d)?.name ?? '—'"
            :name="infoOf(d)?.name ?? '—'"
            thumb="square"
            name-style="card"
          />

          <CardBlock :label="t.detail.set2">
            <p>{{ stripRichText(infoOf(d)?.desc2) }}</p>
          </CardBlock>
          <CardBlock :label="t.detail.set4">
            <p>{{ stripRichText(infoOf(d)?.desc4) }}</p>
          </CardBlock>
        </template>
      </CardGrid>
    </AsyncState>
  </ListPage>
</template>

<style scoped>
.toolbar {
  /* 单控件（搜索框）行：不再需要两端对齐——`space-between` 在单子项下本就是空操作，
     去掉（渲染位置不变：单子项本就在行首）。 */
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-inline);
  margin-bottom: 20px;
}

.disk-grid :deep(.card) {
  position: relative;
}

.disk-grid :deep(.name-cell)::after {
  content: '';
  position: absolute;
  inset: 0;
}
</style>
