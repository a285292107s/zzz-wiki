<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { iconSources } from '@/data/icons'
import { richDesc } from '@/utils/rich'
import { stripRichText } from '@/utils/text'
import { useRouteParam } from '@/composables/useRouteParam'
import { useDetailResource } from '@/composables/useDetailResource'
import {
  buildSkillRows,
  buildSkinRows,
  dictToRows,
  type DetailRow,
  type SkillRow,
  type SkinRow,
  type StatItem,
} from '@/domain/sections'
import type { AttrCode, SpecCode } from '@/data/types'
import type { CharacterDetail } from '@/data/types'
import { AsyncState, DescRow, DetailHead, DetailSection, KeyValueGrid } from '@/components'
import Tags from '@/components/Tags.vue'
import Rarity from '@/components/Rarity.vue'
import HollowImage from '@/components/HollowImage.vue'
import SkillIcon from '@/components/SkillIcon.vue'

const id = useRouteParam('id')
const { data: detail, status, error } = useDetailResource<CharacterDetail>('character', id)

const attrCode = computed<AttrCode | null>(() => {
  const el = detail.value?.element_type
  const key = el ? Object.keys(el)[0] : null
  return key ? (Number(key) as AttrCode) : null
})

const specCode = computed<SpecCode | null>(() => {
  const w = detail.value?.weapon_type
  const key = w ? Object.keys(w)[0] : null
  return key ? (Number(key) as SpecCode) : null
})

const campName = computed(() => {
  const c = detail.value?.camp
  const key = c ? Object.keys(c)[0] : null
  return key && c ? String(c[key]) : null
})

const info = computed(() => detail.value?.partner_info ?? null)

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

const skills = computed<SkillRow[]>(() => buildSkillRows(detail.value?.skill))
const talents = computed<DetailRow[]>(() => dictToRows(detail.value?.talent))
const skinList = computed<SkinRow[]>(() => buildSkinRows(detail.value?.skin))

const portraitSrcs = computed(() =>
  iconSources({ Id: detail.value?.id, icon: detail.value?.icon }, 'portrait', 'character'),
)
</script>

<template>
  <div class="wrap page">
    <RouterLink to="/agents" class="back mono">← 返回名录</RouterLink>

    <AsyncState :status="status" :error="error">
      <template v-if="detail">
        <DetailHead
          :eyebrow="`Agent · ${String(id).padStart(4, '0')}`"
          :title="detail.name ?? '—'"
          :portrait-srcs="portraitSrcs"
          :alt="detail.name ?? ''"
          :fallback="detail.name ?? '—'"
          position="top"
          ratio="3 / 4"
        >
          <template #meta>
            <Rarity :rank="detail.rarity" />
            <Tags :element="attrCode" :specialty="specCode" />
            <span v-if="campName" class="camp">{{ campName }}</span>
          </template>
          <template #sub>
            <p v-if="info?.profile_desc" class="profile">{{ stripRichText(info.profile_desc) }}</p>
          </template>
        </DetailHead>

        <DetailSection no="01" title="基础数值">
          <KeyValueGrid :items="stats" />
        </DetailSection>

        <DetailSection v-if="skills.length" no="02" title="技能">
          <div v-for="sk in skills" :key="sk.key" class="skill-group">
            <div class="skill-kind-row">
              <span class="key-glyph">
                <SkillIcon :slot="sk.key" :size="38" />
                <em class="mono">{{ sk.keyEn }}</em>
              </span>
              <h3 class="skill-kind serif">{{ sk.zh }}</h3>
            </div>
            <ul v-if="sk.descriptions?.length" class="desc-list">
              <DescRow
                v-for="(d, i) in sk.descriptions"
                :key="i"
                :no="String(i + 1).padStart(2, '0')"
                :title="d.name ?? '—'"
                :html="richDesc(d.desc)"
                variant="skill"
              />
            </ul>
          </div>
        </DetailSection>

        <DetailSection v-if="talents.length" no="03" title="影画">
          <ul class="desc-list">
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

        <DetailSection v-if="skinList.length > 1" no="04" title="皮肤">
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
      </template>
    </AsyncState>
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

.camp {
  font-size: 12px;
  letter-spacing: 0.1em;
  color: var(--ink-1);
}

.profile {
  margin-top: 8px;
  color: var(--ink-1);
  font-size: 14px;
  line-height: 1.8;
  max-width: 56ch;
}

/* ---------- skills ---------- */

.skill-group {
  margin-bottom: 26px;
}

.skill-kind-row {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 6px;
}

.key-glyph {
  width: 40px;
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}

.key-glyph em {
  font-style: normal;
  font-size: 8px;
  letter-spacing: 0.14em;
  color: var(--ink-3);
}

.skill-kind {
  font-size: 16.5px;
  font-weight: 500;
  color: var(--amber);
}

.desc-list {
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

@media (max-width: 860px) {
  .head {
    flex-direction: column-reverse;
  }
}
</style>