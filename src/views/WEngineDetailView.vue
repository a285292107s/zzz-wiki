<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { detailFor, listFor } from '@/data/resources'
import { iconSources } from '@/data/icons'
import { weaponArtSource, WEAPON_ART_RATIO } from '@/data/weaponArt'
import { hasWEngineGif, wEngineGifPosterSources, wEngineGifSources } from '@/data/wengineGif'
import { ownerAgentForEngine } from '@/domain/signatureEngine'
import { richDesc } from '@/utils/rich'
import { stripRichText, textEmWidth, WIDE_COLS_MIN_EM } from '@/utils/text'
import { useRouteParam } from '@/composables/useRouteParam'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useDetailSections, type DetailSectionItem } from '@/composables/useDetailSections'
import { usePageMeta } from '@/composables/usePageMeta'
import { useMediaQuery } from '@/composables/useMediaQuery'
import { useEntityLevel } from '@/composables/useEntityLevel'
import { useDetailPager } from '@/composables/useDetailPager'
import { catalogEntry } from '@/domain/catalog'
import {
  dictToRows,
  refineRowAt,
  wEngineBreakCount,
  wEnginePropsAtLevel,
  W_ENGINE_LEVEL_MAX,
  W_ENGINE_LEVEL_MIN,
  W_ENGINE_REFINE_MAX,
  W_ENGINE_REFINE_MIN,
  type DetailRow,
  type StatItem,
} from '@/domain/sections'
import type { SpecCode } from '@/data/types'
import type { CharacterListItem, WEngineDetail } from '@/data/types'
import { pickName } from '@/utils/names'
import { useLocale } from '@/composables/useLocale'
import { useUiText } from '@/composables/useUiText'
import { fmt } from '@/domain/uiText'
import { DetailHead, DetailPage, DetailPager, DetailSection, DetailSkeleton, KeyValueGrid, LevelSlider, SignatureRef, StatLevelPanel } from '@/components'
import MotionFigure from '@/components/detail/MotionFigure.vue'
import HollowImage from '@/components/HollowImage.vue'
import Rarity from '@/components/Rarity.vue'
import Tags from '@/components/Tags.vue'

const id = useRouteParam('id')
/** 当前展示语言：详情正文（概述/精炼效果/属性名）按语言落盘，语言一变由 watchEffect 重新取数 */
const { lang } = useLocale()
const { t } = useUiText()
const { data: detail, status, error, reload } = useAsyncResource(() =>
  detailFor<WEngineDetail>(catalogEntry('/w-engines'), id.value, lang.value),
)

/** 404 与「加载失败」要分开说：档案确实不存在 vs 数据没到位（标题不能都说「缺失」） */
const isNotFound = computed(() => /HTTP 404\b/.test(error.value ?? ''))

usePageMeta(
  // 404（档案不存在）时标题给「档案缺失」：与路由级 404 一致，也让标签页/书签说真话；
  // 加载中仍走路由 meta 的默认标题（不能提前显示「缺失」）
  () => detail.value?.name ?? (status.value === 'error' ? (isNotFound.value ? t.value.detail.missing : t.value.detail.loadFailed) : undefined),
  () => {
    const name = detail.value?.name
    const d = detail.value?.desc
    return name && d ? `${name} — ${stripRichText(d).slice(0, 110)}… · ${t.value.meta.siteName}` : undefined
  },
)

/** 代理人名录：用于反查归属该音擎的代理人（domain/signatureEngine 命名约定 + 覆盖表转置）。
 *  作为独立资源，避免阻塞音擎详情主链路。 */
const { data: agents } = useAsyncResource(() =>
  listFor<CharacterListItem>(catalogEntry('/agents'), lang.value),
)

/** 归属代理人（音擎拥有者）名录条目；名录未加载/未覆盖（如公共池通用音擎）时为空，head 静默不展示 */
const ownerAgent = computed(() =>
  ownerAgentForEngine(detail.value?.id, detail.value?.code_name, agents.value ?? []),
)

