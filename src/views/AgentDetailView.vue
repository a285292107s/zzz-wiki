<script setup lang="ts">
import { computed, nextTick, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { iconSources, skillIconSources, type SkillSlot } from '@/data/icons'
import { stripRichText } from '@/utils/text'
import { useRouteParam } from '@/composables/useRouteParam'
import { useDetailResource } from '@/composables/useDetailResource'
import { useDetailNavigation } from '@/composables/useDetailNavigation'
import { usePageMeta } from '@/composables/usePageMeta'
import {
  buildSkillRows,
  buildSkinRows,
  dictToRows,
  SKILL_KEYS,
  type DetailRow,
  type SkillRow,
  type SkinRow,
  type StatItem,
} from '@/domain/sections'

interface SkillDisplay extends SkillRow {
  glyph: string
  srcs: string[]
}
import type { CharacterDetail } from '@/data/types'
import { AsyncState, AgentHead, DescRow, DetailSection, KeyValueGrid, SkillGroup } from '@/components'
import BackToTop from '@/components/BackToTop.vue'
import HollowImage from '@/components/HollowImage.vue'

const id = useRouteParam('id')
const { data: detail, status, error } = useDetailResource<CharacterDetail>('character', id)

usePageMeta(() => detail.value?.name ?? undefined)

type StatCell = number | string | unknown[]

function num(s: Record<string, StatCell>, key: string): number | null {
  const v = s[key]
  return typeof v === 'number' ? v : null
}

/* stats: raw ints, percentage fields are raw-value/100 → percent */
const STAT_DEFS: Array<[string, (s: Record<string, StatCell>) => string | null]> = [
  ['生命值', (s) => (num(s, 'hp_max') != null ? String(num(s, 'hp_max')) : null)],
  ['攻击力', (s) => (num(s, 'attack') != null ? String(num(s, 'attack')) : null)],
  ['防御力', (s) => (num(s, 'defence') != null ? String(num(s, 'defence')) : null)],
  ['冲击力', (s) => (num(s, 'break_stun') != null ? String(num(s, 'break_stun')) : null)],
  ['暴击率', (s) => (num(s, 'crit') != null ? `${(num(s, 'crit')! / 100).toFixed(2)}%` : null)],
  ['暴击伤害', (s) => (num(s, 'crit_damage') != null ? `${(num(s, 'crit_damage')! / 100).toFixed(2)}%` : null)],
  ['穿透率', (s) => (num(s, 'pen_rate') != null ? `${(num(s, 'pen_rate')! / 100).toFixed(2)}%` : null)],
  ['异常掌控', (s) => (num(s, 'element_mystery') != null ? String(num(s, 'element_mystery')) : null)],
  ['异常精通', (s) => (num(s, 'element_abnormal_power') != null ? String(num(s, 'element_abnormal_power')) : null)],
  ['能量回复', (s) => (num(s, 'sp_recover') != null ? String(num(s, 'sp_recover')) : null)],
]

const stats = computed<StatItem[]>(() => {
  const s = detail.value?.stats
  if (!s) return []
  return STAT_DEFS.map(([label, fn]) => ({ label, value: fn(s) })).filter(
    (r): r is StatItem => r.value != null,
  )
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
  if (skinList.value.length > 1) items.push({ id: 'skins', no: '04', label: '皮肤' })
  if (hasImpressions.value) items.push({ id: 'impressions', no: '05', label: '绳网印象' })
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
          <KeyValueGrid :items="stats" variant="ledger" />
        </DetailSection>

        <DetailSection v-if="skills.length" v-reveal id="skills" no="02" title="技能" en="Skills">
          <SkillGroup
            v-for="sk in skills"
            :key="sk.key"
            :row="sk"
            :glyph="sk.glyph"
            :srcs="sk.srcs"
          />
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

        <DetailSection v-if="skinList.length > 1" v-reveal id="skins" no="04" title="皮肤" en="Outfits">
          <ul class="skin-list">
            <li v-for="s in skinList" :key="s.id" class="skin">
              <span class="skin-thumb">
                <HollowImage
                  :srcs="iconSources({ icon: s.img }, 'list', 'character')"
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
          no="05"
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
