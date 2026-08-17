<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { api } from '@/data/api'
import { iconSources } from '@/data/icons'
import { stripRichText } from '@/utils/text'
import { richDesc } from '@/utils/rich'
import type { AttrCode, SpecCode } from '@/data/types'
import type { CharacterDetail } from '@/data/types'
import Tags from '@/components/Tags.vue'
import Rarity from '@/components/Rarity.vue'
import HollowImage from '@/components/HollowImage.vue'
import SkillIcon from '@/components/SkillIcon.vue'

const route = useRoute()
const detail = ref<CharacterDetail | null>(null)
const loaded = ref(false)
const error = ref<string | null>(null)

const id = computed(() => String(route.params.id))

watchEffect(async () => {
  loaded.value = false
  error.value = null
  try {
    detail.value = await api.character(id.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loaded.value = true
  }
})

const attrCode = computed<AttrCode | null>(() => {
  const el = detail.value?.element_type
  if (!el) return null
  const key = Object.keys(el)[0]
  return key ? (Number(key) as AttrCode) : null
})

const specCode = computed<SpecCode | null>(() => {
  const w = detail.value?.weapon_type
  if (!w) return null
  const key = Object.keys(w)[0]
  return key ? (Number(key) as SpecCode) : null
})

const info = computed(() => detail.value?.partner_info ?? null)

/* stats: raw ints, percentage fields are raw-value/100 → percent */
const STAT_DEFS: Array<[string, (s: Record<string, number>) => string | null]> = [
  ['生命值', (s) => (s.hp_max != null ? String(s.hp_max) : null)],
  ['攻击力', (s) => (s.attack != null ? String(s.attack) : null)],
  ['防御力', (s) => (s.defence != null ? String(s.defence) : null)],
  ['冲击力', (s) => (s.break_stun != null ? String(s.break_stun) : null)],
  ['暴击率', (s) => (s.crit != null ? `${(s.crit / 100).toFixed(2)}%` : null)],
  ['暴击伤害', (s) => (s.crit_damage != null ? `${(s.crit_damage / 100).toFixed(2)}%` : null)],
  ['穿透率', (s) => (s.pen_rate != null ? `${(s.pen_rate / 100).toFixed(2)}%` : null)],
  ['异常掌控', (s) => (s.element_mystery != null ? String(s.element_mystery) : null)],
  ['异常精通', (s) => (s.element_abnormal_power != null ? String(s.element_abnormal_power) : null)],
  ['能量回复', (s) => (s.sp_recover != null ? String(s.sp_recover) : null)],
]

const stats = computed(() => {
  const s = detail.value?.stats
  if (!s) return []
  return STAT_DEFS.map(([label, fn]) => ({ label, value: fn(s) })).filter(
    (r) => r.value != null,
  )
})

/** skill dict is keyed by type; display order follows game UI */
const SKILL_ORDER = ['basic', 'dodge', 'special', 'chain', 'assist', 'core'] as const

const SKILL_ZH: Record<string, string> = {
  basic: '普通攻击',
  dodge: '闪避',
  special: '特殊技',
  chain: '连携技',
  assist: '支援技',
  core: '核心技',
}

/** 技能键位纹章：等宽键名 */
const SKILL_KEYS: Record<string, { en: string }> = {
  basic:   { en: 'NORMAL' },
  dodge:   { en: 'DODGE' },
  special: { en: 'SPECIAL' },
  chain:   { en: 'CHAIN' },
  assist:  { en: 'ASSIST' },
  core:    { en: 'CORE' },
}

const skills = computed(() => {
  const sk = detail.value?.skill
  if (!sk) return []
  return SKILL_ORDER.filter((k) => sk[k] != null).map((k) => ({
    key: k,
    zh: SKILL_ZH[k] ?? k,
    keyEn: SKILL_KEYS[k]?.en ?? k.toUpperCase(),
    descriptions: (sk[k] as { description?: unknown })?.description as
      | Array<{ name?: string; desc?: string }>
      | undefined,
  }))
})

const talents = computed<TalentRow[]>(() => {
  const t = detail.value?.talent
  if (!t) return []
  return Object.entries(t)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([k, v]) => ({
      no: Number(k),
      name: (v as { name?: string }).name,
      desc: (v as { desc?: string }).desc,
    }))
})

const campName = computed(() => {
  const c = detail.value?.camp
  if (!c) return null
  const key = Object.keys(c)[0]
  return key ? String(c[key]) : null
})

/** 皮肤：按 skinId 排序，含默认与替换时装 */
const skinList = computed(() => {
  const m = detail.value?.skin
  if (!m) return []
  return Object.entries(m)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([k, v]) => ({
      id: k,
      name: (v as { name?: string }).name ?? '',
      desc: (v as { desc?: string }).desc ?? '',
      img: (v as { image?: string }).image ?? '',
    }))
})

interface TalentRow {
  no: number
  name?: string
  desc?: string
}
</script>