const specCode = computed<SpecCode | null>(() => {
  const wd = detail.value?.weapon_type
  const key = wd ? Object.keys(wd)[0] : null
  return key ? (Number(key) as SpecCode) : null
})

/** 基础属性：等级滑条（默认满级；切换音擎时重置）与突破刻度 */
const { level: wLevel, levelMarks } = useEntityLevel({
  min: W_ENGINE_LEVEL_MIN,
  max: W_ENGINE_LEVEL_MAX,
})

/** 满级主属性由构建期注入（名录 atk）；缺失时降级为 Lv.1 静态值 */
const hasLevels = computed(() => detail.value?.atk_max != null)

const propItems = computed<StatItem[]>(() =>
  wEnginePropsAtLevel(
    wLevel.value,
    detail.value?.base_property,
    detail.value?.rand_property,
    detail.value?.atk_max,
    lang.value,
  ),
)

const breakCount = computed(() => wEngineBreakCount(wLevel.value))

const talents = computed<DetailRow[]>(() => dictToRows(detail.value?.talents))

/** 精炼阶数（1-5 阶，默认 1 阶）：与基础属性同源「等级滑条」样板，深链参数 ?rf=N。
 *  刻度不传 marks——该样板给的是 10 级突破点（1-60 口径），5 阶用不上 */
const { level: refineLevel } = useEntityLevel({
  min: W_ENGINE_REFINE_MIN,
  max: W_ENGINE_REFINE_MAX,
  default: W_ENGINE_REFINE_MIN,
  queryKey: 'rf',
})

/** 当前精炼阶的效果档（1-5 阶是同一段效果的不同数值，只呈现当前阶） */
const refineTalent = computed<DetailRow | null>(() => refineRowAt(talents.value, refineLevel.value))

/** 档位标签取**档位行自身的序号**：正常数据下恒等于滑条值，缺档回退时也如实标注实际阶数 */
const refineLabel = computed(() =>
  refineTalent.value ? fmt(t.value.detail.refineRank, { n: refineTalent.value.no }) : '',
)

/** 概述仅承载 lore 正文（desc）；desc3 为主题句、desc2 为功能提示，均已上移至头部 sub 区 */
const hasBody = computed(() => !!detail.value?.desc)

const bodyText = computed<string>(() => {
  const d = detail.value
  if (!d?.desc) return ''
  return stripRichText(d.desc)
})

const overviewWide = computed(() => textEmWidth(bodyText.value) >= WIDE_COLS_MIN_EM)
const refineWide = computed(() => textEmWidth(stripRichText(refineTalent.value?.desc)) >= WIDE_COLS_MIN_EM)

const artSrc = computed(() => weaponArtSource(detail.value?.code_name))
/** 解包大图只覆盖部分音擎：有则整幅展示产品图，无则回落到名录图标 */
const hasArt = computed(() => !!artSrc.value)

const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
const motionAvailable = computed(() => hasWEngineGif(id.value))
const playing = ref(false)

watch(
  [prefersReducedMotion, () => detail.value?.icon],
  () => {
    playing.value = !prefersReducedMotion.value && motionAvailable.value
  },
  { immediate: true },
)

const artPortrait = computed(() => !motionAvailable.value && hasArt.value)

const portraitSrcs = computed(() => {
  const icon = iconSources({ Id: detail.value?.id, icon: detail.value?.icon }, 'weapon')
  if (motionAvailable.value) {
    const motion = playing.value ? wEngineGifSources(id.value) : wEngineGifPosterSources(id.value)
    return [...motion, ...icon]
  }
  return artSrc.value ? [artSrc.value, ...icon] : icon
})
const portraitRatio = computed(() => (artPortrait.value ? WEAPON_ART_RATIO : '1 / 1'))
const portraitFit = computed<'cover' | 'contain'>(() => (artPortrait.value ? 'contain' : 'cover'))

