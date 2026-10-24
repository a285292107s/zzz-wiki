<script setup lang="ts">
import { computed } from 'vue'
import { detailFor } from '@/data/resources'
import { iconSources } from '@/data/icons'
import { richDesc } from '@/utils/rich'
import { stripRichText } from '@/utils/text'
import { pickLocaleInfo } from '@/utils/names'
import { useLocale } from '@/composables/useLocale'
import { useUiText } from '@/composables/useUiText'
import { useRouteParam } from '@/composables/useRouteParam'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useDetailSections, type DetailSectionItem } from '@/composables/useDetailSections'
import { usePageMeta } from '@/composables/usePageMeta'
import { useDetailPager } from '@/composables/useDetailPager'
import { catalogEntry } from '@/domain/catalog'
import type { DiskDriveDetail, LocaleInfo } from '@/data/types'
import { DetailHead, DetailPager, DetailPage, DetailSection } from '@/components'

const id = useRouteParam('id')
/** 当前展示语言：详情正文按语言落盘，语言一变由 watchEffect 重新取数 */
const { lang } = useLocale()
const { t } = useUiText()
const { data: detail, status, error, reload } = useAsyncResource(() =>
  detailFor<DiskDriveDetail>(catalogEntry('/disks'), id.value, lang.value),
)

/** 404 与「加载失败」要分开说：档案确实不存在 vs 数据没到位（标题不能都说「缺失」） */
const isNotFound = computed(() => /HTTP 404\b/.test(error.value ?? ''))

usePageMeta(
  // 404（档案不存在）时标题给「档案缺失」：与路由级 404 一致，也让标签页/书签说真话；
  // 加载中仍走路由 meta 的默认标题（不能提前显示「缺失」）
  () => detail.value?.name ?? (status.value === 'error' ? (isNotFound.value ? t.value.detail.missing : t.value.detail.loadFailed) : undefined),
  () => {
    const name = detail.value?.name
    const d = detail.value?.story
    return name && d ? `${name} — ${stripRichText(d).slice(0, 110)}… · ${t.value.meta.siteName}` : undefined
  },
)

const portraitSrcs = computed(() =>
  iconSources({ Id: id.value, icon: detail.value?.icon }, 'disc'),
)

/* ---------- 区块导航 + scrollspy + reveal ---------- */

const navItems = computed<DetailSectionItem[]>(() => [
  { id: 'set2', no: '01', label: t.value.detail.set2 },
  { id: 'set4', no: '02', label: t.value.detail.set4 },
])

const { activeSection, revealDir: vReveal, noOf } = useDetailSections(navItems, status)

/** 相邻条目翻页：名录 Id 序，名录走 api 缓存。
 *  标签取名走 pickLocaleInfo（驱动盘名录的 zh/en/ja/ko 是 `{ name, desc2, desc4 }` 子对象，
 *  不是名字字符串——用 pickName 会逐个跳过对象、翻页标签恒为 '—'）。 */
const catDisks = catalogEntry('/disks')
const { prev: pagerPrev, next: pagerNext } = useDetailPager(catDisks, id, (d) =>
  pickLocaleInfo<LocaleInfo>(d, lang.value)?.name ?? '',
)

/** 404 时返回驱动盘总览 */
const backTo = computed(() => (detail.value ? undefined : '/disks'))
</script>

<template>
  <DetailPage
    back-to="/disks"
    :back-label="t.detail.backToDisks"
    :nav="detail ? navItems : []"
    :active="activeSection"
    :status="status"
    :error="error"
    :retry="reload"
    :fallback-to="backTo"
    :recent="{ entry: catDisks, id: () => String(id), label: () => detail?.name ?? '' }"
  >
    <template v-if="detail">
      <DetailHead
        :eyebrow="`Disk Drive · ${String(id).padStart(5, '0')}`"
        :title="detail.name ?? '—'"
        :portrait-srcs="portraitSrcs"
        alt=""
        :fallback="detail.name ?? '—'"
        position="top"
        ratio="1 / 1"
      >
        <template #sub>
          <p v-if="detail.story" class="story">{{ stripRichText(detail.story) }}</p>
        </template>
      </DetailHead>

      <DetailSection id="set2" :no="noOf('set2')" :title="t.detail.set2" en="Set II">
        <p class="effect" v-html="richDesc(detail.desc2)" />
      </DetailSection>

      <DetailSection v-reveal id="set4" :no="noOf('set4')" :title="t.detail.set4" en="Set IV">
        <p class="effect" v-html="richDesc(detail.desc4)" />
      </DetailSection>
    </template>

    <DetailPager :prev="pagerPrev" :next="pagerNext" :entry="catDisks" />
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
