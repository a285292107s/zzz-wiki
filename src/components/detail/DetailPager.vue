<script setup lang="ts">
/**
 * DetailPager — 详情页底部「上一档 / 下一档」翻页条（四个详情视图共用）。
 * 档案语言：单条 hairline 上边线分左右两格；等宽编号 + 中文名 + 方向箭头；
 * 无投影无卡片堆叠。空位（无上一档/下一档）渲染哑端占位，保持两格对齐。
 * 悬停即预热目标详情（useDetailPrefetch）——翻页回路与名录→详情同速。
 */
import { RouterLink } from 'vue-router'
import { prefetchDetail } from '@/composables/useDetailPrefetch'
import type { CatalogEntry } from '@/domain/catalog'

export interface DetailPagerItem {
  /** 目标详情路径（'/{base}/{id}'） */
  to: string
  /** 档案编号（名录 id 排序位的展示编号，如 '014'） */
  no: string
  /** 展示名 */
  label: string
}

const props = defineProps<{
  prev?: DetailPagerItem | null
  next?: DetailPagerItem | null
  /** 所属类目（预热用） */
  entry: CatalogEntry
}>()

function warm(it: DetailPagerItem): void {
  const id = it.to.split('/')[2]
  if (id) prefetchDetail(props.entry, id)
}
</script>

<template>
  <nav v-if="prev || next" class="detail-pager" aria-label="相邻条目">
    <RouterLink v-if="prev" :to="prev.to" class="pg" rel="prev" @pointerenter="warm(prev)" @focus="warm(prev)">
      <span class="pg-dir mono">← PREV</span>
      <span class="pg-name">{{ prev.label }}</span>
      <span class="pg-no mono">{{ prev.no }}</span>
    </RouterLink>
    <span v-else class="pg pg-empty" aria-hidden="true">
      <span class="pg-dir mono">← PREV</span>
    </span>

    <RouterLink v-if="next" :to="next.to" class="pg pg-next" rel="next" @pointerenter="warm(next)" @focus="warm(next)">
      <span class="pg-dir mono">NEXT →</span>
      <span class="pg-name">{{ next.label }}</span>
      <span class="pg-no mono">{{ next.no }}</span>
    </RouterLink>
    <span v-else class="pg pg-empty" aria-hidden="true">
      <span class="pg-dir mono">NEXT →</span>
    </span>
  </nav>
</template>

<style scoped>
.detail-pager {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-top: var(--rule);
  margin-top: var(--space-section);
  padding-top: 22px;
}

.pg {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 4px 2px;
  text-decoration: none;
  color: inherit;
  min-width: 0;
}

.pg-next {
  text-align: right;
  align-items: flex-end;
}

.pg-empty {
  visibility: hidden;
}

.pg-dir {
  font-size: var(--fs-nano);
  letter-spacing: 0.2em;
  color: var(--ink-3);
  transition: color var(--t-fast) var(--ease);
}

.pg-name {
  font-family: var(--serif);
  font-size: var(--fs-subhead);
  line-height: 1.2;
  color: var(--ink-1);
  transition: color var(--t-fast) var(--ease);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pg-no {
  font-size: var(--fs-nano);
  letter-spacing: 0.16em;
  color: var(--ink-3);
  transition: color var(--t-fast) var(--ease);
}

.pg:hover .pg-name {
  color: var(--amber-hi);
}

.pg:hover .pg-dir {
  color: var(--amber);
}

.pg:hover .pg-no {
  color: var(--ink-2);
}

/* 减动效之外再加键盘焦点内态：与 hover 同层回应 */
.pg:focus-visible .pg-name {
  color: var(--amber-hi);
}

@media (prefers-reduced-motion: reduce) {
  .pg .pg-dir,
  .pg .pg-name,
  .pg .pg-no {
    transition: none;
  }
}
</style>
