<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import AsyncState from '@/components/state/AsyncState.vue'
import BackToTop from '@/components/BackToTop.vue'
import CompareToggle from '@/components/CompareToggle.vue'
import { useNavScrollable } from '@/composables/useNavScrollable'
import { recordRecentVisit } from '@/composables/useQuickSearch'
import { dataVersions } from '@/data/api'
import type { AsyncStatus } from '@/composables/useAsyncResource'
import type { DetailSectionItem } from '@/composables/useDetailSections'
import type { CatalogEntry } from '@/domain/catalog'

/** 逐条出处用的数据版本（manifest 已由 api 层缓存，进入详情页基本零网络） */
const version = ref('')
const updatedAt = ref('')
onMounted(() => {
  void dataVersions()
    .then((v) => {
      version.value = v.live
      const t = v.generated ? new Date(v.generated) : null
      if (t && !Number.isNaN(t.getTime()))
        updatedAt.value = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
    })
    .catch(() => {
      /* 取不到版本时不渲染出处行（不留空行） */
    })
})

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
    <div class="page-actions">
      <RouterLink :to="backTo" class="back mono">← {{ backLabel ?? '返回' }}</RouterLink>
      <!-- 对照台入口：就地加入，不必先跳去对照页找条目（类目/编号由当前路由推出） -->
      <CompareToggle />
    </div>

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
              <span class="no" aria-hidden="true">{{ n.no }}</span>
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
            <span class="no" aria-hidden="true">{{ n.no }}</span>
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
      <!-- 逐条出处：本条数据属于哪一版快照。版本取自 manifest（api 层已缓存，零额外请求）。
           **必须渲染在内容插槽内**：放在插槽外时，加载骨架态（页面仅 ~720px 高）就会先渲染
           这一行，内容到达后页面长到 8000+px，该行被推下 ~7600px——冷缓存实测 CLS 尖峰
           0.04–0.17（帧级定位：源节点 p.prov 由 t341 变为 t0）。放进插槽后它只随内容出现，
           且位于内容最末，下方无内容可推。 -->
      <p class="prov mono">
        数据版本 <span class="prov-v">{{ version ? `LIVE ${version}` : '···' }}</span>
        <span v-if="updatedAt"> · 快照 {{ updatedAt }}</span>
        <span v-else> · 快照 ···</span>
        <span class="prov-src"> · 来源 hakushin raw，构建期落地</span>
      </p>
    </AsyncState>

    <BackToTop />
  </div>
</template>

<style scoped>
.page {
  padding-top: calc(var(--pad-section) * 0.9);
}

/* 返回 + 对照台入口：同一行、同一基线；间距收在页头范围内（区块间呼吸不参与） */
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

/* 逐条出处：页脚式的细字，不抢内容，但让每条档案可追溯到具体快照 */
.prov {
  margin-top: var(--space-section);
  padding-top: 14px;
  border-top: 1px solid var(--line-0);
  font-size: var(--fs-nano);
  letter-spacing: 0.1em;
  color: var(--ink-2);
}

.prov-v {
  color: var(--amber);
}

.prov-src {
  color: var(--ink-2);
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