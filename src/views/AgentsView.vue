<script setup lang="ts">
import { computed } from 'vue'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useCatalogList } from '@/composables/useCatalogList'
import { useCatalogSort } from '@/composables/useCatalogSort'
import { listFor } from '@/data/resources'
import { iconSources } from '@/data/icons'
import type { CharacterListItem } from '@/data/types'
import { pickName } from '@/utils/names'
import { usePageMeta } from '@/composables/usePageMeta'
import { catalogEntry } from '@/domain/catalog'
import { AsyncState, CatalogTable, CatalogTableSkeleton, FilterDropdown, ListPage, NameCell, SearchField, type CatalogColumn, CopyLinkButton } from '@/components'
import Tags from '@/components/Tags.vue'
import Rarity from '@/components/Rarity.vue'

usePageMeta()

/** 详情路由前缀与名录取数均由 catalog 派生（单一事实源，禁止手写第二份类目路径） */
const cat = catalogEntry('/agents')
const base = cat.path

const { data, status, error, reload } = useAsyncResource(() => listFor<CharacterListItem>(cat))

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

/** 列配置：**不声明 sortable**——表格版与本页卡片版一致，不提供排序控件
 *  （点表头排序需要读者先知道「表头能点」，且与卡片版的陈列语言不统一）。
 *  陈列顺序见下方 useCatalogSort 的默认值。 */
const columns: CatalogColumn[] = [
  { key: 'name', label: '代号' },
  { key: 'attr', label: '属性' },
  { key: 'prof', label: '职业' },
  { key: 'camp', label: '阵营', cls: 'camp mono' },
  { key: 'rarity', label: '稀有度', align: 'right' },
]

/** 陈列顺序：默认编号倒序（读一次，无控件可改）。键仍是 id/name/rarity，
 *  故旧链接里的 ?sort=&dir= 依旧照读——分享出去的排序视图不会因为这次改动变成另一份视图。 */
const { sorted, isDefault: sortIsDefault } = useCatalogSort(
  filtered,
  [
    { key: 'id', value: (r) => r.Id },
    { key: 'name', value: (r) => pickName(r) },
    { key: 'rarity', value: (r) => r.rank ?? -1 },
  ],
  { defaultKey: 'id', defaultDir: 'desc', syncRoute: true },
)
</script>

<template>
  <ListPage>
    <header v-reveal class="page-head">
      <p class="eyebrow mono">Agents</p>
      <h1 class="page-title">代理人</h1>
      <p class="page-sub">
        新艾利都登记在册的代理人名录。可按属性、职业、阵营筛选，或输入姓名检索。
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
        <!-- 筛选/搜索生效时 URL 带状态：显式给出「复制此视图链接」入口。
             紧随阵营筛选（三个下拉的末位）：它是「当前这套筛选」的导出动作，
             贴着筛选区就不必横跨工具栏去找。 -->
        <CopyLinkButton v-if="hasActiveFilter || !sortIsDefault" label="复制筛选链接" />
      </div>
      <SearchField v-model="query" :count="count" placeholder="检索姓名…" />
    </div>

    <!-- 空态分工：AsyncState 只管「数据级为空」（接口没给数据）；
         「筛掉全部结果」由 CatalogTable 的空态行承担（带清除出路的动作） -->
    <AsyncState
      :status="status"
      :error="error"
      :retry="reload"
      :empty="status === 'success' && !data?.length"
    >
      <template #skeleton>
        <CatalogTableSkeleton :cols="5" />
      </template>
      <CatalogTable
        v-reveal="160"
        :columns="columns"
        :items="sorted"
        caption="代理人名录：代号、属性、职业、阵营与稀有度"
        :show-clear="hasActiveFilter"
        empty-text="无匹配代理人"
        @clear="reset"
      >
        <template #cell-name="{ row }">
          <NameCell
            :to="`${base}/${row.Id}`"
            :srcs="iconSources({ Id: row.Id, icon: row.icon }, 'character')"
            :alt="pickName(row)"
            :fallback="pickName(row)"
            :name="pickName(row)"
            thumb="banner"
          />
        </template>
        <template #cell-attr="{ row }">
          <Tags :element="row.element" :element-label="row.special_element" />
        </template>
        <template #cell-prof="{ row }">
          <Tags :specialty="row.type" />
        </template>
        <template #cell-camp="{ row }">
          <span class="camp">
            {{ row.camp_name ?? `C${String(row.camp ?? '—').padStart(2, '0')}` }}
          </span>
        </template>
        <template #cell-rarity="{ row }">
          <Rarity :rank="row.rank" />
        </template>
      </CatalogTable>
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

/* 左组：筛选（属性/职业/阵营）与它的「复制筛选链接」出口贴在一起 */
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

/* ---------- 手机断点：工具栏两行，右缘与版心对齐 ----------
   实测 390 宽下筛选行宽 316.4、检索框 280，两条右缘各比版心短 34 / 70px；
   等宽铺满（flex:1）+ 检索通栏后，两条都与版心同宽，也与下方名录共用同一条右缘。
   窄到 320（版心 280）时三颗放不下会折行：折行后的行同样被撑满，
   右缘仍齐 —— 参差比「最后一颗独占一行」更显眼，故选后者。 */
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

  /* 触发钮变成通栏控件：标签贴左、插入符推到右缘（与下拉框的阅读方向一致） */
  .toolbar-left :deep(.filter-dropdown .caret) {
    margin-left: auto;
  }

  /* 选中值可能比列名长（如「罗斯凯利法·外务筹策局」）：省略号收尾，
     完整值仍可在展开后的选项里看到 */
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

/* 由 CatalogTable 列 cls 应用（子组件作用域，用 :deep 穿透） */
:deep(.camp) {
  color: var(--ink-2);
  font-size: var(--fs-caption);
  letter-spacing: 0.12em;
}
</style>