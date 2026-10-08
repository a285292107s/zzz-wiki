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
    <tbody>
      <tr v-for="r in rows" :key="r">
        <td v-for="c in cols" :key="c">
          <span class="bar cell-bar" :class="{ wide: c === 1 }" />
        </td>
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

/* 移动端：与 CatalogTable 堆叠行同构 —— 只保留序号 + 首列条块，其余列隐藏 */
@media (max-width: 720px) {
  .skel thead {
    display: none;
  }
  .skel tbody tr td:nth-child(n + 3) {
    display: none;
  }
  .skel tbody tr {
    padding: 12px 4px;
  }
}
</style>
