<script setup lang="ts">
import { computed } from 'vue'
import { detailFor, listFor } from '@/data/resources'
import { iconSources } from '@/data/icons'
import { ownerAgentForEngine } from '@/domain/signatureEngine'
import { richDesc } from '@/utils/rich'
import { stripRichText } from '@/utils/text'
import { useRouteParam } from '@/composables/useRouteParam'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useDetailSections, type DetailSectionItem } from '@/composables/useDetailSections'
import { usePageMeta } from '@/composables/usePageMeta'
import { useEntityLevel } from '@/composables/useEntityLevel'
import { catalogEntry } from '@/domain/catalog'
import {
  dictToRows,
  wEngineBreakCount,
  wEnginePropsAtLevel,
  W_ENGINE_LEVEL_MAX,
  W_ENGINE_LEVEL_MIN,
  type DetailRow,
  type StatItem,
} from '@/domain/sections'
import { PROFESSIONS, type SpecCode } from '@/data/types'
import type { CharacterListItem, WEngineDetail } from '@/data/types'
import { pickName } from '@/utils/names'
import { DescRow, DetailHead, DetailPage, DetailSection, KeyValueGrid, LevelSlider, SignatureRef, StatLevelPanel } from '@/components'
import Rarity from '@/components/Rarity.vue'
import Tags from '@/components/Tags.vue'

const id = useRouteParam('id')
const { data: detail, status, error } = useAsyncResource(() => detailFor<WEngineDetail>(catalogEntry('/w-engines'), id.value))

usePageMeta(() => detail.value?.name ?? undefined)

/** 代理人名录：用于反查归属该音擎的代理人（domain/signatureEngine 命名约定 + 覆盖表转置）。
 *  作为独立资源，避免阻塞音擎详情主链路。 */
const { data: agents } = useAsyncResource(() => listFor<CharacterListItem>(catalogEntry('/agents')))

/** 归属代理人（音擎拥有者）名录条目；名录未加载/未覆盖（如公共池通用音擎）时为空，head 静默不展示 */
const ownerAgent = computed(() =>
  ownerAgentForEngine(detail.value?.id, detail.value?.code_name, agents.value ?? []),
)

const specCode = computed<SpecCode | null>(() => {
  const wd = detail.value?.weapon_type
  const key = wd ? Object.keys(wd)[0] : null
  return key ? (Number(key) as SpecCode) : null
})

const specName = computed(() =>
  (specCode.value != null ? PROFESSIONS[specCode.value]?.zh : null) ?? null,
)

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
  ),
)

const breakCount = computed(() => wEngineBreakCount(wLevel.value))

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

/* ---------- 归属代理人（反向交叉引用） ---------- */

/** 归属代理人详情页路由：`/agents/{Id}`（路径由 catalog 派生，单一事实源） */
const ownerTo = computed(() =>
  ownerAgent.value ? `${catalogEntry('/agents').path}/${ownerAgent.value.Id}` : '',
)
/** 归属代理人头像候选链（本地化 + nanoka CDN 两级兜底） */
const ownerIconSrcs = computed(() =>
  ownerAgent.value ? iconSources(ownerAgent.value, 'character') : [],
)
/** 归属代理人展示名（zh → en → … 回退） */
const ownerName = computed(() => (ownerAgent.value ? pickName(ownerAgent.value) : ''))

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
        <template #footnote>
          <!-- 归属代理人：边缘注记式反向交叉引用，点击跳转对应代理人详情页（marginalia 语言与 AgentHead 同一套） -->
          <SignatureRef
            v-if="ownerAgent"
            :to="ownerTo"
            label="归属代理人"
            :name="ownerName"
            :icon-srcs="ownerIconSrcs"
            thumb="banner"
            :aria-label="`归属代理人：${ownerName}，前往代理人详情`"
          />
        </template>
      </DetailHead>

      <DetailSection v-if="hasBody" id="overview" :no="noOf('overview')" title="概述" en="Lore">
        <p class="story">{{ bodyText }}</p>
      </DetailSection>

      <DetailSection v-reveal id="props" :no="noOf('props')" title="基础属性" en="Specs">
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

      <DetailSection v-reveal id="talents" :no="noOf('talents')" title="精炼效果" en="Refine">
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