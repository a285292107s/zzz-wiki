<script setup lang="ts" generic="T extends Record<string, unknown>">
import { computed } from 'vue'
import type { SortDir } from '@/composables/useCatalogSort'
import NoMatchState from './NoMatchState.vue'

export interface CatalogColumn {
  /** 列键：无对应插槽时直接渲染 row[key] */
  key: string
  label: string
  /** CSS 类（如等宽/右对齐） */
  cls?: string
  align?: 'left' | 'right'
  /** 可排序：值即排序键（与 useCatalogSort 的 key 对齐）；缺省不可排序 */
  sortable?: boolean
}

const props = defineProps<{
  columns: CatalogColumn[]
  items: T[]
  /** 当前排序键（useCatalogSort.sortKey） */
  sort?: string | null
  /** 当前排序方向 */
  sortDir?: SortDir | null
  /** 表格 caption（读屏语境，如「代理人名录，按档案编号排序」）；缺省无 caption */
  caption?: string
  /** 无匹配时的空态标题（默认「无匹配档案」） */
  emptyText?: string
  /** 是否有可清除的检索/筛选条件（true 才显示「清除」按钮） */
  showClear?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:sort', key: string): void
  /** 空态「清除检索与筛选」（视图侧负责重置 query/筛选） */
  (e: 'clear'): void
}>()

const bodyColumns = computed(() => props.columns.filter((c) => c.key !== 'idx'))
/** 空态标题：未显式传入时用默认文案 */
const emptyText = computed(() => props.emptyText ?? '无匹配档案')

/* ---------- 移动端堆叠行（<721px）：主体列 + 尾列(右对齐列优先) + 其余列 meta 行 ---------- */

/** 主体列 = 首个非 idx 列（各名录页均为名称列，作主显示格） */
const mainColumn = computed(() => bodyColumns.value[0] ?? null)

/** 右格列：存在右对齐列（稀有度）时取它，否则取末列 */
const rightColumn = computed(() =>
  bodyColumns.value.find((c) => c.align === 'right') ??
  (bodyColumns.value.length > 1 ? bodyColumns.value[bodyColumns.value.length - 1] : null),
)

/** meta 行列：主体列与右格列之外的中间列（属性/职业/阵营/代号等） */
const metaColumns = computed(() =>
  bodyColumns.value.filter((c) => c !== mainColumn.value && c !== rightColumn.value),
)

function onHeadClick(c: CatalogColumn) {
  if (c.sortable) emit('update:sort', c.key)
}
</script>

