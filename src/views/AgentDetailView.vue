<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { api } from '@/data/api'
import { iconSources, skillIconSources, type SkillSlot } from '@/data/icons'
import { stripRichText } from '@/utils/text'
import { useRouteParam } from '@/composables/useRouteParam'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useDetailNavigation } from '@/composables/useDetailNavigation'
import { usePageMeta } from '@/composables/usePageMeta'
import {
  buildCoreEnhance,
  buildCoreSkill,
  buildPotentialCinema,
  buildSkillRows,
  buildSkinRows,
  CHAR_LEVEL_DEFAULT,
  CHAR_LEVEL_MAX,
  CHAR_LEVEL_MIN,
  charBreakSegment,
  characterStatsAtLevel,
  dictToRows,
  SKILL_KEYS,
  type CoreEnhanceLevel,
  type CoreSkill,
  type DetailRow,
  type PotentialCinema,
  type SkillRow,
  type SkinRow,
  type StatItem,
} from '@/domain/sections'

interface SkillDisplay extends SkillRow {
  glyph: string
  srcs: string[]
}
import type { CharacterDetail } from '@/data/types'
import { AsyncState, AgentHead, CoreSkillGroup, DescRow, DetailSection, KeyValueGrid, LevelSlider, SkillGroup } from '@/components'
import type { LevelMark } from '@/components/detail/LevelSlider.vue'
import BackToTop from '@/components/BackToTop.vue'
import HollowImage from '@/components/HollowImage.vue'

const id = useRouteParam('id')
const { data: detail, status, error } = useAsyncResource(() => api.detail<CharacterDetail>('character', id.value))

usePageMeta(() => detail.value?.name ?? undefined)

/* ---------- 基础数值：等级滑条 ---------- */

/** 当前查看等级（默认满级，与技能滑块默认一致）；切换角色时重置 */
const charLevel = ref(CHAR_LEVEL_DEFAULT)

watch(id, () => {
  charLevel.value = CHAR_LEVEL_DEFAULT
})

/** 该等级下的基础面板（等级 + 突破成长；潜能为独立养成系统，不随等级并入） */
const stats = computed<StatItem[]>(() =>
  characterStatsAtLevel(
    detail.value?.stats,
    detail.value?.level,
    charLevel.value,
  ),
)

/** 当前等级所属突破段（meta 行） */
const breakPhase = computed(() =>
  charBreakSegment(detail.value?.level, charLevel.value),
)

/** 突破计数（段号-1）：段 1 = 未突破，段 6 = 突破 5 次满 */
const breakCount = computed(() =>
  breakPhase.value ? Math.max(0, breakPhase.value.phase - 1) : null,
)

/** 突破刻度：1 起点 + 10/20/30/40/50 突破点（amber）+ 60 上限（灰） */
const levelMarks = computed<LevelMark[]>(() => {
  const marks: LevelMark[] = [{ at: 1, label: '1' }]
  for (let lv = 10; lv <= 60; lv += 10) {
    marks.push({ at: lv, label: String(lv), break: lv < 60 })
  }
  return marks
})

const skills = computed<SkillDisplay[]>(() =>
  buildSkillRows(detail.value?.skill).map((sk) => ({
    ...sk,
    glyph: SKILL_KEYS[sk.key]?.glyph ?? '□',
    srcs: skillIconSources(sk.key as SkillSlot),
  })),
)

const talents = computed<DetailRow[]>(() => dictToRows(detail.value?.talent))
const skinList = computed<SkinRow[]>(() => buildSkinRows(detail.value?.skin))

/** 核心技（核心被动 + 额外能力，passive 数据源） */
const coreSkill = computed<CoreSkill | null>(() => buildCoreSkill(detail.value?.passive))

/** 核心技强化档位（extra_level 数据源，A-F） */
const coreEnhance = computed<CoreEnhanceLevel[]>(() =>
  buildCoreEnhance(detail.value?.extra_level),
)

/** 潜能影画档位（potential_detail 数据源，V2.5 激发潜能） */
const potentialCinema = computed<PotentialCinema[]>(() =>
  buildPotentialCinema(detail.value?.potential_detail),
)

/* ---------- 绳网印象（partner_info 网络引语） ---------- */

const impressions = computed<string[]>(() =>
  (detail.value?.partner_info?.impressions ?? [])
    .map((t) => stripRichText(t))
    .filter(Boolean),
)

const voices = computed<string[]>(() => {
  const i = detail.value?.partner_info
  if (!i) return []
  return [i.impression_f, i.impression_m]
    .filter((t): t is string => !!t)
    .map((t) => stripRichText(t))
})

const hasImpressions = computed(
  () => impressions.value.length > 0 || voices.value.length > 0,
)

/* ---------- 区块导航（条件区块）+ scrollspy + reveal ---------- */

const navItems = computed(() => {
  const items = [{ id: 'stats', no: '01', label: '基础数值' }]
  if (skills.value.length) items.push({ id: 'skills', no: '02', label: '技能' })
  if (talents.value.length) items.push({ id: 'talents', no: '03', label: '影画' })
  if (potentialCinema.value.length) items.push({ id: 'potential', no: '04', label: '潜能影画' })
  let no = 5
  if (skinList.value.length > 1) items.push({ id: 'skins', no: String(no++), label: '皮肤' })
  if (hasImpressions.value) items.push({ id: 'impressions', no: String(no), label: '绳网印象' })
  return items
})

const { activeSection, revealDir, activate } = useDetailNavigation()
const vReveal = revealDir

/** 404 时返回名录 */
const backTo = computed(() => (detail.value ? undefined : '/agents'))

