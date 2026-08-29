<script setup lang="ts">
import { computed, ref, type Ref } from 'vue'
import { detailFor, listFor } from '@/data/resources'
import { iconSources, skillIconSources, type SkillSlot } from '@/data/icons'
import { signatureEngineFor } from '@/domain/signatureEngine'
import { stripRichText } from '@/utils/text'
import { useRouteParam } from '@/composables/useRouteParam'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useDetailSections, type DetailSectionChild, type DetailSectionItem } from '@/composables/useDetailSections'
import { usePageMeta } from '@/composables/usePageMeta'
import { useEntityLevel } from '@/composables/useEntityLevel'
import { catalogEntry } from '@/domain/catalog'
import {
  buildCoreEnhance,
  buildCoreSkill,
  buildPotentialCinema,
  buildSkillRows,
  buildSkinRows,
  CHAR_LEVEL_MAX,
  CHAR_LEVEL_MIN,
  charBreakSegment,
  SKILL_LEVEL_DEFAULT,
  characterStatsAtLevel,
  dictToRows,
  synthesizePotentialCinema,
  SKILL_KEYS,
  type CoreEnhanceLevel,
  type CoreSkill,
  type DetailRow,
  type PotentialCinema,
  type SkillRow,
  type SkillSlotKey,
  type SkinRow,
  type StatItem,
} from '@/domain/sections'

interface SkillDisplay extends SkillRow {
  glyph: string
  srcs: string[]
  /** 等级源：连携技/终结技共享同一槽位等级（== 游戏内链技/终结技共用一份升级），其余各自独立 */
  level: Ref<number>
}
import type { CharacterDetail, WEngineListItem } from '@/data/types'
import { AgentHead, CoreSkillGroup, DescRow, DetailPage, DetailSection, KeyValueGrid, LevelSlider, SkillGroup, StatLevelPanel } from '@/components'
import HollowImage from '@/components/HollowImage.vue'

const id = useRouteParam('id')
const { data: detail, status, error } = useAsyncResource(() => detailFor<CharacterDetail>(catalogEntry('/agents'), id.value))

usePageMeta(() => detail.value?.name ?? undefined)

/** 武器名录：用于解析当前代理人的专属音擎（domain/signatureEngine 命名约定 + 覆盖表）。
 *  作为独立资源加载，避免阻塞角色详情主链路。 */
const { data: weapons } = useAsyncResource(() => listFor<WEngineListItem>(catalogEntry('/w-engines')))

/** 专属音擎（签名 W-Engine）名录条目；名录未加载/未覆盖时为空（hero 静默不展示） */
const signatureEngine = computed(() =>
  signatureEngineFor(detail.value?.id, weapons.value ?? []),
)

/* ---------- 基础属性：等级滑条 ---------- */

/** 连携技/终结技共享的技能等级（同处 game 的 chain 槽，共用一个 material/12 级）；
 *  父级持有以便两个技能组同步，切换角色时重置 */
const chainLevel = ref(SKILL_LEVEL_DEFAULT)

