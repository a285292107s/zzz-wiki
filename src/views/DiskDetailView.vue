<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { detailFor } from '@/data/resources'
import { iconSources } from '@/data/icons'
import { discGifPosterSources, discGifSources, hasDiscGif } from '@/data/discGif'
import { richDesc } from '@/utils/rich'
import { stripRichText, textEmWidth, WIDE_COLS_MIN_EM } from '@/utils/text'
import { pickLocaleInfo } from '@/utils/names'
import { useLocale } from '@/composables/useLocale'
import { useUiText } from '@/composables/useUiText'
import { useRouteParam } from '@/composables/useRouteParam'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useDetailSections, type DetailSectionItem } from '@/composables/useDetailSections'
import { useMediaQuery } from '@/composables/useMediaQuery'
import { usePageMeta } from '@/composables/usePageMeta'
import { useDetailPager } from '@/composables/useDetailPager'
import { catalogEntry } from '@/domain/catalog'
import type { DiskDriveDetail, LocaleInfo } from '@/data/types'
import MotionFigure from '@/components/detail/MotionFigure.vue'
import { DetailHead, DetailPage, DetailPager, DetailSection, DetailSkeleton } from '@/components'

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

const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
const motionAvailable = computed(() => hasDiscGif(id.value))
const playing = ref(false)

watch(
  [prefersReducedMotion, () => detail.value?.icon],
  () => {
    playing.value = !prefersReducedMotion.value && motionAvailable.value
  },
  { immediate: true },
)

const portraitSrcs = computed(() => {
  const fallback = iconSources({ Id: id.value, icon: detail.value?.icon }, 'disc')
  const motion = playing.value ? discGifSources(id.value) : discGifPosterSources(id.value)
  return [...motion, ...fallback]
})

const set2Wide = computed(() => textEmWidth(stripRichText(detail.value?.desc2)) >= WIDE_COLS_MIN_EM)
const set4Wide = computed(() => textEmWidth(stripRichText(detail.value?.desc4)) >= WIDE_COLS_MIN_EM)

/* ---------- 区块导航 + scrollspy + reveal ---------- */

const navItems = computed<DetailSectionItem[]>(() => [
  {
    id: 'sets',
    no: '01',
    label: t.value.detail.setBonus,
    children: [
      { id: 'set2', label: t.value.detail.set2 },
      { id: 'set4', label: t.value.detail.set4 },
    ],
  },
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
    <template #skeleton>
      <DetailSkeleton variant="compact" />
    </template>

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
        <template #portrait>
          <MotionFigure
            v-model:playing="playing"
            :srcs="portraitSrcs"
            :fallback="detail.name ?? '—'"
            :toggle="motionAvailable"
            :play-label="t.detail.playAnim"
            :pause-label="t.detail.pauseAnim"
          />
        </template>

        <template #sub>
          <p v-if="detail.story" class="story measure">{{ stripRichText(detail.story) }}</p>
        </template>
      </DetailHead>

      <DetailSection v-reveal id="sets" :no="noOf('sets')" :title="t.detail.setBonus" en="Bonus">
        <dl class="set-list">
          <div id="set2" class="set-row" tabindex="-1">
            <dt class="set-tier mono">{{ t.detail.set2 }}</dt>
            <dd class="effect measure" :class="{ 'wide-cols': set2Wide }" v-html="richDesc(detail.desc2)" />
          </div>
          <div id="set4" class="set-row" tabindex="-1">
            <dt class="set-tier mono">{{ t.detail.set4 }}</dt>
            <dd class="effect measure" :class="{ 'wide-cols': set4Wide }" v-html="richDesc(detail.desc4)" />
          </div>
        </dl>
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
}

.set-list {
  margin: 0;
}

.set-row {
  padding-block: 18px;
  scroll-margin-top: var(--anchor-offset);
}

.set-row:first-child {
  padding-top: 0;
}

.set-row + .set-row {
  border-top: var(--rule);
}

.set-tier {
  margin-bottom: 8px;
  font-size: var(--fs-micro);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ink-2);
}

.effect {
  margin: 0;
  color: var(--ink-1);
  font-size: var(--fs-md);
  line-height: 1.9;
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
