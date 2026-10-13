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

/** 陈列顺序：默认编号倒序。**本页不提供排序控件**（2026-10 与音擎、代理人名录一同移除）；
 *  排序能力仍在——历史 ?sort=&dir= 深链照读。 */
const { sorted, isDefault: sortIsDefault } = useCatalogSort(
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
        驱动盘套装总览。2 件套与 4 件套效果直接陈列于卡片中；可按名称检索。
      </p>
    </header>

    <div v-reveal="90" class="toolbar">
      <SearchField v-model="query" :count="count" placeholder="检索套装…" />
      <!-- URL 带状态时显式给出复制入口：筛选/检索，或历史 ?sort=&dir= 深链 -->
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
</style>
