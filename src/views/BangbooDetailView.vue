<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { api } from '@/data/api'
import { iconSources } from '@/data/icons'
import { richDesc } from '@/utils/rich'
import { stripRichText } from '@/utils/text'
import { useRouteParam } from '@/composables/useRouteParam'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useDetailNavigation } from '@/composables/useDetailNavigation'
import { usePageMeta } from '@/composables/usePageMeta'
import {
  bangbooBreakCount,
  bangbooSkillStatValue,
  bangbooStatsAtLevel,
  BANGBOO_LEVEL_DEFAULT,
  BANGBOO_LEVEL_MAX,
  BANGBOO_LEVEL_MIN,
  buildBangbooSkills,
  type BangbooSkillRow,
  type StatItem,
} from '@/domain/sections'
import type { BangbooDetail } from '@/data/types'
import { AsyncState, DetailHead, DetailSection, KeyValueGrid, LevelSlider } from '@/components'
import type { LevelMark } from '@/components/detail/LevelSlider.vue'
import BackToTop from '@/components/BackToTop.vue'
import Rarity from '@/components/Rarity.vue'

const id = useRouteParam('id')
const { data: detail, status, error } = useAsyncResource(() => api.detail<BangbooDetail>('bangboo', id.value))

usePageMeta(() => detail.value?.name ?? undefined)

const portraitSrcs = computed(() =>
  iconSources({ Id: id.value, icon: detail.value?.icon }, 'bangboo'),
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

/* ---------- 技能（含 skill_prop 数值，随技能等级展示） ---------- */

const skills = computed<BangbooSkillRow[]>(() =>
  buildBangbooSkills(detail.value?.skill, detail.value?.skill_prop),
)

/** 各技能独立的查看等级（默认满级；切换邦布时重置） */
const skillLevels = reactive<Record<string, number>>({})

watch(skills, (rows) => {
  for (const r of rows) if (skillLevels[r.key] == null) skillLevels[r.key] = r.levelCount
}, { immediate: true })

watch(id, () => {
  for (const k of Object.keys(skillLevels)) delete skillLevels[k]
})

const skillLevel = (k: string) => skillLevels[k] ?? 1
const skillDesc = (sk: BangbooSkillRow) =>
  sk.descs[skillLevel(sk.key) - 1] ?? sk.descs[0] ?? ''

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
              <span class="key-glyph" aria-hidden="true">
                <i class="glyph mono">{{ sk.key.toUpperCase() }}</i>
              </span>
              <h3 class="skill-kind serif">{{ sk.zh }}</h3>
              <div v-if="sk.stats.length" class="level-row">
                <LevelSlider
                  :model-value="skillLevel(sk.key)"
                  :min="1"
                  :max="sk.levelCount"
                  :label="`${sk.zh}等级`"
                  @update:model-value="skillLevels[sk.key] = $event"
                />
                <span class="level-val mono">Lv.{{ skillLevel(sk.key) }}</span>
              </div>
            </div>
            <ul class="action-list">
              <li class="row">
                <span class="no mono">01</span>
                <div class="body">
                  <h4 class="title title-skill">{{ sk.names[0] || sk.zh }}</h4>
                  <p class="desc" v-html="richDesc(skillDesc(sk))"></p>
                  <ul v-if="sk.stats.length" class="stat-list">
                    <li v-for="(st, si) in sk.stats" :key="si" class="stat-item">
                      <span class="stat-name">{{ st.name }}</span>
                      <span class="stat-val mono">{{ bangbooSkillStatValue(sk, si, skillLevel(sk.key)) }}</span>
                    </li>
                  </ul>
                </div>
              </li>
            </ul>
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
  /* 招式行标签列宽度 + 间距 = 正文缩进，供水平对齐统一使用（与角色详情 SkillGroup 同构） */
  --label-col: 36px;
  --row-gap: 14px;
  --body-left: calc(var(--label-col) + var(--row-gap));
  margin-bottom: var(--space-group);
}

.skill-kind-row {
  display: flex;
  align-items: center;
  gap: var(--row-gap);
  margin-bottom: 8px;
  flex-wrap: wrap;
  row-gap: 10px;
}

.key-glyph {
  width: 40px;
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}

/* 槽位方框（邦布无技能图标素材，以等宽字母占位；与角色页 38px 图标位同尺寸） */
.glyph {
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border: 1px solid var(--line-1);
  border-radius: 2px;
  font-size: 16px;
  font-style: normal;
  color: var(--amber);
}

.skill-kind {
  font-size: 16.5px;
  font-weight: 500;
  color: var(--amber);
}

/* 招式明细行：序号列 + 正文（与角色详情 SkillGroup 同构） */

.action-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.row {
  display: grid;
  grid-template-columns: var(--label-col) 1fr;
  gap: var(--row-gap);
  padding: var(--space-2) 4px;
  border-bottom: var(--rule);
}

.no {
  color: var(--ink-3);
  font-size: 12px;
  padding-top: 2px;
}

.body {
  min-width: 0;
}

.title {
  font-weight: 500;
  font-size: 15.5px;
  line-height: 1.4;
  margin-bottom: 6px;
  color: var(--ink-0);
}

.desc {
  color: var(--ink-1);
  font-size: 13.5px;
  line-height: 1.8;
  max-width: 76ch;
  white-space: pre-line;
  margin-bottom: 10px;
}

.desc :deep(.rich-key) {
  display: inline-block;
  width: 1.15em;
  height: 1.15em;
  margin: 0 0.1em;
  vertical-align: -0.22em;
  border-radius: 1px;
  line-height: 0;
}

.desc :deep(.rich-key svg) {
  display: block;
  width: 100%;
  height: 100%;
}

/* ---------- 技能数值（与 SkillGroup 同构：等级滑条 + 点线条目） ---------- */

.level-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
  flex: 1 1 240px;
  min-width: 200px;
  max-width: 420px;
}
/* 滑条本体样式见 LevelSlider.vue（发丝线轨道 + 方形钮），共用 */

.level-val {
  font-size: 12px;
  color: var(--amber);
  min-width: 3.4em;
  text-align: right;
}

.stat-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-width: 420px;
}

.stat-item {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding: 6px 0;
  color: var(--ink-1);
  font-size: 13.5px;
  border-top: 1px dashed var(--line-0);
}

.stat-item:first-child {
  border-top: none;
  padding-top: 2px;
}

.stat-name {
  min-width: 0;
}

.stat-val {
  flex: none;
  color: var(--amber);
  font-size: 13px;
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
