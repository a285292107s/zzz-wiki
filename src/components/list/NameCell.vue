<script setup lang="ts">
/**
 * 名录表名称列：缩略图 + 名称链接（三个表格名录页共用）。
 * 悬停变色挂在整条链接上（头像+名字），避免整行可点暗示。
 * 悬停/聚焦预热详情 chunk + JSON（useDetailPrefetch），详情页秒开。
 */
import { RouterLink } from 'vue-router'
import HollowImage from '@/components/HollowImage.vue'
import { prefetchDetail } from '@/composables/useDetailPrefetch'
import { catalogByPath } from '@/domain/catalog'

const props = defineProps<{
  to: string
  srcs: string[]
  alt: string
  fallback: string
  name: string
  /** 缩略图形态：banner 横幅头像（88×32，代理人）/ square 方形图标（40×40，音擎/邦布） */
  thumb?: 'banner' | 'square'
}>()

/** to = '/agents/1011'：按首段路径取 catalog 条目预热（未登记路径静默跳过） */
function warm(): void {
  const entry = catalogByPath(`/${props.to.split('/')[1]}`)
  if (entry) prefetchDetail(entry, props.to.split('/')[2] ?? '')
}
</script>

<template>
  <RouterLink :to="to" class="name-cell" @pointerenter="warm" @focus="warm">
    <span :class="['thumb', { banner: thumb === 'banner' }]">
      <HollowImage :srcs="srcs" :alt="alt" :fallback="fallback" fit="contain" />
    </span>
    <span class="name">{{ name }}</span>
  </RouterLink>
</template>

<style scoped>
.name-cell {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

/* 变色挂在整条链接上（头像+名字），与名录行只可点名称的语义一致 */
a.name-cell:hover .name {
  color: var(--amber-hi);
}

a.name-cell .name {
  font-size: var(--fs-body);
  letter-spacing: 0.02em;
  transition: color var(--t-fast) var(--ease);
}

.thumb {
  width: 40px;
  height: 40px; /* 方形图标（音擎 143² / 邦布 255²），contain 完整显示 */
  flex: none;
  display: block;
}

.thumb.banner {
  width: 88px;
  height: 32px; /* 横幅头像 180×64 ≈ 2.8:1，放大 2x，contain 完整显示 */
}

.thumb :deep(.frame) {
  border-radius: 2px;
}
</style>