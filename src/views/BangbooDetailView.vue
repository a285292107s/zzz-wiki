<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { api } from '@/data/api'
import { iconSources } from '@/data/icons'
import { stripRichText } from '@/utils/text'
import { useRouteParam } from '@/composables/useRouteParam'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useDetailSections, type DetailSectionItem } from '@/composables/useDetailSections'
import { usePageMeta } from '@/composables/usePageMeta'
import {
  bangbooBreakCount,
  bangbooStatsAtLevel,
  BANGBOO_LEVEL_DEFAULT,
  BANGBOO_LEVEL_MAX,
  BANGBOO_LEVEL_MIN,
  buildBangbooSkills,
  type SkillRow,
  type StatItem,
} from '@/domain/sections'
import type { BangbooDetail } from '@/data/types'
import { DetailHead, DetailPage, DetailSection, KeyValueGrid, LevelSlider, SkillGroup, StatLevelPanel } from '@/components'
import type { LevelMark } from '@/components/detail/LevelSlider.vue'
import Rarity from '@/components/Rarity.vue'

const id = useRouteParam('id')
const { data: detail, status, error } = useAsyncResource(() => api.detail<BangbooDetail>('bangboo', id.value))

usePageMeta(() => detail.value?.name ?? undefined)

const portraitSrcs = computed(() =>
  iconSources({ Id: id.value, icon: detail.value?.icon }, 'bangboo'),
)

/* ---------- 基础属性：等级滑条（默认满级；切换邦布时重置） ---------- */

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

/* ---------- 技能（映射为通用 SkillRow 复用 SkillGroup；描述与数值随所选等级联动） ---------- */

/** 邦布技能行附等级上限（SkillGroup defaultLevel 用；key 含详情 id，切换邦布时强制重建重置等级） */
type BangbooSkillDisplay = SkillRow & { levelCount: number; keyed: string }

const skillRows = computed<BangbooSkillDisplay[]>(() =>
  buildBangbooSkills(detail.value?.skill, detail.value?.skill_prop).map((sk) => ({
    key: sk.key,
    keyed: `${detail.value?.id}:${sk.key}`,
    zh: sk.zh,
    keyEn: '', // 图标位经 #glyph 插槽用字母占位，键名不重复展示
    levelCount: sk.levelCount,
    hasNumbers: sk.stats.length > 0,
    groups: [
      {
        name: sk.names[0] || sk.zh,
        // 描述随等级取（descs 与等级一一对应）
        desc: (lv: number) =>
          sk.descs[Math.min(Math.max(lv, 1), sk.descs.length) - 1] ?? sk.descs[0] ?? '',
        entries: sk.stats.map((st, i) => {
          const token = sk.tokens.map((t) => t[i]).find((t) => t?.includes('{Skill:')) ?? ''
          const ref = token.match(/Skill:(\d+),\s*Prop:(\d+)/)
          return {
            name: st.name,
            formula: token,
            props: sk.propMap,
            format: ref ? sk.propMap[ref[1]]?.[ref[2]]?.format : undefined,
            // 静态文本条目（如冷却 20秒）：各级原文按序，直接展示
            values: st.referenced ? undefined : sk.tokens.map((t) => t[i] ?? '—'),
          }
        }),
      },
    ],
  })),
)

/* ---------- 区块导航 + scrollspy + reveal ---------- */

const navItems = computed<DetailSectionItem[]>(() => {
  const items: DetailSectionItem[] = [{ id: 'stats', no: '01', label: '基础属性' }]
  if (skillRows.value.length) items.push({ id: 'skills', no: '02', label: '技能' })
  return items
})

const { activeSection, revealDir: vReveal, noOf } = useDetailSections(navItems, status)

/** 404 时返回邦布名录 */
const backTo = computed(() => (detail.value ? undefined : '/bangboos'))
</script>

<template>
  <DetailPage
    back-to="/bangboos"
    back-label="返回邦布名录"
    :nav="detail ? navItems : []"
    :active="activeSection"
    :status="status"
    :error="error"
    :fallback-to="backTo"
  >
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

      <DetailSection id="stats" :no="noOf('stats') ?? '01'" title="基础属性" en="Vitals">
        <StatLevelPanel
          :lv-label="`Lv.${bLevel}`"
          :meta="breakCount === 0 ? '未突破' : `突破 ${breakCount} 阶`"
        >
          <template #control>
            <LevelSlider
              v-model="bLevel"
              :min="BANGBOO_LEVEL_MIN"
              :max="BANGBOO_LEVEL_MAX"
              label="邦布等级"
              :marks="levelMarks"
            />
          </template>
        </StatLevelPanel>
        <KeyValueGrid :items="stats" variant="ledger" />
      </DetailSection>

      <DetailSection v-if="skillRows.length" v-reveal id="skills" :no="noOf('skills') ?? '01'" title="技能" en="Skills">
        <SkillGroup
          v-for="sk in skillRows"
          :key="sk.keyed"
          :row="sk"
          :glyph="sk.key.toUpperCase()"
          :srcs="[]"
          :level-count="sk.levelCount"
        >
          <!-- 邦布无技能图标素材：以等宽字母占位（角色页走默认 HollowImage 候选链） -->
          <template #glyph>
            <i class="glyph mono">{{ sk.key.toUpperCase() }}</i>
          </template>
        </SkillGroup>
      </DetailSection>
    </template>
  </DetailPage>
</template>

<style scoped>
.codename {
  font-size: var(--fs-caption);
  letter-spacing: 0.14em;
  color: var(--ink-2);
  margin-bottom: 6px;
}

.tagline {
  color: var(--ink-1);
  font-size: var(--fs-md);
  line-height: 1.8;
  max-width: 56ch;
}

/* 槽位方框（邦布无技能图标素材，以等宽字母占位；随 SkillGroup 的 --label-col，与编号列同轴线） */
.glyph {
  width: var(--label-col);
  height: var(--label-col);
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border: 1px solid var(--line-1);
  border-radius: 2px;
  font-size: var(--fs-lead);
  font-style: normal;
  color: var(--amber);
}
</style>
