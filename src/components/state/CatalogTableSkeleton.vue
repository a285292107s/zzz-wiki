<script setup lang="ts">
/** 表格加载骨架：灰底细线占位，贴合 hairline-table 档案风（Q3c）。 */
withDefaults(
  defineProps<{
    /** 列数 */
    cols?: number
    /** 占位行数 */
    rows?: number
  }>(),
  { cols: 5, rows: 6 },
)
</script>

<template>
  <table class="hairline-table skel" aria-hidden="true">
    <thead>
      <tr>
        <th v-for="c in cols" :key="c">
          <span class="bar head-bar" />
        </th>
      </tr>
    </thead>
    <tbody class="skel-d">
      <tr v-for="r in rows" :key="r">
        <td v-for="c in cols" :key="c">
          <span class="bar cell-bar" :class="{ wide: c === 1 }" />
        </td>
      </tr>
    </tbody>
    <!-- 移动端骨架：与 CatalogTable 的堆叠条目**同构**（缩略图 · 名称 · 稀有度 / 元信息行）——
         骨架的形状就是数据的形状，到达时是「填进去」而不是「换一页」
         （与详情页 DetailSkeleton 同一诉求，故此处单列一份窄屏形状） -->
    <tbody class="skel-m">
      <tr v-for="r in rows" :key="r">
        <td class="s-thumb"><span class="bar" /></td>
        <td class="s-name"><span class="bar" /></td>
        <td class="s-rar"><span class="bar" /></td>
        <td class="s-meta"><span class="bar" /></td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
/* 占位条的底色与扫光收在 base.css 的 `.skel .bar`（单一来源，多个骨架共用）；
   这里只管表格骨架自己的**形状**。 */
.head-bar {
  width: 56px;
  height: 10px;
}

.cell-bar {
  width: 44%;
}

.cell-bar.wide {
  width: 60%;
}

.skel-m {
  display: none;
}

/* 移动端：只留窄屏形状，条块尺寸与 CatalogTable 的堆叠条目逐一对应 */
@media (max-width: 720px) {
  .skel-d,
  .skel thead {
    display: none;
  }

  .skel-m {
    display: block;
  }

  /* 同 CatalogTable：一条一行，两行格子 + 条目收口线 */
  .skel-m tr {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    column-gap: var(--space-inline);
    row-gap: 7px;
    padding: 12px 0;
    border-bottom: var(--rule);
  }

  .skel-m td {
    display: block;
    padding: 0;
    border: none;
  }

  .skel-m .s-thumb .bar {
    width: 88px;
    height: 32px;
  }

  .skel-m .s-name .bar {
    width: 58%;
    height: 14px;
  }

  .skel-m .s-rar .bar {
    width: 24px;
    height: 24px;
  }

  .skel-m .s-meta {
    grid-column: 1 / -1;
  }

  .skel-m .s-meta .bar {
    width: 62%;
    height: 12px;
  }
}
</style>
