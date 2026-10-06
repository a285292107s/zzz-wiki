<script setup lang="ts">
import { nextTick, watch } from 'vue'
import { RouterLink } from 'vue-router'
import AsyncState from '@/components/state/AsyncState.vue'
import BackToTop from '@/components/BackToTop.vue'
import { useNavScrollable } from '@/composables/useNavScrollable'
import { recordRecentVisit } from '@/composables/useQuickSearch'
import type { AsyncStatus } from '@/composables/useAsyncResource'
import type { DetailSectionItem } from '@/composables/useDetailSections'
import type { CatalogEntry } from '@/domain/catalog'

const props = defineProps<{
  /** 返回名录链接 */
  backTo: string
  backLabel?: string
  /** 区块导航条目（detail 就绪后由视图传入，未就绪传空数组） */
  nav?: DetailSectionItem[]
  /** 当前滚动高亮区块 id（useDetailSections.activeSection） */
  active?: string | null
  status: AsyncStatus | string
  error?: string | null
  /** 重试回调（视图传 useAsyncResource 的 reload）——加载失败时的出路 */
  retry?: () => void
  /** 404 时回名录的目标（AsyncState back-to） */
  fallbackTo?: string
  fallbackText?: string
  /** 最近访问记录（可选）：类目条目 + 当前详情 id + 展示名 getter；detail 就绪即记录 */
  recent?: { entry: CatalogEntry; id: () => string; label: () => string } | null
}>()

/** 窄屏吸顶横条的「可横滑」提示与交互：条目随数据就绪（nav prop 变化）后重测 */
const { navEl, scrollRight, refresh } = useNavScrollable()
watch(
  () => props.nav,
  () => nextTick(refresh),
  { flush: 'post' },
)

/** detail 就绪（nav 条目出现）即记录最近访问：名录/检索/翻页各入口统一在此收口 */
watch(
  () => [props.recent, props.nav?.length, props.status] as const,
  ([recent]) => {
    if (!recent || props.status !== 'success') return
    const label = recent.label()
    if (label) recordRecentVisit(recent.entry.no, `${recent.entry.path}/${recent.id()}`, label)
  },
  { immediate: true, flush: 'post' },
)
</script>

<template>
  <div class="wrap page">
    <RouterLink :to="backTo" class="back mono">← {{ backLabel ?? '返回' }}</RouterLink>

    <!-- 区块导航：宽屏左侧档案索引 / 窄屏吸顶横条（样式见 base.css .section-nav） -->
    <nav v-if="nav?.length" ref="navEl" class="section-nav" aria-label="页面区块">
      <div class="sn-list">
        <template v-for="n in nav" :key="n.id">
          <div v-if="n.children?.length" class="sn-group">
            <RouterLink
              class="sn-item mono"
              :class="{ active: active === n.id || n.children.some((c) => c.id === active) }"
              :aria-current="active === n.id || n.children.some((c) => c.id === active) ? 'true' : undefined"
              :to="{ hash: '#' + n.id }"
              :title="n.label"
            >
              <span class="no">{{ n.no }}</span>
              <span>{{ n.label }}</span>
            </RouterLink>
            <ul class="sn-child-list">
              <li v-for="c in n.children" :key="c.id">
                <RouterLink
                  class="sn-child mono"
                  :class="{ active: active === c.id }"
                  :aria-current="active === c.id ? 'true' : undefined"
                  :to="{ hash: '#' + c.id }"
                >
                  <span>{{ c.label }}</span>
                </RouterLink>
              </li>
            </ul>
          </div>
          <RouterLink
            v-else
            class="sn-item mono"
            :class="{ active: active === n.id }"
            :aria-current="active === n.id ? 'true' : undefined"
            :to="{ hash: '#' + n.id }"
            :title="n.label"
          >
            <span class="no">{{ n.no }}</span>
            <span>{{ n.label }}</span>
          </RouterLink>
        </template>
      </div>
      <button class="sn-scroll-btn" aria-label="向右滚动" @click="scrollRight">→</button>
    </nav>

    <AsyncState
      :status="status"
      :error="error"
      :retry="retry"
      :back-to="fallbackTo"
      :back-text="fallbackText"
    >
      <slot />
    </AsyncState>

    <BackToTop />
  </div>
</template>

<style scoped>
.page {
  padding-top: calc(var(--pad-section) * 0.9);
}

.back {
  font-size: var(--fs-caption);
  color: var(--ink-2);
  letter-spacing: 0.12em;
  transition: color var(--t-fast) var(--ease);
  display: inline-block;
  /* 与页头的绑定的间距较区块间距收紧：返回链接语义上从属页头，不参与区块之间的呼吸 */
  margin-bottom: clamp(16px, 2.2vw, 34px);
  /* 触屏命中区：WCAG 2.5.8 min 24px（视觉行高 20px + 负 margin 抵消布局影响） */
  padding: 2px 0;
}

.back:hover {
  color: var(--amber-hi);
}
</style>