/** 当前查看等级（默认满级，与技能滑块默认一致；切换角色时重置连携共享等级）+ 突破刻度 */
const { level: charLevel, levelMarks } = useEntityLevel({
  min: CHAR_LEVEL_MIN,
  max: CHAR_LEVEL_MAX,
  onReset: () => {
    chainLevel.value = SKILL_LEVEL_DEFAULT
  },
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

const skills = computed<SkillDisplay[]>(() =>
  buildSkillRows(detail.value?.skill).map((sk) => ({
    ...sk,
    glyph: SKILL_KEYS[sk.key as SkillSlotKey]?.glyph ?? '□',
    srcs: skillIconSources(sk.key as SkillSlot),
    // chain/ultimate 共享 chainLevel（同一槽位等级）；其余槽位各自独立（切换角色时随 computed 重建重置）
    level: sk.key === 'chain' || sk.key === 'ultimate' ? chainLevel : ref(SKILL_LEVEL_DEFAULT),
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

/** 潜能影像档位（potential_detail 数据源，V2.5 激发潜能）；
 *  对 description 为空的档位（如档 I）用技能门控信息反推一句话概述 */
const potentialCinema = computed<PotentialCinema[]>(() =>
  synthesizePotentialCinema(
    skills.value,
    buildPotentialCinema(detail.value?.potential_detail),
    coreSkill.value,
  ),
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

/* ---------- 角色介绍（profile_desc 摘要；过长故独立成块） ---------- */

const profile = computed(() => {
  const t = detail.value?.partner_info?.profile_desc
  return t ? stripRichText(t) : ''
})

/* ---------- 档案详情（护照式身份字段：全名/性别/生日/身高/阵营） ---------- */

const dossier = computed(() => {
  const d = detail.value
  if (!d) return []
  const i = d.partner_info
  const campEntry = d.camp
  const campKey = campEntry ? Object.keys(campEntry)[0] : null
  const camp = campKey && campEntry ? String(campEntry[campKey]) : null

  const items: Array<{ k: string; v: string }> = []
  if (i?.full_name) items.push({ k: '全名', v: i.full_name })
  if (i?.gender) items.push({ k: '性别', v: i.gender })
  if (i?.birthday) items.push({ k: '生日', v: i.birthday })
  if (i?.stature) items.push({ k: '身高', v: `${i.stature}cm` })
  if (camp) items.push({ k: '阵营', v: camp })
  return items
})

/* ---------- 区块导航（条件区块）+ scrollspy + reveal ---------- */

/** 技能子导航：各键位招式，映射为技能区块内锚点（skill-<key>） */
const skillChildren = computed<DetailSectionChild[]>(() =>
  skills.value.map((sk) => ({ id: `skill-${sk.key}`, label: sk.zh })),
)

/** 区块导航：00 固定为封面锚点（AgentHead 根，标签仅角色名，省导航宽度），其余连续编号
 * 由添加序派生（与 DetailSection :no 同源，杜绝编号双份事实漂移） */
const navItems = computed(() => {
  const items: DetailSectionItem[] = [
    { id: 'head', no: '00', label: detail.value?.name ?? '' },
  ]
  let n = 0
  const add = (id: string, label: string, children?: DetailSectionChild[]) =>
    items.push({ id, no: String(++n).padStart(2, '0'), label, children })
  if (dossier.value.length) add('dossier', '档案详情')
  if (profile.value) add('profile', '角色介绍')
  add('stats', '基础属性')
  if (skills.value.length) add('skills', '技能招式', skillChildren.value)
  if (coreSkill.value) add('core', '核心技')
  if (talents.value.length) add('talents', '影画')
  if (potentialCinema.value.length) add('potential', '潜能影像')
  if (skinList.value.length) add('skins', '皮肤')
  if (hasImpressions.value) add('impressions', '绳网印象')
  return items
})

const { activeSection, revealDir: vReveal, noOf } = useDetailSections(navItems, status)

/** 404 时返回名录 */
const backTo = computed(() => (detail.value ? undefined : '/agents'))
</script>

<template>
  <DetailPage
    back-to="/agents"
    back-label="返回名录"
    :nav="detail ? navItems : []"
    :active="activeSection"
    :status="status"
    :error="error"
    :fallback-to="backTo"
  >
    <template v-if="detail">
      <!-- 封面锚点：00 导航直达；scrollspy 亦观察此 id（滚动回顶时高亮 00） -->
      <AgentHead id="head" :detail="detail" :signature-engine="signatureEngine" />

      <DetailSection v-if="dossier.length" v-reveal id="dossier" :no="noOf('dossier') ?? '01'" title="档案详情" en="Dossier">
        <dl class="dossier mono">
          <div v-for="d in dossier" :key="d.k" class="d-item">
            <dt>{{ d.k }}</dt>
            <dd>{{ d.v }}</dd>
          </div>
        </dl>
      </DetailSection>

      <DetailSection v-if="profile" v-reveal id="profile" :no="noOf('profile') ?? '02'" title="角色介绍" en="Profile">
        <p class="profile-desc">{{ profile }}</p>
      </DetailSection>

      <DetailSection id="stats" :no="noOf('stats') ?? '02'" title="基础属性" en="Vitals">
        <StatLevelPanel
          :lv-label="`Lv.${charLevel}`"
          :meta="breakCount == null ? undefined : breakCount === 0 ? '未突破' : `突破 ${breakCount} 阶`"
        >
          <template #control>
            <LevelSlider
              v-model="charLevel"
              :min="CHAR_LEVEL_MIN"
              :max="CHAR_LEVEL_MAX"
              label="角色等级"
              :marks="levelMarks"
            />
          </template>
        </StatLevelPanel>
        <KeyValueGrid :items="stats" variant="ledger" />
      </DetailSection>

      <DetailSection v-if="skills.length" v-reveal id="skills" :no="noOf('skills') ?? '03'" title="技能招式" en="Skills">
        <!-- 锚点 id 直接挂在 SkillGroup 根上（Vue 属性继承）：技能组必须互为兄弟，
             组件内的 .skill-group + .skill-group 分隔规则才生效（勿再套包裹层） -->
        <SkillGroup
          v-for="sk in skills"
          :key="sk.key"
          :id="`skill-${sk.key}`"
          :row="sk"
          :glyph="sk.glyph"
          :srcs="sk.srcs"
          :level="sk.level.value"
          transpose
          @update:level="sk.level.value = $event ?? sk.level.value"
        />
      </DetailSection>

      <!-- 核心技：passive 数据源，独立区块（含基础/潜能版本与核心技强化档）；
      char-level 同步角色等级滑块，核心技强化档位按角色等级门槛解锁 -->
      <DetailSection
        v-if="coreSkill"
        v-reveal
        id="core"
        :no="noOf('core')"
        title="核心技"
        en="Core"
      >
        <CoreSkillGroup
          :row="coreSkill"
          :enhance="coreEnhance"
          :cinema="potentialCinema"
          :char-level="charLevel"
        />
      </DetailSection>

      <DetailSection v-if="talents.length" v-reveal id="talents" :no="noOf('talents') ?? '05'" title="影画" en="Mindscape">
        <ul class="talents-list">
          <DescRow
            v-for="t in talents"
            :key="t.no"
            :no="String(t.no).padStart(2, '0')"
            :title="t.name ?? '未命名'"
            :text="stripRichText(t.desc)"
            :text2="stripRichText(t.desc2)"
            variant="talent"
          />
        </ul>
      </DetailSection>

      <DetailSection
        v-if="potentialCinema.length"
        v-reveal
        id="potential"
        :no="noOf('potential')"
        title="潜能影像"
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

      <DetailSection v-if="skinList.length" v-reveal id="skins" :no="noOf('skins') ?? '07'" title="皮肤" en="Outfits">
        <ul class="skin-list">
          <li v-for="(s, i) in skinList" :key="s.id" class="skin">
            <!-- figcaption 必须是 figure 的子元素（HTML 规范）；两栏栅格设在 figure 上 -->
            <figure class="skin-figure">
              <HollowImage
                :srcs="iconSources({ icon: s.img }, 'character')"
                :alt="s.name"
                :fallback="s.name"
                fit="contain"
                ratio="3 / 4"
              />
              <figcaption class="skin-info">
                <span class="skin-index mono">着装 · {{ String(i + 1).padStart(2, '0') }}</span>
                <h3 class="skin-name serif">{{ s.name || '—' }}</h3>
                <p v-if="s.desc" class="skin-desc">{{ stripRichText(s.desc) }}</p>
              </figcaption>
            </figure>
          </li>
        </ul>
      </DetailSection>

      <DetailSection
        v-if="hasImpressions"
        v-reveal
        id="impressions"
        :no="noOf('impressions')"
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
    </DetailPage>
</template>

<style scoped>
/* ---------- 档案详情：hairline 网格小表，键浅值深、等宽数字 ---------- */

.dossier {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr));
  gap: 1px;
  background: var(--line-1); /* 网格线：gap + 底色充当 hairline */
  border: 1px solid var(--line-1);
  border-radius: 2px;
  overflow: hidden;
  font-variant-numeric: tabular-nums;
}

.d-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 14px 16px;
  background: var(--bg-1);
}

.d-item dt {
  font-size: var(--fs-nano);
  letter-spacing: 0.2em;
  color: var(--ink-2);
}

.d-item dd {
  font-size: var(--fs-md);
  letter-spacing: 0.03em;
  color: var(--ink-0);
}

/* ---------- 角色介绍：整篇双栏 + 标准 initial-letter 首字下沉
   用 CSS 标准属性 initial-letter（而非 float）：
   - 首字下沉天然与多栏 columns 协作，右栏顶行永远不空，零 artifact
   - 整篇持续双栏，不再切分为 lede/body，双栏结构不丢失
   - 不支持 initial-letter 的旧浏览器退化为 inline-block 放大（不 float） ---------- */

.profile-desc {
  font-family: var(--serif);
  color: var(--ink-0);
  font-size: var(--fs-body);
  line-height: 2;
  letter-spacing: 0.012em;
  column-count: 2;
  column-gap: 3em;
  column-rule: 1px solid var(--line-1);
  max-width: none;
  white-space: pre-line;
  text-wrap: pretty;
  orphans: 3;
  widows: 3;
  /* 顶栏：琥珀发丝线接 DetailSection 标题，作编辑札记栏注 */
  padding-top: 22px;
  border-top: 1px solid var(--amber-dim);
}

/* 标准首字下沉：放大 2.2 倍视觉尺寸，向下沉 2 行，琥珀色 */
.profile-desc::first-letter {
  font-family: inherit;
  color: var(--amber);
  font-weight: 500;
  initial-letter: 2.2 2;
  -webkit-initial-letter: 2.2 2;
  margin-right: 0.12em;
  /* 浏览器无 initial-letter 时的回退：大字号 inline，不使用 float 避免 columns artifact */
  @supports not ((initial-letter: 2 2) or (-webkit-initial-letter: 2 2)) {
    display: inline-block;
    font-size: 2.4em;
    line-height: 0.85;
    padding: 0.05em 0.08em 0 0;
    vertical-align: baseline;
  }
}

/* 窄屏回落：双栏并单栏，字号略调，首字下沉缩小 */
@media (max-width: 820px) {
  .profile-desc {
    column-count: 1;
    column-gap: 0;
    column-rule: none;
    font-size: var(--fs-md);
    line-height: 2;
  }
  .profile-desc::first-letter {
    initial-letter: 2.5 2;
    -webkit-initial-letter: 2.5 2;
  }
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
  padding: 18px 4px;
  border-bottom: var(--rule);
}

.skin:last-child {
  border-bottom: none;
}

/* 立绘主位 + 说明两栏：直立画幅完整呈现全身皮肤照（figcaption 是 figure 子元素，
   故两栏栅格/间距设在 figure 上，li 只负责列表分隔） */
.skin-figure {
  display: grid;
  grid-template-columns: 132px 1fr;
  align-items: start;
  gap: 20px;
  margin: 0;
}

.skin-info {
  min-width: 0;
  padding-top: 2px;
}

.skin-index {
  display: block;
  font-size: var(--fs-micro);
  letter-spacing: 0.14em;
  color: var(--ink-2);
  margin-bottom: 7px;
}

.skin-name {
  font-size: var(--fs-lead);
  font-weight: 500;
  color: var(--ink-0);
  line-height: 1.4;
  margin-bottom: 8px;
}

.skin-desc {
  font-size: var(--fs-caption);
  color: var(--ink-2);
  line-height: 1.75;
  max-width: 72ch;
}

@media (max-width: 560px) {
  .skin {
    padding-block: 14px;
  }
  .skin-figure {
    grid-template-columns: 96px 1fr;
    gap: 14px;
  }
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
  color: var(--ink-2);
  font-size: var(--fs-caption);
  padding-top: 3px;
}

.im-text {
  color: var(--ink-1);
  font-size: var(--fs-small);
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
  font-size: var(--fs-body);
  color: var(--ink-0);
  line-height: 1.9;
}

.voice figcaption {
  margin-top: 10px;
  font-size: var(--fs-nano);
  letter-spacing: 0.2em;
  color: var(--amber);
}
</style>