<template>
  <table class="hairline-table">
    <caption v-if="caption" class="sr-only">{{ caption }}</caption>
    <thead>
      <tr>
        <th
          v-for="c in bodyColumns"
          :key="c.key"
          scope="col"
          :class="[{ r: c.align === 'right' }, { sortable: c.sortable }]"
          :aria-sort="c.sortable && sort === c.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined"
        >
          <button
            v-if="c.sortable"
            type="button"
            class="sort-btn mono"
            :class="{ active: sort === c.key }"
            @click="onHeadClick(c)"
          >
            {{ c.label }}
            <span v-if="sort === c.key" class="sort-arrow" aria-hidden="true">
              {{ sortDir === 'asc' ? '▲' : '▼' }}
            </span>
          </button>
          <template v-else>{{ c.label }}</template>
        </th>
      </tr>
    </thead>
    <tbody class="d-body">
      <!-- 空态（检索/筛选无匹配）：此前只留一张空表，用户既不知道「没有匹配」，
           也没有出路。文案 + 清除动作同格呈现；列数跨满保持表结构合法。 -->
      <tr v-if="!items.length" class="empty-row">
        <td :colspan="bodyColumns.length" class="empty-cell">
          <NoMatchState :title="emptyText" :show-clear="showClear" @clear="emit('clear')" />
        </td>
      </tr>
      <tr v-for="(row, i) in items" :key="String(row.Id ?? i)">
        <td
          v-for="c in bodyColumns"
          :key="c.key"
          :class="[c.cls, { r: c.align === 'right' }]"
        >
          <slot :name="`cell-${c.key}`" :row="row" :index="i">
            {{ String(row[c.key] ?? '—') }}
          </slot>
        </td>
      </tr>
    </tbody>

    <!-- 移动端堆叠条目：**一条 = 一行**（主体格 + 右格），其余列作为元信息行跨满两格。
         一行一条（而不是名称一行、元信息另起一行的两行结构）是为了让收口线有唯一归属：
         线画在条目上，条目边界就是线；两行结构下线只能画在其中一行上，等于把同一条目
         切成两半（详见本文件样式区注释）。
         与桌面 tbody 共享同一批 cell-* 插槽（同一 slot 两处引用，CSS 断点互斥显示） -->
    <tbody class="m-body">
      <!-- 移动端空态：与桌面同文案（两套 tbody 断点互斥显示，须各放一份） -->
      <tr v-if="!items.length" class="empty-row">
        <td class="empty-cell">
          <NoMatchState :title="emptyText" :show-clear="showClear" @clear="emit('clear')" />
        </td>
      </tr>
      <tr v-for="(row, i) in items" :key="String(row.Id ?? i)" class="m-row">
        <td v-if="mainColumn" class="m-main">
          <slot :name="`cell-${mainColumn.key}`" :row="row" :index="i">
            {{ String(row[mainColumn.key] ?? '—') }}
          </slot>
        </td>
        <td v-if="rightColumn" class="m-right">
          <!-- 右格可排序时整格为排序钮（稀有度等）。可访问名从内容派生（勿用 aria-label：
               视觉文本含稀有度字母与箭头，aria-label 会与之不一致而触发
               label-content-name-mismatch）；操作说明用 sr-only 文本补足，
               箭头字形改由 CSS 生成内容提供（不进文本，读屏与 axe 均不计入） -->
          <button
            v-if="rightColumn.sortable"
            type="button"
            class="m-sort"
            :class="{ active: sort === rightColumn.key, desc: sort === rightColumn.key && sortDir === 'desc' }"
            :aria-pressed="sort === rightColumn.key"
            @click="onHeadClick(rightColumn)"
          >
            <slot :name="`cell-${rightColumn.key}`" :row="row" :index="i">
              {{ String(row[rightColumn.key] ?? '—') }}
            </slot>
            <span class="sr-only">
              ，按{{ rightColumn.label }}排序{{
                sort === rightColumn.key ? (sortDir === 'asc' ? '，当前升序' : '，当前降序') : ''
              }}
            </span>
          </button>
          <slot v-else :name="`cell-${rightColumn.key}`" :row="row" :index="i">
            {{ String(row[rightColumn.key] ?? '—') }}
          </slot>
        </td>
        <!-- 元信息格：跨满两格（属性/职业/阵营等），左缘与缩略图同轴 -->
        <td v-if="metaColumns.length" class="m-meta">
          <span v-for="c in metaColumns" :key="c.key" class="m-cell" :class="c.cls">
            <slot :name="`cell-${c.key}`" :row="row" :index="i">
              {{ String(row[c.key] ?? '—') }}
            </slot>
          </span>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.r {
  text-align: right;
}
.sort-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
  color: inherit;
  cursor: pointer;
  transition: color var(--t-fast) var(--ease);
  padding: 0;
  background: none;
  border: none;
}
@media (hover: hover) {
  .sort-btn:hover {
    color: var(--ink-0);
  }
}
.sort-btn.active {
  color: var(--amber-hi);
}
.sort-btn:focus-visible {
  outline: 1px solid var(--focus);
  outline-offset: 2px;
}
.sort-arrow {
  font-size: var(--fs-nano);
}
th.sortable {
  white-space: nowrap;
}

