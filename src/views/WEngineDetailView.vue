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
import { PROFESSIONS, type SpecCode } from '@/data/types'
import type { CharacterListItem, WEngineDetail } from '@/data/types'
import { pickName } from '@/utils/names'
import { DetailHead, DetailPager, DetailPage, DetailSection, KeyValueGrid, LevelSlider, SignatureRef, StatLevelPanel, CopyLinkButton } from '@/components'
import Rarity from '@/components/Rarity.vue'
import Tags from '@/components/Tags.vue'

const id = useRouteParam('id')
const { data: detail, status, error, reload } = useAsyncResource(() => detailFor<WEngineDetail>(catalogEntry('/w-engines'), id.value))

/** 404 与「加载失败」要分开说：档案确实不存在 vs 数据没到位（标题不能都说「缺失」） */
const isNotFound = computed(() => /HTTP 404\b/.test(error.value ?? ''))

usePageMeta(
  // 404（档案不存在）时标题给「档案缺失」：与路由级 404 一致，也让标签页/书签说真话；
  // 加载中仍走路由 meta 的默认标题（不能提前显示「缺失」）
  () => detail.value?.name ?? (status.value === 'error' ? (isNotFound.value ? '档案缺失' : '载入失败') : undefined),
  () => {
    const name = detail.value?.name
    const d = detail.value?.desc
    return name && d ? `${name} — ${stripRichText(d).slice(0, 110)}… · 绳网档案` : undefined
  },
)

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

/** 精炼阶数（1-5 阶，默认满精炼）：与基础属性同源「等级滑条」样板，深链参数 ?rf=N。
 *  刻度不传 marks——该样板给的是 10 级突破点（1-60 口径），5 阶用不上 */
const { level: refineLevel } = useEntityLevel({
  min: W_ENGINE_REFINE_MIN,
  max: W_ENGINE_REFINE_MAX,
  queryKey: 'rf',
})

/** 当前精炼阶的效果档（1-5 阶是同一段效果的不同数值，只呈现当前阶） */
const refineTalent = computed<DetailRow | null>(() => refineRowAt(talents.value, refineLevel.value))

/** 档位标签取**档位行自身的序号**：正常数据下恒等于滑条值，缺档回退时也如实标注实际阶数 */
const refineLabel = computed(() => (refineTalent.value ? `精炼 ${refineTalent.value.no} 阶` : ''))

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

/** 相邻条目翻页：名录 Id 序，名录走 api 缓存 */
const catWEngines = catalogEntry('/w-engines')
const { prev: pagerPrev, next: pagerNext } = useDetailPager(catWEngines, id, pickName)

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
    :retry="reload"
    :fallback-to="backTo"
    :recent="{ entry: catWEngines, id: () => String(id), label: () => detail?.name ?? '' }"
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
          <!-- v-if 挂在 template 上而非按钮上：v-if 为假时整个具名插槽不存在，
               StatLevelPanel 才判定得出「操作位为空」，不会留下一条空行 -->
          <template v-if="hasLevels && wLevel !== W_ENGINE_LEVEL_MAX" #actions>
            <CopyLinkButton label="复制此等级链接" />
          </template>
        </StatLevelPanel>
        <KeyValueGrid :items="propItems" variant="ledger" />
      </DetailSection>

      <DetailSection v-reveal id="talents" :no="noOf('talents')" title="精炼效果" en="Refine">
        <!-- 1-5 阶只有数值不同、效果名与文案骨架完全一致，逐阶并列 5 行是同一段话抄 5 遍：
             改为「一阶一段」——滑条选阶，正文只渲染当前阶那一份 -->
        <StatLevelPanel v-if="refineTalent" :lv-label="refineLabel">
          <template #control>
            <LevelSlider
              v-model="refineLevel"
              :min="W_ENGINE_REFINE_MIN"
              :max="W_ENGINE_REFINE_MAX"
              label="精炼等级"
              :value-text="refineLabel"
            />
          </template>
          <!-- 操作位放在正文**之后**（不在滑条行、也不在 #actions 元信息行）：
               滑条行会挤窄轨道；元信息行的显隐条件同样是「非满精炼」，一出现就把下方正文
               顶下去 36px（拖过 5 阶时正文上下跳）。放正文之后，出现/消失只影响本框底部 -->
          <h3 class="refine-name serif">{{ refineTalent.name ?? '未命名' }}</h3>
          <p class="refine-desc" v-html="richDesc(refineTalent.desc)" />
          <div v-if="refineLevel !== W_ENGINE_REFINE_MAX" class="refine-actions">
            <CopyLinkButton label="复制此精炼链接" />
          </div>
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
  max-width: 72ch;
  white-space: pre-line;
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
  max-width: 76ch;
  white-space: pre-line;
}

/* 分享入口：正文之后的右对齐操作行（仅非满精炼时存在） */
.refine-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

.empty {
  font-size: var(--fs-caption);
  letter-spacing: 0.2em;
  color: var(--ink-2);
}
</style>