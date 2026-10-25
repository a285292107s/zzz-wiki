<script setup lang="ts">
import { nextTick, watch } from 'vue'
import { useUiText } from '@/composables/useUiText'
import { RouterLink } from 'vue-router'
import AsyncState from '@/components/state/AsyncState.vue'
import NavScrollButton from '@/components/NavScrollButton.vue'
import { useNavScrollable } from '@/composables/useNavScrollable'
import { recordRecentVisit } from '@/composables/useQuickSearch'
import type { AsyncStatus } from '@/composables/useAsyncResource'
import type { DetailSectionItem } from '@/composables/useDetailSections'
import type { CatalogEntry } from '@/domain/catalog'

const { t } = useUiText()

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
const { navEl, scrollRight, refresh, ensureActiveVisible } = useNavScrollable()
watch(
  () => props.nav,
  () => nextTick(refresh),
  { flush: 'post' },
)
/* 滚动高亮切换时把当前区块带进视野——只在**用户自己滚动页面**时发生，
   点条目跳转那条路浏览器已把它滚进来了（ensureActiveVisible 取 nearest，不动） */
watch(
  () => props.active,
  () => ensureActiveVisible(),
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
    <div class="page-inner">
      <!-- 页面动作行：返回导航。
           本行在 AsyncState **之外**，加载中/404 也会渲染——故任何依赖「档案已就绪」的动作
           都必须自带 status 门禁，不能无条件渲染。 -->
      <div class="page-actions" data-vt-block data-vt-fade>
        <RouterLink :to="backTo" class="back mono">← {{ backLabel ?? t.detail.back }}</RouterLink>
      </div>

      <!-- 区块导航：宽屏左侧档案索引 / 窄屏吸顶横条（样式见 base.css .section-nav）。
          ref 挂在 .sn-list（窄屏**真正滚动的那个元素**）上，不是外层 nav：
          宽屏下 nav 是 fixed 侧栏、不滚动，量它会得到「永远装得下」的假结论。 -->
      <nav
        v-if="nav?.length"
        class="section-nav"
        :aria-label="t.detail.sectionNav"
        data-vt-block
        data-vt-fade
      >
        <div ref="navEl" class="sn-list">
          <template v-for="n in nav" :key="n.id">
            <div v-if="n.children?.length" class="sn-group">
              <RouterLink
                class="sn-item mono"
                :class="{ active: active === n.id || n.children.some((c) => c.id === active) }"
                :aria-current="active === n.id || n.children.some((c) => c.id === active) ? 'location' : undefined"
                :to="{ hash: '#' + n.id }"
                :title="n.label"
              >
                <span class="no" aria-hidden="true">{{ n.no }}</span>
                <span>{{ n.label }}</span>
              </RouterLink>
              <ul class="sn-child-list">
                <li v-for="c in n.children" :key="c.id">
                  <RouterLink
                    class="sn-child mono"
                    :class="{ active: active === c.id }"
                    :aria-current="active === c.id ? 'location' : undefined"
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
              :aria-current="active === n.id ? 'location' : undefined"
              :to="{ hash: '#' + n.id }"
              :title="n.label"
            >
              <span class="no" aria-hidden="true">{{ n.no }}</span>
              <span>{{ n.label }}</span>
            </RouterLink>
          </template>
        </div>
        <NavScrollButton :label="t.detail.sectionNavHint" @click="scrollRight" />
      </nav>

      <AsyncState
        :status="status"
        :error="error"
        :retry="retry"
        :back-to="fallbackTo"
        :back-text="fallbackText"
        :state-as-heading="true"
      >
        <!-- 加载骨架：视图自己给（详情页封面形态各不同），没给就退回 AsyncState 的一行 LOADING…
             条件挂载是必要的：无条件传空插槽会让 AsyncState 认为"父级提供了骨架"，
             于是连那行文字也不渲染（其他详情页会变成全空加载态）。 -->
        <template v-if="$slots.skeleton" #skeleton>
          <slot name="skeleton" />
        </template>
        <slot />
      </AsyncState>
    </div>
  </div>
</template>

<style scoped>
.page {
  --page-content-max: 1120px;
  padding-top: calc(var(--pad-section) * 0.9);
  padding-inline: 0;
}

.page-inner {
  max-width: var(--page-content-max);
  margin-inline: auto;
  padding-inline: var(--pad-page);
}

/* 动作行只剩「返回」一项（分享入口已于决策记录 0009 下线）：不再需要两端对齐，
   故去掉 `justify-content` 与为分享按钮准备的 `margin-left:auto`。 */
.page-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-head);
  margin-bottom: clamp(16px, 2.2vw, 34px);
}

.page-actions .back {
  margin-bottom: 0;
}

.back {
  font-size: var(--fs-caption);
  color: var(--ink-2);
  letter-spacing: 0.12em;
  transition: color var(--t-fast) var(--ease);
  /* 触屏命中区（WCAG 2.5.8 下限 24px）：**用 min-height 锁死**而不是靠行高凑。
     靠 padding 凑时实际渲染高度会落在 23.99px（亚像素），reflow-spacing 的
     `< 24` 判定照样报越轨——下限就该钉死，不留给字体度量。 */
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 2px 0;
}

.back:hover {
  color: var(--amber-hi);
}

@media (min-width: 1000px) {
  .page {
    padding-top: var(--space-group);
  }

  .page-actions {
    display: none;
  }
}
</style>