/* ---------- 移动端（<721px）：表格退化为「档案条目」 ----------
   一条 = 两行：① 缩略图 · 名称 ······ 稀有度　② 属性 / 职业 / 阵营；
   收口线画在**条目末尾**，一条一格。

   2026-10 在 390 宽实测到三处「单看任一元素都合规」的构图缺陷：
   · 线画在①与②之间：同一条目的元信息被线切给了下一位代理人，条目之间反而没有分隔
     —— 分组读反（.m-row 有 border-bottom、元信息行没有）；
   · 左缘有三条：缩略图 38 / 属性标签 24 / 名称 138。缩略图比标签多缩进 14px，
     来源是 .hairline-table td 的桌面内距（--space-2）在堆叠布局里没撤销
     （缩略图那格照吃 14px，元信息那格已被覆盖为 4px，两条左缘于是错开）；
   · 名称右缘 184 到稀有度 297 之间空 113px（430 宽 153px、540 宽 260px）：
     两块各自贴边、中间是无主空洞，一行读不成一句话。

   故：① 一条并作一行（线才有唯一归属）；② 单元格内距归零，左缘收成一条轴；
   ③ 名称与分级之间用账册的引导点线连起来（与 KeyValueGrid / WEnginesView 同一语法）。
   桌面列全保留，仅换排布；不引入卡片/投影，延续细线行语言。 */
.m-body {
  display: none;
}

@media (max-width: 720px) {
  .d-body,
  thead {
    display: none;
  }

  .m-body {
    display: block;
  }

  /* 条目：一行两格（主体 | 稀有度），元信息格通栏跨两格 */
  .m-row {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    column-gap: var(--space-inline);
    row-gap: 7px;
    padding: 12px 0;
    border-bottom: var(--rule);
  }

  /* 格不再是「表格格」：撤掉桌面内距（--space-2 = 14px）与它自己的下边线 ——
     内距归零才有统一左轴，下边线归零才只剩条目末尾那一条线 */
  .m-row > td {
    padding: 0;
    border: none;
  }

  /* 缩略图与名称同格，用 flex 而非行内：行内盒按基线落位，会在 32px 的缩略图下
     多漏出 ~7.8px 下沉空间（实测 .m-main 被撑到 67.8px 高，缩略图并不居中） */
  .m-main {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  /* 引导点线：把名称与它右侧的分级连成一条账册行。
     纯装饰（无文本节点），读屏与 axe 都不计；点线墨色与 KeyValueGrid 同一份取值。
     不做纵向补偿：这一行是 align-items:center，点线落在条目中线，
     正好是中文名字的光学中心、也是稀有度方框的中线（KeyValueGrid 那条是基线对齐，
     才需要 translateY 补偿，两处场景不同故不共用偏移）。 */
  .m-main::after {
    content: '';
    flex: 1;
    min-width: 16px;
    border-bottom: 1px dotted color-mix(in srgb, var(--ink-2) 72%, transparent);
  }

  .m-right {
    display: flex;
    justify-content: flex-end;
  }

  /* 触屏命中区：24px 方框 + 上下各 2px 内距 = 28px 高（WCAG 2.5.8 下限 24） */
  .m-sort {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 2px 0;
    border: none;
    background: none;
    font: inherit;
    color: inherit;
    cursor: pointer;
    transition: opacity var(--t-fast) var(--ease);
  }

  .m-sort:focus-visible {
    outline: 1px solid var(--focus);
    outline-offset: 2px;
  }

  /* 排序提示字形由 CSS 生成内容提供：不进文本节点（读屏不念、axe 不计入可见文本），
     保持「可访问名 = 可见文本」的一致关系 */
  .m-sort::after {
    content: '↕';
    font-size: var(--fs-nano);
    color: var(--ink-2);
  }

  .m-sort.active::after {
    content: '▲';
    color: var(--amber);
  }

  .m-sort.active.desc::after {
    content: '▼';
  }

  /* 元信息行：通栏（跨两格），左缘与缩略图齐、与条目的收口线同宽 */
  .m-meta {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px var(--space-head);
  }

  .m-cell {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }

  /* 空态行不是条目：不进 grid，也不带收口线 */
  .empty-row {
    display: block;
  }
}

/* ---------- 空态（检索/筛选无匹配）----------
   内容与文案在 NoMatchState（名录页共用）；此处只给表格语境的留白框 */

.empty-cell {
  padding: 46px 16px 50px;
}
</style>