watch(status, (s) => {
  if (s !== 'success') return
  nextTick(() => activate(navItems.value.map((n) => n.id)))
})
</script>

<template>
  <div class="wrap page">
    <RouterLink to="/agents" class="back mono">← 返回名录</RouterLink>

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
        <AgentHead :detail="detail" />

        <DetailSection id="stats" no="01" title="基础数值" en="Vitals">
          <div class="stat-level">
            <div class="stat-level-head">
              <span class="stat-level-lv mono">Lv.{{ charLevel }}</span>
              <LevelSlider
                v-model="charLevel"
                :min="CHAR_LEVEL_MIN"
                :max="CHAR_LEVEL_MAX"
                label="角色等级"
                :marks="levelMarks"
              />
            </div>
            <p v-if="breakCount != null" class="stat-level-meta mono">
              <span>
                {{ breakCount === 0 ? '未突破' : `突破 ${breakCount} 阶` }}
              </span>
            </p>
          </div>
          <KeyValueGrid :items="stats" variant="ledger" />
        </DetailSection>

        <DetailSection v-if="skills.length || coreSkill" v-reveal id="skills" no="02" title="技能" en="Skills">
          <SkillGroup
            v-for="sk in skills"
            :key="sk.key"
            :row="sk"
            :glyph="sk.glyph"
            :srcs="sk.srcs"
          />
          <!-- 核心技（核心被动 + 额外能力）：passive 数据源，等级滑条切换 -->
          <CoreSkillGroup v-if="coreSkill" :row="coreSkill" :enhance="coreEnhance" />
        </DetailSection>

        <DetailSection v-if="talents.length" v-reveal id="talents" no="03" title="影画" en="Mindscape">
          <ul class="talents-list">
            <DescRow
              v-for="t in talents"
              :key="t.no"
              :no="String(t.no).padStart(2, '0')"
              :title="t.name ?? '未命名'"
              :text="stripRichText(t.desc)"
              variant="talent"
            />
          </ul>
        </DetailSection>

        <DetailSection
          v-if="potentialCinema.length"
          v-reveal
          id="potential"
          no="04"
          title="潜能影画"
          en="Potential"
        >
          <ul class="talents-list">
            <DescRow
              v-for="p in potentialCinema"
              :key="p.no"
              :no="p.no"
              :title="p.label"
              :text="p.desc ? stripRichText(p.desc) : undefined"
              variant="talent"
            />
          </ul>
        </DetailSection>

        <DetailSection v-if="skinList.length > 1" v-reveal id="skins" no="05" title="皮肤" en="Outfits">
          <ul class="skin-list">
            <li v-for="s in skinList" :key="s.id" class="skin">
              <span class="skin-thumb">
                <HollowImage
                  :srcs="iconSources({ icon: s.img }, 'character')"
                  :alt="s.name"
                  :fallback="s.name"
                  position="top"
                />
              </span>
              <div class="skin-info">
                <h3 class="skin-name serif">{{ s.name || '—' }}</h3>
                <p v-if="s.desc" class="skin-desc">{{ stripRichText(s.desc) }}</p>
              </div>
            </li>
          </ul>
        </DetailSection>

        <DetailSection
          v-if="hasImpressions"
          v-reveal
          id="impressions"
          no="06"
          title="绳网印象"
          en="Inter-Knot"
        >
          <ul class="im-list">
            <li v-for="(t, i) in impressions" :key="i" class="im-row">
              <span class="no mono">{{ String(i + 1).padStart(2, '0') }}</span>
              <p class="im-text">{{ t }}</p>
            </li>
          </ul>
          <div v-if="voices.length" class="voices">
            <figure v-for="(v, i) in voices" :key="i" class="voice">
              <blockquote class="serif">「{{ v }}」</blockquote>
              <figcaption class="mono">VOICE · {{ String(i + 1).padStart(2, '0') }}</figcaption>
            </figure>
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

/* ---------- 基础数值：等级滑条 ---------- */

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

/* ---------- talents ---------- */

.talents-list {
  list-style: none;
}

/* ---------- skins ---------- */

.skin-list {
  list-style: none;
}

.skin {
  display: grid;
  grid-template-columns: 104px 1fr;
  align-items: start;
  gap: 16px;
  padding: 14px 4px;
  border-bottom: var(--rule);
}

.skin-thumb {
  width: 96px;
  height: 96px;
  display: block;
}

.skin-thumb :deep(.frame) {
  border-radius: 2px;
}

.skin-info {
  min-width: 0;
}

.skin-name {
  font-size: 15.5px;
  font-weight: 500;
  color: var(--ink-0);
  line-height: 1.4;
  margin-bottom: 6px;
}

.skin-desc {
  font-size: 12.5px;
  color: var(--ink-2);
  line-height: 1.7;
  max-width: 76ch;
}

/* ---------- 绳网印象 ---------- */

.im-list {
  list-style: none;
}

.im-row {
  display: grid;
  grid-template-columns: 36px 1fr;
  gap: 14px;
  padding: 14px 4px;
  border-bottom: var(--rule);
}

.im-row .no {
  color: var(--ink-3);
  font-size: 12px;
  padding-top: 3px;
}

.im-text {
  color: var(--ink-1);
  font-size: 13.5px;
  line-height: 1.85;
  max-width: 76ch;
  white-space: pre-line;
}

.voices {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  gap: 24px;
  margin-top: 30px;
}

.voice {
  border-left: 1px solid var(--line-2);
  padding-left: 18px;
}

.voice blockquote {
  font-size: 15px;
  color: var(--ink-0);
  line-height: 1.9;
}

.voice figcaption {
  margin-top: 10px;
  font-size: 10px;
  letter-spacing: 0.2em;
  color: var(--amber);
}
</style>
