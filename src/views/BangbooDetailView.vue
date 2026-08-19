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
  bangbooBreakCount,
  bangbooStatsAtLevel,
  BANGBOO_LEVEL_DEFAULT,
  BANGBOO_LEVEL_MAX,
  BANGBOO_LEVEL_MIN,
  buildBangbooSkills,
  type StatItem,
} from '@/domain/sections'
import type { BangbooDetail } from '@/data/types'
import { AsyncState, DescRow, DetailHead, DetailSection, KeyValueGrid, LevelSlider } from '@/components'
import type { LevelMark } from '@/components/detail/LevelSlider.vue'
import BackToTop from '@/components/BackToTop.vue'
import Rarity from '@/components/Rarity.vue'

const id = useRouteParam('id')
const { data: detail, status, error } = useDetailResource<BangbooDetail>('bangboo', id)

usePageMeta(() => detail.value?.name ?? undefined)

const portraitSrcs = computed(() =>
  iconSources({ Id: id.value, icon: detail.value?.icon }, 'portrait', 'bangboo'),
)

/* ---------- 基础数值：等级滑条（默认满级；切换邦布时重置） ---------- */

const bLevel = ref(BANGBOO_LEVEL_DEFAULT)

watch(id, () => {
  bLevel.value = BANGBOO_LEVEL_DEFAULT
})

const stats = computed<StatItem[]>(() =>
  bangbooStatsAtLevel(
    detail.value?.stats,
    detail.value?.level,
    bLevel.value,
  ),
)

const breakCount = computed(() => bangbooBreakCount(bLevel.value))

/** 突破刻度：1 起点 + 10/20/30/40/50 突破点（amber）+ 60 上限（灰） */
const levelMarks = computed<LevelMark[]>(() => {
  const marks: LevelMark[] = [{ at: BANGBOO_LEVEL_MIN, label: String(BANGBOO_LEVEL_MIN) }]
  for (let lv = 10; lv <= BANGBOO_LEVEL_MAX; lv += 10) {
    marks.push({ at: lv, label: String(lv), break: lv < BANGBOO_LEVEL_MAX })
  }
  return marks
})

/* ---------- 技能 ---------- */

const skills = computed(() => buildBangbooSkills(detail.value?.skill))

/* ---------- 区块导航 + scrollspy + reveal ---------- */

const navItems = computed(() => {
  const items = [{ id: 'stats', no: '01', label: '基础数值' }]
  if (skills.value.length) items.push({ id: 'skills', no: '02', label: '技能' })
  return items
})

const { activeSection, revealDir, activate } = useDetailNavigation()
const vReveal = revealDir
const noOf = (id: string) => navItems.value.find((n) => n.id === id)?.no

/** 404 时返回邦布名录 */
const backTo = computed(() => (detail.value ? undefined : '/bangboos'))

watch(status, (s) => {
  if (s !== 'success') return
  nextTick(() => activate(navItems.value.map((n) => n.id)))
})
</script>

<template>
  <div class="wrap page">
    <RouterLink to="/bangboos" class="back mono">← 返回邦布名录</RouterLink>

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
          :eyebrow="`Bangboo · ${String(id).padStart(5, '0')}`"
          :title="detail.name ?? '—'"
          :portrait-srcs="portraitSrcs"
          :alt="detail.name ?? ''"
          :fallback="detail.name ?? '—'"
          position="top"
          ratio="1 / 1"
        >
          <template #meta>
            <Rarity :rank="detail.rarity" />
          </template>
          <template #sub>
            <p v-if="detail.code_name" class="codename mono">{{ detail.code_name }}</p>
            <p v-if="detail.desc" class="tagline">{{ stripRichText(detail.desc) }}</p>
          </template>
        </DetailHead>

        <DetailSection id="stats" :no="noOf('stats') ?? '01'" title="基础数值" en="Vitals">
          <div class="stat-level">
            <div class="stat-level-head">
              <span class="stat-level-lv mono">Lv.{{ bLevel }}</span>
              <LevelSlider
                v-model="bLevel"
                :min="BANGBOO_LEVEL_MIN"
                :max="BANGBOO_LEVEL_MAX"
                label="邦布等级"
                :marks="levelMarks"
              />
            </div>
            <p class="stat-level-meta mono">
              <span>{{ breakCount === 0 ? '未突破' : `突破 ${breakCount} 阶` }}</span>
            </p>
            <KeyValueGrid :items="stats" variant="ledger" />
          </div>
        </DetailSection>

        <DetailSection v-if="skills.length" v-reveal id="skills" :no="noOf('skills') ?? '01'" title="技能" en="Skills">
          <div v-for="sk in skills" :key="sk.key" class="skill-group">
            <div class="skill-kind-row">
              <span class="slot mono">{{ sk.key.toUpperCase() }}</span>
              <h3 class="skill-kind serif">{{ sk.zh }}</h3>
            </div>
            <div class="desc-list">
              <DescRow
                :no="'01'"
                :title="sk.names[0] || sk.zh"
                :html="richDesc(sk.desc)"
                variant="skill"
              />
            </div>
          </div>
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

.codename {
  font-size: 12px;
  letter-spacing: 0.14em;
  color: var(--ink-2);
  margin-bottom: 6px;
}

.tagline {
  color: var(--ink-1);
  font-size: 14px;
  line-height: 1.8;
  max-width: 56ch;
}

.skill-group {
  margin-bottom: var(--space-group);
}

.skill-kind-row {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: var(--space-1);
}

.slot {
  font-size: 11px;
  letter-spacing: 0.18em;
  color: var(--ink-3);
  border: 1px solid var(--line-1);
  border-radius: 2px;
  padding: 2px 8px;
}

.skill-kind {
  font-size: 16.5px;
  font-weight: 500;
  color: var(--amber);
}

.desc-list {
  list-style: none;
}

/* ---------- 等级滑条（与 WEngineDetailView / AgentDetailView 同构） ---------- */

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
</style>
