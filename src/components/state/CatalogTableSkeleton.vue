<script setup lang="ts">
/** 表格加载骨架：灰底细线占位，贴合 hairline-table 档案风（Q3c）。 */
withDefaults(
  defineProps<{
    /** 列数 */
    cols?: number
    /** 占位行数 */
    rows?: number
    /** 前导序号列（v-if withIndex） */
    withIndex?: boolean
  }>(),
  { cols: 5, rows: 6, withIndex: false },
)
</script>

<template>
  <table class="hairline-table skel" aria-hidden="true">
    <thead>
      <tr>
        <th v-if="withIndex" />
        <th v-for="c in cols" :key="c">
          <span class="bar head-bar" />
        </th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="r in rows" :key="r">
        <td v-if="withIndex" class="mono idx">
          <span class="bar idx-bar" />
        </td>
        <td v-for="c in cols" :key="c">
          <span class="bar cell-bar" :class="{ wide: c === 1 }" />
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.skel .bar {
  display: inline-block;
  height: 12px;
  border-radius: 0;
  background: linear-gradient(
    90deg,
    var(--bg-2) 0%,
    var(--bg-3) 50%,
    var(--bg-2) 100%
  );
  background-size: 200% 100%;
  animation: pulse 1.4s ease-in-out infinite;
}

.head-bar {
  width: 56px;
  height: 10px;
}

.idx-bar {
  width: 22px;
}

.cell-bar {
  width: 44%;
}

.cell-bar.wide {
  width: 60%;
}

@keyframes pulse {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skel .bar {
    animation: none;
    background: var(--bg-2);
  }
}
</style>