/* ---------- 归属代理人（反向交叉引用） ---------- */

/** 归属代理人详情页路由：`/agents/{Id}`（路径由 catalog 派生，单一事实源） */
const ownerTo = computed(() =>
  ownerAgent.value ? `${catalogEntry('/agents').path}/${ownerAgent.value.Id}` : '',
)
/** 归属代理人头像候选链（本地化 + nanoka CDN 两级兜底） */
const ownerIconSrcs = computed(() =>
  ownerAgent.value ? iconSources(ownerAgent.value, 'character') : [],
)
/** 归属代理人展示名（当前语言 → 其余语言 → 代号 回退） */
const ownerName = computed(() => (ownerAgent.value ? pickName(ownerAgent.value, lang.value) : ''))

/* ---------- 区块导航（条件区块）+ scrollspy + reveal ---------- */

const navItems = computed(() => {
  const items: DetailSectionItem[] = []
  let n = 0
  const add = (id: string, label: string) =>
    items.push({ id, no: String(++n).padStart(2, '0'), label })
  if (hasBody.value) add('overview', t.value.detail.overview)
  add('props', t.value.detail.baseProps)
  add('talents', t.value.detail.refineEffect)
  return items
})

const { activeSection, revealDir: vReveal, noOf, refresh } = useDetailSections(navItems, status)

watch(ownerAgent, () => {
  if (status.value === 'success') refresh()
})

/** 相邻条目翻页：名录 Id 序，名录走 api 缓存 */
const catWEngines = catalogEntry('/w-engines')
const { prev: pagerPrev, next: pagerNext } = useDetailPager(catWEngines, id, (r) =>
  pickName(r, lang.value),
)

/** 404 时返回音擎图鉴 */
const backTo = computed(() => (detail.value ? undefined : '/w-engines'))
</script>

