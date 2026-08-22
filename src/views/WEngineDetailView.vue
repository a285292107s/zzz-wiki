<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { api } from '@/data/api'
import { iconSources } from '@/data/icons'
import { richDesc } from '@/utils/rich'
import { stripRichText } from '@/utils/text'
import { useRouteParam } from '@/composables/useRouteParam'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useDetailSections, type DetailSectionItem } from '@/composables/useDetailSections'
import { usePageMeta } from '@/composables/usePageMeta'
import {
  dictToRows,
  wEngineBreakCount,
  wEnginePropsAtLevel,
  W_ENGINE_LEVEL_DEFAULT,
  W_ENGINE_LEVEL_MAX,
  W_ENGINE_LEVEL_MIN,
  type DetailRow,
  type StatItem,
} from '@/domain/sections'
import { PROFESSIONS, type SpecCode } from '@/data/types'
import type { WEngineDetail } from '@/data/types'
import { DescRow, DetailHead, DetailPage, DetailSection, KeyValueGrid, LevelSlider, StatLevelPanel } from '@/components'
import type { LevelMark } from '@/components/detail/LevelSlider.vue'
import Rarity from '@/components/Rarity.vue'
import Tags from '@/components/Tags.vue'

const id = useRouteParam('id')
const { data: detail, status, error } = useAsyncResource(() => api.detail<WEngineDetail>('weapon', id.value))

usePageMeta(() => detail.value?.name ?? undefined)

const specCode = computed<SpecCode | null>(() => {
  const wd = detail.value?.weapon_type
  const key = wd ? Object.keys(wd)[0] : null
  return key ? (Number(key) as SpecCode) : null
})

const specName = computed(() =>
  (specCode.value != null ? PROFESSIONS[specCode.value]?.zh : null) ?? null,
)

/** 基础属性：等级滑条（默认满级；切换音擎时重置） */
const wLevel = ref(W_ENGINE_LEVEL_DEFAULT)

watch(id, () => {
  wLevel.value = W_ENGINE_LEVEL_DEFAULT
})

/** 满级主属性由构建期注入（名录 atk）；缺失时降级为 Lv.1 静态值 */
const hasLevels = computed(() => detail.value?.atk_max != null)

const propItems = computed<StatItem[]>(() =>
  wEnginePropsAtLevel(
    wLevel.value,
    detail.value?.base_property,
    detail.value?.rand_property,
    detail.value?.atk_max,
  ),
)

const breakCount = computed(() => wEngineBreakCount(wLevel.value))

/** 突破刻度：1 起点 + 10/20/30/40/50 突破点（amber）+ 60 上限（灰） */
const levelMarks = computed<LevelMark[]>(() => {
  const marks: LevelMark[] = [{ at: W_ENGINE_LEVEL_MIN, label: String(W_ENGINE_LEVEL_MIN) }]
  for (let lv = 10; lv <= W_ENGINE_LEVEL_MAX; lv += 10) {
    marks.push({ at: lv, label: String(lv), break: lv < W_ENGINE_LEVEL_MAX })
  }
  return marks
})

const talents = computed<DetailRow[]>(() => dictToRows(detail.value?.talents))

/** 概述仅承载 lore 正文（desc）；desc3 为主题句、desc2 为功能提示，均已上移至头部 sub 区 */
const hasBody = computed(() => !!detail.value?.desc)

const bodyText = computed<string>(() => {
  const d = detail.value
  if (!d?.desc) return ''
  return stripRichText(d.desc)
})

const portraitSrcs = computed(() =>
  iconSources({ Id: detail.value?.id, icon: detail.value?.icon }, 'weapon'),
)

/* ---------- 区块导航（条件区块）+ scrollspy + reveal ---------- */

const navItems = computed(() => {
  const items: DetailSectionItem[] = []
  let n = 0
  const add = (id: string, label: string) =>
    items.push({ id, no: String(++n).padStart(2, '0'), label })
  if (hasBody.value) add('overview', '概述')
  add('props', '基础属性')
  add('talents', '精炼效果')
  return items
})

const { activeSection, revealDir: vReveal, noOf } = useDetailSections(navItems, status)

/** 404 时返回音擎图鉴 */
const backTo = computed(() => (detail.value ? undefined : '/w-engines'))
</script>

<template>
  <DetailPage
    back-to="/w-engines"
    back-label="返回音擎图鉴"
    :nav="detail ? navItems : []"
    :active="activeSection"
    :status="status"
    :error="error"
    :fallback-to="backTo"
  >
    <template v-if="detail">
      <DetailHead
        :eyebrow="`W-Engine · ${String(id).padStart(4, '0')}`"
        :title="detail.name ?? '—'"
        :portrait-srcs="portraitSrcs"
        :alt="detail.name ?? ''"
        :fallback="detail.name ?? '—'"
        ratio="1 / 1"
      >
        <template #meta>
          <Rarity :rank="detail.rarity" />
          <Tags :specialty="specCode" />
          <span v-if="specName" class="tag serif">{{ specName }}</span>
        </template>
        <template #sub>
          <p v-if="detail?.desc3" class="tagline">{{ detail.desc3 }}</p>
          <p v-if="detail?.desc2" class="sub-info">{{ detail.desc2 }}</p>
        </template>
      </DetailHead>

      <DetailSection v-if="hasBody" id="overview" :no="noOf('overview') ?? '01'" title="概述" en="Lore">
        <p class="story">{{ bodyText }}</p>
      </DetailSection>

      <DetailSection v-reveal id="props" :no="noOf('props') ?? '01'" title="基础属性" en="Specs">
        <StatLevelPanel
          :lv-label="`Lv.${wLevel}`"
          :meta="hasLevels ? (breakCount === 0 ? '未突破' : `突破 ${breakCount} 阶`) : undefined"
        >
          <template #control>
            <LevelSlider
              v-if="hasLevels"
              v-model="wLevel"
              :min="W_ENGINE_LEVEL_MIN"
              :max="W_ENGINE_LEVEL_MAX"
              label="音擎等级"
              :marks="levelMarks"
            />
          </template>
        </StatLevelPanel>
        <KeyValueGrid :items="propItems" variant="ledger" />
      </DetailSection>

      <DetailSection v-reveal id="talents" :no="noOf('talents') ?? '01'" title="精炼效果" en="Refine">
        <ul v-if="talents.length" class="desc-list">
          <DescRow
            v-for="t in talents"
            :key="t.no"
            :no="String(t.no).padStart(2, '0')"
            :title="t.name ?? '未命名'"
            :html="richDesc(t.desc)"
            variant="talent"
          />
        </ul>
        <p v-else class="empty mono">—</p>
      </DetailSection>
    </template>
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
  max-width: 72ch;
  white-space: pre-line;
}

.desc-list {
  list-style: none;
}

.empty {
  font-size: var(--fs-caption);
  letter-spacing: 0.2em;
  color: var(--ink-2);
}
</style>