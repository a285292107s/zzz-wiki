<script setup lang="ts">
import { computed, nextTick, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { iconSources } from '@/data/icons'
import { richDesc } from '@/utils/rich'
import { stripRichText } from '@/utils/text'
import { useRouteParam } from '@/composables/useRouteParam'
import { useDetailResource } from '@/composables/useDetailResource'
import { useDetailNavigation } from '@/composables/useDetailNavigation'
import { usePageMeta } from '@/composables/usePageMeta'
import { buildBangbooSkills, type StatItem } from '@/domain/sections'
import type { BangbooDetail } from '@/data/types'
import { AsyncState, DescRow, DetailHead, DetailSection, KeyValueGrid } from '@/components'
import BackToTop from '@/components/BackToTop.vue'
import Rarity from '@/components/Rarity.vue'

const id = useRouteParam('id')
const { data: detail, status, error } = useDetailResource<BangbooDetail>('bangboo', id)

usePageMeta(() => detail.value?.name ?? undefined)

const portraitSrcs = computed(() =>
  iconSources({ Id: id.value, icon: detail.value?.icon }, 'portrait', 'bangboo'),
)

/* ---------- 基础数值 ---------- */

const STAT_DEFS: Array<[string, (s: Record<string, unknown>) => string | null]> = [
  ['生命值', (s) => (typeof s.hp_max === 'number' ? String(s.hp_max) : null)],
  ['攻击力', (s) => (typeof s.attack === 'number' ? String(s.attack) : null)],
  ['防御力', (s) => (typeof s.defence === 'number' ? String(s.defence) : null)],
  ['冲击力', (s) => (typeof s.break_stun === 'number' ? String(s.break_stun) : null)],
  ['暴击率', (s) => (typeof s.crit === 'number' ? `${(s.crit / 100).toFixed(2)}%` : null)],
  ['暴击伤害', (s) => (typeof s.crit_dmg === 'number' ? `${(s.crit_dmg / 100).toFixed(2)}%` : null)],
  ['异常精通', (s) => (typeof s.element_abnormal_power === 'number' ? String(s.element_abnormal_power) : null)],
  ['能量回复', (s) => (typeof s.endurance === 'number' ? String(s.endurance) : null)],
]

const stats = computed<StatItem[]>(() => {
  const s = detail.value?.stats as Record<string, unknown> | undefined
  if (!s) return []
  return STAT_DEFS.map(([label, fn]) => ({ label, value: fn(s) })).filter(
    (r): r is StatItem => r.value != null,
  )
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
          <KeyValueGrid :items="stats" />
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
</style>
