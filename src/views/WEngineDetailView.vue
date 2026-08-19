<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { iconSources } from '@/data/icons'
import { richDesc } from '@/utils/rich'
import { stripRichText } from '@/utils/text'
import { useRouteParam } from '@/composables/useRouteParam'
import { useDetailResource } from '@/composables/useDetailResource'
import { useDetailNavigation } from '@/composables/useDetailNavigation'
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
import { AsyncState, DescRow, DetailHead, DetailSection, KeyValueGrid, LevelSlider } from '@/components'
import type { LevelMark } from '@/components/detail/LevelSlider.vue'
import BackToTop from '@/components/BackToTop.vue'
import Rarity from '@/components/Rarity.vue'
import Tags from '@/components/Tags.vue'

const id = useRouteParam('id')
const { data: detail, status, error } = useDetailResource<WEngineDetail>('weapon', id)

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

const hasBody = computed(
  () => detail.value?.desc || detail.value?.desc2 || detail.value?.desc3,
)

const bodyText = computed<string>(() => {
  const d = detail.value
  if (!d) return ''
  return [d.desc, d.desc2, d.desc3]
    .map((x) => stripRichText(x))
    .filter((x) => x && x.trim())
    .join('\n\n')
})

const portraitSrcs = computed(() =>
  iconSources({ Id: detail.value?.id, icon: detail.value?.icon }, 'portrait', 'weapon'),
)

/* ---------- 区块导航（条件区块）+ scrollspy + reveal ---------- */

const navItems = computed(() => {
  const items: Array<{ id: string; no: string; label: string }> = []
  if (hasBody.value) items.push({ id: 'overview', no: '01', label: '概述' })
  items.push({ id: 'props', no: hasBody.value ? '02' : '01', label: '基础属性' })
  items.push({ id: 'talents', no: hasBody.value ? '03' : '02', label: '精炼效果' })
  return items
})

const { activeSection, revealDir, activate } = useDetailNavigation()
const vReveal = revealDir
const noOf = (id: string) => navItems.value.find((n) => n.id === id)?.no

/** 404 时返回音擎图鉴 */
const backTo = computed(() => (detail.value ? undefined : '/w-engines'))

watch(status, (s) => {
  if (s !== 'success') return
  nextTick(() => activate(navItems.value.map((n) => n.id)))
})
</script>

<template>
  <div class="wrap page">
    <RouterLink to="/w-engines" class="back mono">← 返回音擎图鉴</RouterLink>

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
            <span v-if="specName" class="spec serif">{{ specName }}</span>
          </template>
          <template #sub>
            <p v-if="detail.code_name" class="codename mono">{{ detail.code_name }}</p>
          </template>
        </DetailHead>

        <DetailSection v-if="hasBody" id="overview" :no="noOf('overview') ?? '01'" title="概述" en="Lore">
          <p class="story">{{ bodyText }}</p>
        </DetailSection>

        <DetailSection v-reveal id="props" :no="noOf('props') ?? '01'" title="基础属性" en="Specs">
          <div class="stat-level">
            <div v-if="hasLevels" class="stat-level-head">
              <span class="stat-level-lv mono">Lv.{{ wLevel }}</span>
              <LevelSlider
                v-model="wLevel"
                :min="W_ENGINE_LEVEL_MIN"
                :max="W_ENGINE_LEVEL_MAX"
                label="音擎等级"
                :marks="levelMarks"
              />
            </div>
            <p v-if="hasLevels" class="stat-level-meta mono">
              <span>{{ breakCount === 0 ? '未突破' : `突破 ${breakCount} 阶` }}</span>
            </p>
            <KeyValueGrid :items="propItems" variant="ledger" />
          </div>
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

/* 音擎类型名：标签化与 meta 行其他标签统一（24px 高，2px 圆角） */
.spec {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 9px;
  box-sizing: border-box;
  font-size: 12px;
  letter-spacing: 0.06em;
  border: 1px solid var(--line-1);
  border-radius: 2px;
  color: var(--ink-1);
}

.codename {
  margin-top: 0;
  font-size: 12px;
  letter-spacing: 0.14em;
  color: var(--ink-2);
}

.story {
  color: var(--ink-1);
  font-size: 14px;
  line-height: 1.9;
  max-width: 72ch;
  white-space: pre-line;
}

.desc-list {
  list-style: none;
}

/* ---------- 等级滑条（与 AgentDetailView 基础数值同构） ---------- */

.stat-level {
  border: var(--rule);
  padding: 14px clamp(16px, 2vw, 28px) 12px;
  margin-bottom: var(--space-2);
}

.stat-level-head {
  display: flex;
  align-items: center;
  gap: 18px;
}

.stat-level-lv {
  flex: none;
  font-size: 22px;
  color: var(--amber);
  letter-spacing: 0.04em;
  min-width: 3.2em;
}

.stat-level-meta {
  display: flex;
  gap: 14px;
  margin-top: 8px;
  font-size: 10.5px;
  letter-spacing: 0.14em;
  color: var(--ink-2);
}

.stat-level-meta span:first-child {
  color: var(--amber);
}

.empty {
  font-size: 12.5px;
  letter-spacing: 0.2em;
  color: var(--ink-2);
}
</style>