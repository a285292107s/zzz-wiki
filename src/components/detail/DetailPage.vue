<script setup lang="ts">
import { RouterLink } from 'vue-router'
import AsyncState from '@/components/state/AsyncState.vue'
import BackToTop from '@/components/BackToTop.vue'
import type { AsyncStatus } from '@/composables/useAsyncResource'
import type { DetailSectionItem } from '@/composables/useDetailSections'

defineProps<{
  /** 返回名录链接 */
  backTo: string
  backLabel?: string
  /** 区块导航条目（detail 就绪后由视图传入，未就绪传空数组） */
  nav?: DetailSectionItem[]
  /** 当前滚动高亮区块 id（useDetailSections.activeSection） */
  active?: string | null
  status: AsyncStatus | string
  error?: string | null
  /** 404 时回名录的目标（AsyncState back-to） */
  fallbackTo?: string
  fallbackText?: string
}>()
</script>

<template>
  <div class="wrap page">
    <RouterLink :to="backTo" class="back mono">← {{ backLabel ?? '返回' }}</RouterLink>

    <!-- 区块导航：宽屏左侧档案索引 / 窄屏吸顶横条（样式见 base.css .section-nav） -->
    <nav v-if="nav?.length" class="section-nav" aria-label="页面区块">
      <div class="sn-list">
        <template v-for="n in nav" :key="n.id">
          <div v-if="n.children?.length" class="sn-group">
            <RouterLink
              class="sn-item mono"
              :class="{ active: active === n.id || n.children.some((c) => c.id === active) }"
              :aria-current="active === n.id || n.children.some((c) => c.id === active) ? 'true' : undefined"
              :to="{ hash: '#' + n.id }"
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
          >
            <span class="no">{{ n.no }}</span>
            <span>{{ n.label }}</span>
          </RouterLink>
        </template>
      </div>
    </nav>

    <AsyncState :status="status" :error="error" :back-to="fallbackTo" :back-text="fallbackText">
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
  margin-bottom: calc(var(--pad-section) * 0.6);
}

.back:hover {
  color: var(--amber-hi);
}
</style>