<template>
  <div class="wrap page">
    <RouterLink to="/agents" class="back mono">← 返回名录</RouterLink>

    <p v-if="error" class="err mono">⚠ 数据加载失败：{{ error }}</p>
    <p v-else-if="!loaded" class="loading mono">LOADING…</p>

    <template v-else-if="detail">
      <header class="head">
        <div class="id-block">
          <p class="eyebrow mono">Agent · {{ String(id).padStart(4, '0') }}</p>
          <h1 class="page-title">{{ detail.name }}</h1>
          <div class="meta">
            <Rarity :rank="detail.rarity" />
            <Tags :element="attrCode" :specialty="specCode" />
            <span v-if="campName" class="camp">{{ campName }}</span>
          </div>
          <p v-if="info?.profile_desc" class="profile">{{ stripRichText(info.profile_desc) }}</p>
        </div>

        <div class="portrait">
          <HollowImage
            :srcs="iconSources({ Id: detail.id, icon: detail.icon }, 'portrait', 'character')"
            :alt="detail.name"
            :fallback="detail.name"
            position="top"
            :ratio="'3 / 4'"
          />
        </div>
      </header>

      <section class="block">
        <div class="section-head">
          <span class="no mono">01</span>
          <h2>基础数值</h2>
          <span class="rule" />
        </div>
        <div class="stat-grid">
          <div v-for="row in stats" :key="row.label" class="stat">
            <span class="k">{{ row.label }}</span>
            <span class="v mono">{{ row.value }}</span>
          </div>
        </div>
      </section>

      <section v-if="skills.length" class="block">
        <div class="section-head">
          <span class="no mono">02</span>
          <h2>技能</h2>
          <span class="rule" />
        </div>
        <div v-for="sk in skills" :key="sk.key" class="skill-group">
          <div class="skill-kind-row">
            <span class="key-glyph">
              <SkillIcon :slot="sk.key" :size="38" />
              <em class="mono">{{ sk.keyEn }}</em>
            </span>
            <h3 class="skill-kind serif">{{ sk.zh }}</h3>
          </div>
          <ul v-if="sk.descriptions?.length" class="skill-list">
            <li v-for="(d, i) in sk.descriptions" :key="i" class="skill">
              <span class="skill-no mono">{{ String(i + 1).padStart(2, '0') }}</span>
              <div class="skill-body">
                <h4 class="skill-name">{{ d.name ?? '—' }}</h4>
                <p v-if="d.desc" class="desc" v-html="richDesc(d.desc)"></p>
              </div>
            </li>
          </ul>
        </div>
      </section>

      <section v-if="talents.length" class="block">
        <div class="section-head">
          <span class="no mono">03</span>
          <h2>影画</h2>
          <span class="rule" />
        </div>
        <ul class="talent-list">
          <li v-for="t in talents" :key="t.no" class="talent">
            <span class="talent-no mono">{{ String(t.no).padStart(2, '0') }}</span>
            <div>
              <h3 class="serif">{{ t.name ?? '未命名' }}</h3>
              <p v-if="t.desc" class="desc">{{ stripRichText(t.desc) }}</p>
            </div>
          </li>
        </ul>
      </section>

      <section v-if="skinList.length > 1" class="block">
        <div class="section-head">
          <span class="no mono">04</span>
          <h2>皮肤</h2>
          <span class="rule" />
        </div>
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
      </section>
    </template>
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

/* ---------- head ---------- */

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 40px;
  margin-bottom: calc(var(--pad-section) * 0.8);
}

.meta {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 18px;
  flex-wrap: wrap;
}

.camp {
  font-size: 12px;
  letter-spacing: 0.1em;
  color: var(--ink-1);
}

.profile {
  margin-top: 22px;
  color: var(--ink-1);
  font-size: 14px;
  line-height: 1.8;
  max-width: 56ch;
}

.portrait {
  flex: none;
  width: min(280px, 34vw);
}

.portrait :deep(.frame) {
  border: var(--rule);
  background: var(--bg-1);
}

/* ---------- blocks ---------- */

.block {
  margin-bottom: calc(var(--pad-section) * 0.7);
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1px;
  background: var(--line-1);
  border: var(--rule);
}

.stat {
  background: var(--bg-2);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat .k {
  font-size: 12px;
  color: var(--ink-2);
  letter-spacing: 0.1em;
}

.stat .v {
  font-size: 18px;
  color: var(--ink-0);
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

.skill-list {
  list-style: none;
}

.skill {
  display: grid;
  grid-template-columns: 36px 1fr;
  gap: 14px;
  padding: 14px 4px;
  border-bottom: var(--rule);
}

.skill-no {
  color: var(--ink-3);
  font-size: 12px;
  padding-top: 4px;
}

.skill-name {
  font-size: 15.5px;
  font-weight: 500;
  margin-bottom: 6px;
}

.desc {
  color: var(--ink-1);
  font-size: 13.5px;
  line-height: 1.8;
  max-width: 76ch;
  white-space: pre-line;
}

/* 描述内联技能键位图标（<IconMap:Icon_XXX>，本地 SVG 字形） */
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

/* ---------- talents ---------- */

.talent-list {
  list-style: none;
}

.talent {
  display: grid;
  grid-template-columns: 36px 1fr;
  gap: 14px;
  padding: 14px 4px;
  border-bottom: var(--rule);
}

.talent-no {
  color: var(--ink-3);
  font-size: 12px;
  padding-top: 2px;
}

.talent h3 {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 6px;
}

/* ---------- skins ---------- */

/* 一行一个皮肤：与 skill / talent 行同一视觉节奏 */
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

.err,
.loading {
  color: var(--danger);
  font-size: 12.5px;
  letter-spacing: 0.2em;
}

.loading {
  color: var(--ink-2);
}

@media (max-width: 860px) {
  .head {
    flex-direction: column-reverse;
  }
  .portrait {
    width: 56vw;
  }
}
</style>