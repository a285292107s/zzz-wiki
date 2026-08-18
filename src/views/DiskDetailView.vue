<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { iconSources } from '@/data/icons'
import { richDesc } from '@/utils/rich'
import { stripRichText } from '@/utils/text'
import { useRouteParam } from '@/composables/useRouteParam'
import { useDetailResource } from '@/composables/useDetailResource'
import { usePageMeta } from '@/composables/usePageMeta'
import type { DiskDriveDetail } from '@/data/types'
import { AsyncState, DetailHead, DetailSection } from '@/components'
import BackToTop from '@/components/BackToTop.vue'

const id = useRouteParam('id')
const { data: detail, status, error } = useDetailResource<DiskDriveDetail>('equipment', id)

usePageMeta(() => detail.value?.name ?? undefined)

const portraitSrcs = computed(() =>
  iconSources({ Id: id.value, icon: detail.value?.icon }, 'portrait', 'disc'),
)

/** 平滑滚动到区块锚点 */
function goTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <div class="wrap page">
    <RouterLink to="/disks" class="back mono">← 返回驱动盘总览</RouterLink>

    <nav v-if="detail" class="section-nav" aria-label="页面区块">
      <a class="sn-item mono" href="#set2" @click.prevent="goTo('set2')">01 2 件套</a>
      <a class="sn-item mono" href="#set4" @click.prevent="goTo('set4')">02 4 件套</a>
    </nav>

    <AsyncState :status="status" :error="error">
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

        <DetailSection id="set2" no="01" title="2 件套">
          <p class="effect" v-html="richDesc(detail.desc2)" />
        </DetailSection>

        <DetailSection id="set4" no="02" title="4 件套">
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
