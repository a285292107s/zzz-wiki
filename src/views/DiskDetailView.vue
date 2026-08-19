<script setup lang="ts">
import { computed, nextTick, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { api } from '@/data/api'
import { iconSources } from '@/data/icons'
import { richDesc } from '@/utils/rich'
import { stripRichText } from '@/utils/text'
import { useRouteParam } from '@/composables/useRouteParam'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useDetailNavigation } from '@/composables/useDetailNavigation'
import { usePageMeta } from '@/composables/usePageMeta'
import type { DiskDriveDetail } from '@/data/types'
import { AsyncState, DetailHead, DetailSection } from '@/components'
import BackToTop from '@/components/BackToTop.vue'

const id = useRouteParam('id')
const { data: detail, status, error } = useAsyncResource(() => api.detail<DiskDriveDetail>('equipment', id.value))

usePageMeta(() => detail.value?.name ?? undefined)

const portraitSrcs = computed(() =>
  iconSources({ Id: id.value, icon: detail.value?.icon }, 'portrait', 'disc'),
)

/* ---------- 区块导航 + scrollspy + reveal ---------- */

const navItems = computed(() => [
  { id: 'set2', no: '01', label: '2 件套' },
  { id: 'set4', no: '02', label: '4 件套' },
])

const { activeSection, revealDir, activate } = useDetailNavigation()
const vReveal = revealDir
const noOf = (id: string) => navItems.value.find((n) => n.id === id)?.no

/** 404 时返回驱动盘总览 */
const backTo = computed(() => (detail.value ? undefined : '/disks'))

watch(status, (s) => {
  if (s !== 'success') return
  nextTick(() => activate(navItems.value.map((n) => n.id)))
})
</script>

<template>
  <div class="wrap page">
    <RouterLink to="/disks" class="back mono">← 返回驱动盘总览</RouterLink>

    <nav v-if="detail" class="section-nav" aria-label="页面区块">
      <RouterLink
        v-for="n in navItems"
        :key="n.id"
        class="sn-item mono"
        :class="{ active: activeSection === n.id }"
        :to="{ hash: '#' + n.id }"
      >{{ n.no }} {{ n.label }}</RouterLink>
    </nav>

    <AsyncState :status="status" :error="error" :back-to="backTo">
      <template v-if="detail">
        <DetailHead
          :eyebrow="`Disk Drive · ${String(id).padStart(5, '0')}`"
          :title="detail.name ?? '—'"
          :portrait-srcs="portraitSrcs"
          :alt="detail.name ?? ''"
          :fallback="detail.name ?? '—'"
          position="top"
          ratio="1 / 1"
        >
          <template #sub>
            <p v-if="detail.story" class="story">{{ stripRichText(detail.story) }}</p>
          </template>
        </DetailHead>

        <DetailSection id="set2" :no="noOf('set2') ?? '01'" title="2 件套" en="Set II">
          <p class="effect" v-html="richDesc(detail.desc2)" />
        </DetailSection>

        <DetailSection v-reveal id="set4" :no="noOf('set4') ?? '01'" title="4 件套" en="Set IV">
          <p class="effect" v-html="richDesc(detail.desc4)" />
        </DetailSection>
      </template>
    </AsyncState>

    <BackToTop />
  </div>
</template>

<style scoped>
.page {
  padding-top: calc(var(--pad-section) * 0.8);
}

.back {
  font-size: 12.5px;
  color: var(--ink-2);
  letter-spacing: 0.12em;
  transition: color var(--t-fast) var(--ease);
  display: inline-block;
  margin-bottom: calc(var(--pad-section) * 0.6);
}

.back:hover {
  color: var(--amber-hi);
}

.story {
  color: var(--ink-1);
  font-size: 14px;
  line-height: 1.8;
  max-width: 60ch;
}

.effect {
  color: var(--ink-1);
  font-size: 14px;
  line-height: 1.9;
  max-width: 76ch;
}

.effect :deep(.rich-key) {
  display: inline-block;
  width: 1.15em;
  height: 1.15em;
  margin: 0 0.1em;
  vertical-align: -0.22em;
  border-radius: 1px;
  line-height: 0;
}
</style>
