<script setup lang="ts">
import { computed } from 'vue'
import { api } from '@/data/api'
import { iconSources } from '@/data/icons'
import { richDesc } from '@/utils/rich'
import { stripRichText } from '@/utils/text'
import { useRouteParam } from '@/composables/useRouteParam'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useDetailSections, type DetailSectionItem } from '@/composables/useDetailSections'
import { usePageMeta } from '@/composables/usePageMeta'
import type { DiskDriveDetail } from '@/data/types'
import { DetailHead, DetailPage, DetailSection } from '@/components'

const id = useRouteParam('id')
const { data: detail, status, error } = useAsyncResource(() => api.detail<DiskDriveDetail>('equipment', id.value))

usePageMeta(() => detail.value?.name ?? undefined)

const portraitSrcs = computed(() =>
  iconSources({ Id: id.value, icon: detail.value?.icon }, 'disc'),
)

/* ---------- 区块导航 + scrollspy + reveal ---------- */

const navItems = computed<DetailSectionItem[]>(() => [
  { id: 'set2', no: '01', label: '2 件套' },
  { id: 'set4', no: '02', label: '4 件套' },
])

const { activeSection, revealDir: vReveal, noOf } = useDetailSections(navItems, status)

/** 404 时返回驱动盘总览 */
const backTo = computed(() => (detail.value ? undefined : '/disks'))
</script>

<template>
  <DetailPage
    back-to="/disks"
    back-label="返回驱动盘总览"
    :nav="detail ? navItems : []"
    :active="activeSection"
    :status="status"
    :error="error"
    :fallback-to="backTo"
  >
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
  </DetailPage>
</template>

<style scoped>
.story {
  color: var(--ink-1);
  font-size: var(--fs-md);
  line-height: 1.8;
  max-width: 60ch;
}

.effect {
  color: var(--ink-1);
  font-size: var(--fs-md);
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
