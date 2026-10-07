<script setup lang="ts" generic="T">
/**
 * 档案栅格（驱动盘 / 音擎两个名录共用）：栅格几何 + 卡壳 + 骨架 + 「无匹配」空态。
 *
 * 卡内内容由调用方经默认插槽决定（驱动盘陈列 2/4 件套文本，音擎陈列满级面板与
 * 音擎效果），本组件只保证两页的**卡壳几何**完全一致——1px gap 靠底色画出分隔线，
 * 无圆角、无投影，延续「档案标本」语言。
 */
import NoMatchState from './NoMatchState.vue'

withDefaults(
  defineProps<{
    items: readonly T[]
    /** 稳定行键（默认按下标；名录条目应传 Id） */
    keyOf?: (item: T, index: number) => string | number
    /** 加载态：渲染等量骨架卡（与真实卡同几何，避免骨架→内容的布局跳动） */
    skeleton?: boolean
    /** 骨架卡数量 */
    skeletonCount?: number
    /** 列宽下限：文案更长的类目（音擎）给更宽的列 */
    minColumn?: string
    /** 无匹配空态标题 */
    emptyText?: string
    /** 是否有可清除的检索/筛选条件（true 才给「清除」按钮） */
    showClear?: boolean
  }>(),
  {
    keyOf: (_item: T, index: number) => index,
    skeleton: false,
    skeletonCount: 6,
    minColumn: '280px',
    emptyText: '无匹配档案',
    showClear: false,
  },
)

const emit = defineEmits<{ (e: 'clear'): void }>()
</script>

<template>
  <div class="card-grid-wrap">
    <ul
      v-if="skeleton || items.length"
      class="card-grid"
      :style="{ '--card-min': minColumn }"
      :aria-busy="skeleton || undefined"
    >
      <template v-if="skeleton">
        <li v-for="i in skeletonCount" :key="i" class="card skel" aria-hidden="true">
          <span class="skel-head">
            <span class="bar skel-thumb" />
            <span class="bar skel-name" />
          </span>
          <span class="bar skel-line" />
          <span class="bar skel-line" />
          <span class="bar skel-line short" />
        </li>
      </template>

      <template v-else>
        <li v-for="(item, i) in items" :key="keyOf(item, i)" class="card">
          <slot :item="item" :index="i" />
        </li>
      </template>
    </ul>

    <!-- 空态分工：AsyncState 管「数据级为空」；「筛掉全部结果」由这里承担。
         栅格为空时不渲染 ul（它有边线，空 ul 会留下一条多余的细线） -->
    <div v-else class="grid-empty">
      <NoMatchState :title="emptyText" :show-clear="showClear" @clear="emit('clear')" />
    </div>
  </div>
</template>

<style scoped>
.card-grid {
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--card-min), 1fr));
  gap: 1px;
  background: var(--line-1);
  border: var(--rule);
}

.card {
  background: var(--bg-2);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: var(--space-inline);
  min-width: 0;
}

/* ---------- 骨架（加载态） ---------- */

.skel {
  gap: 14px;
}

.skel-head {
  display: flex;
  align-items: center;
  gap: var(--space-inline);
}

.bar {
  display: block;
  height: 12px;
  background: linear-gradient(90deg, var(--bg-1) 0%, var(--bg-3) 50%, var(--bg-1) 100%);
  background-size: 200% 100%;
  animation: skel-pulse var(--t-skel) ease-in-out infinite;
}

.skel-thumb {
  width: 40px;
  height: 40px;
  flex: none;
}

.skel-name {
  width: 50%;
  height: 16px;
}

.skel-line {
  width: 100%;
  margin-top: 10px;
}

.skel-line.short {
  width: 62%;
}

@media (prefers-reduced-motion: reduce) {
  .bar {
    animation: none;
    background: var(--bg-1);
  }
}

/* ---------- 空态 ---------- */

.grid-empty {
  padding: 46px 16px 50px;
  border: 1px solid var(--line-0);
  border-radius: 2px;
}
</style>