<template>
  <DetailPage
    back-to="/w-engines"
    :back-label="t.detail.backToWEngines"
    :nav="detail ? navItems : []"
    :active="activeSection"
    :status="status"
    :error="error"
    :retry="reload"
    :fallback-to="backTo"
    :recent="{ entry: catWEngines, id: () => String(id), label: () => detail?.name ?? '' }"
  >
    <template #skeleton>
      <DetailSkeleton variant="compact" :ratio="WEAPON_ART_RATIO" wide />
    </template>

    <template v-if="detail">
      <DetailHead
        :eyebrow="`W-Engine · ${String(id).padStart(4, '0')}`"
        :title="detail.name ?? '—'"
        :portrait-srcs="portraitSrcs"
        alt=""
        :fallback="detail.name ?? '—'"
        :ratio="portraitRatio"
        :fit="portraitFit"
        :wide="artPortrait"
      >
        <template #portrait>
          <MotionFigure
            v-if="motionAvailable"
            v-model:playing="playing"
            :srcs="portraitSrcs"
            :fallback="detail.name ?? '—'"
            toggle
            :play-label="t.detail.playAnim"
            :pause-label="t.detail.pauseAnim"
          />
          <HollowImage
            v-else
            :srcs="portraitSrcs"
            alt=""
            :fallback="detail.name ?? '—'"
            :ratio="portraitRatio"
            :fit="portraitFit"
          />
        </template>
        <template #meta>
          <Rarity :rank="detail.rarity" />
          <Tags :specialty="specCode" />
        </template>
        <template #sub>
          <p v-if="detail?.desc3" class="tagline">{{ detail.desc3 }}</p>
          <p v-if="detail?.desc2" class="sub-info">{{ detail.desc2 }}</p>
        </template>
        <template #footnote>
          <!-- 归属代理人：边缘注记式反向交叉引用，点击跳转对应代理人详情页（marginalia 语言与 AgentHead 同一套） -->
          <SignatureRef
            v-if="ownerAgent"
            :to="ownerTo"
            :label="t.detail.ownerAgent"
            :name="ownerName"
            :icon-srcs="ownerIconSrcs"
            thumb="banner"
            :aria-label="fmt(t.detail.ownerAgentHint, { name: ownerName })"
          />
        </template>
      </DetailHead>

      <DetailSection v-if="hasBody" id="overview" :no="noOf('overview')" :title="t.detail.overview" en="Lore">
        <p class="story measure" :class="{ 'wide-cols': overviewWide }">{{ bodyText }}</p>
      </DetailSection>

      <DetailSection v-reveal id="props" :no="noOf('props')" :title="t.detail.baseProps" en="Specs">
        <StatLevelPanel
          :lv-label="`Lv.${wLevel}`"
          :meta="hasLevels ? (breakCount === 0 ? t.detail.notBroken : fmt(t.detail.breakCount, { n: breakCount })) : undefined"
        >
          <template #control>
            <LevelSlider
              v-if="hasLevels"
              v-model="wLevel"
              :min="W_ENGINE_LEVEL_MIN"
              :max="W_ENGINE_LEVEL_MAX"
              :label="t.detail.wengineLevel"
              :marks="levelMarks"
            />
          </template>
          <KeyValueGrid :items="propItems" variant="ledger" :framed="false" />
        </StatLevelPanel>
      </DetailSection>

      <DetailSection v-reveal id="talents" :no="noOf('talents')" :title="t.detail.refineEffect" en="Refine">
        <!-- 1-5 阶只有数值不同、效果名与文案骨架完全一致，逐阶并列 5 行是同一段话抄 5 遍：
             改为「一阶一段」——滑条选阶，正文只渲染当前阶那一份 -->
        <StatLevelPanel v-if="refineTalent" :lv-label="refineLabel">
          <template #control>
            <LevelSlider
              v-model="refineLevel"
              :min="W_ENGINE_REFINE_MIN"
              :max="W_ENGINE_REFINE_MAX"
              :label="t.detail.refineLevel"
              :value-text="refineLabel"
            />
          </template>
          <h3 class="refine-name serif">{{ refineTalent.name ?? t.common.unnamed }}</h3>
          <p class="refine-desc measure" :class="{ 'wide-cols': refineWide }" v-html="richDesc(refineTalent.desc)" />
        </StatLevelPanel>
        <p v-else class="empty mono">—</p>
      </DetailSection>
    </template>

    <DetailPager :prev="pagerPrev" :next="pagerNext" :entry="catWEngines" />
  </DetailPage>
</template>

<style scoped>
/* 头部主题句（desc3）：诗意的引句感 */
.tagline {
  margin-top: 0;
  font-size: var(--fs-body);
  line-height: 1.7;
  letter-spacing: 0.04em;
  font-style: italic;
  color: var(--ink-1);
}

/* 头部功能提示（desc2）：适用职业说明的小字 */
.sub-info {
  margin-top: 8px;
  font-size: var(--fs-caption);
  letter-spacing: 0.08em;
  color: var(--ink-2);
}

.story {
  color: var(--ink-1);
  font-size: var(--fs-md);
  line-height: 1.9;
  white-space: pre-line;
  text-wrap: balance;
}

/* 精炼效果名/正文：与 DescRow 的 talent 行同源排版（serif 名 + 13px/1.8 正文），
   差别只是不再编号、不再逐阶重复，由上方滑条选阶 */
.refine-name {
  font-family: var(--serif);
  font-size: var(--fs-lead);
  font-weight: 500;
  line-height: 1.4;
  color: var(--ink-0);
  margin: 12px 0 6px;
}

.refine-desc {
  color: var(--ink-1);
  font-size: var(--fs-small);
  line-height: 1.8;
  white-space: pre-line;
  text-wrap: balance;
}

.empty {
  font-size: var(--fs-caption);
  letter-spacing: 0.2em;
  color: var(--ink-2);
}
</style>