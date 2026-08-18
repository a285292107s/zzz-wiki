<script setup lang="ts">
import { computed } from 'vue'
import { iconSources } from '@/data/icons'
import { HIT_TYPES } from '@/domain/enums'
import type { AttrCode, HitCode, SpecCode } from '@/domain/enums'
import type { CharacterDetail } from '@/data/types'
import { stripRichText } from '@/utils/text'
import HollowImage from '@/components/HollowImage.vue'
import Tags from '@/components/Tags.vue'
import Rarity from '@/components/Rarity.vue'

const props = defineProps<{
  detail: CharacterDetail
}>()

const attrCode = computed<AttrCode | null>(() => {
  const el = props.detail.element_type
  const key = el ? Object.keys(el)[0] : null
  return key ? (Number(key) as AttrCode) : null
})

/** 特殊属性展示名：有 special_element_type（如 星见雅→烈霜）时优先展示 */
const specialElementName = computed<string | null>(() => {
  const sp = props.detail.special_element_type
  return sp?.name ? String(sp.name) : null
})

const specCode = computed<SpecCode | null>(() => {
  const w = props.detail.weapon_type
  const key = w ? Object.keys(w)[0] : null
  return key ? (Number(key) as SpecCode) : null
})

const hitZh = computed<string | null>(() => {
  const h = props.detail.hit_type
  const key = h ? Object.keys(h)[0] : null
  return key ? (HIT_TYPES[Number(key) as HitCode]?.zh ?? null) : null
})

const codeName = computed(() => props.detail.code_name?.toUpperCase() ?? '')

/** 护照式数据条：传记字段（机构/游戏机制标签之外的部分） */
const dossier = computed(() => {
  const d = props.detail
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

const profile = computed(() => {
  const t = props.detail.partner_info?.profile_desc
  return t ? stripRichText(t) : ''
})

const portraitSrcs = computed(() =>
  iconSources({ Id: props.detail.id, icon: props.detail.icon }, 'portrait', 'character'),
)
</script>

<template>
  <header class="ahead">
    <div class="file-row">
      <p class="eyebrow">AGENT FILE · NO.{{ String(detail.id ?? '').padStart(4, '0') }}</p>
      <Rarity :rank="detail.rarity" />
    </div>

    <div class="main">
      <div class="id-block">
        <h1 class="page-title">{{ detail.name ?? '—' }}</h1>
        <p v-if="codeName" class="ghost mono">{{ codeName }}</p>
        <div class="meta">
          <Tags :element="attrCode" :element-label="specialElementName" :specialty="specCode" />
          <span v-if="hitZh" class="hit-tag">{{ hitZh }}</span>
        </div>
      </div>

      <div class="portrait">
        <span class="marks" aria-hidden="true"><i /><i /><i /><i /></span>
        <HollowImage
          :srcs="portraitSrcs"
          :alt="detail.name ?? ''"
          :fallback="detail.name ?? '—'"
          position="top"
          ratio="3 / 4"
        />
      </div>

      <dl v-if="dossier.length" class="dossier mono">
        <div v-for="d in dossier" :key="d.k" class="d-item">
          <dt>{{ d.k }}</dt>
          <dd>{{ d.v }}</dd>
        </div>
      </dl>

      <div v-if="profile" class="profile-wrap">
        <p class="profile">{{ profile }}</p>
      </div>
    </div>
  </header>
</template>

<style scoped>
.ahead {
  margin-bottom: calc(var(--pad-section) * 0.8);
}

/* ---------- 档案编号行 ---------- */

.file-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 14px;
  border-bottom: var(--rule);
}

/* ---------- 主体栅格：左档案 / 右画像 ---------- */

.main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) clamp(220px, 26vw, 300px);
  grid-template-areas:
    'id portrait'
    'dossier portrait'
    'profile portrait';
  column-gap: clamp(32px, 5vw, 64px);
  margin-top: clamp(26px, 3.4vw, 44px);
}

.id-block {
  grid-area: id;
}

.ghost {
  margin-top: 8px;
  font-size: clamp(17px, 2.4vw, 28px);
  font-weight: 400;
  letter-spacing: 0.38em;
  color: var(--ink-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}

/* 攻击方式标签：与 Tags 内 .tag 同构 */
.hit-tag {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  letter-spacing: 0.1em;
  padding: 3px 9px;
  border: 1px solid var(--line-1);
  border-radius: 2px;
  color: var(--ink-1);
  white-space: nowrap;
}

/* ---------- 画像：细线框 + 四角对位标记 ---------- */

.portrait {
  grid-area: portrait;
  position: relative;
}

.portrait :deep(.frame) {
  border: var(--rule);
  background: var(--bg-1);
}

.marks {
  position: absolute;
  inset: -8px;
  pointer-events: none;
}

.marks i {
  position: absolute;
  width: 14px;
  height: 14px;
  border: 0 solid var(--amber);
}

.marks i:nth-child(1) { top: 0; left: 0; border-top-width: 1px; border-left-width: 1px; }
.marks i:nth-child(2) { top: 0; right: 0; border-top-width: 1px; border-right-width: 1px; }
.marks i:nth-child(3) { bottom: 0; left: 0; border-bottom-width: 1px; border-left-width: 1px; }
.marks i:nth-child(4) { bottom: 0; right: 0; border-bottom-width: 1px; border-right-width: 1px; }

/* ---------- 护照数据条 ---------- */

.dossier {
  grid-area: dossier;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: 0;
  row-gap: 10px;
  margin-top: clamp(24px, 3vw, 36px);
  padding-block: 12px 14px;
  border-top: var(--rule);
  border-bottom: var(--rule);
}

.d-item {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding-inline: 18px;
  border-left: 1px solid var(--line-1);
}

.d-item:first-child {
  padding-left: 0;
  border-left: none;
}

.d-item dt {
  font-size: 10px;
  letter-spacing: 0.22em;
  color: var(--ink-3);
}

.d-item dd {
  font-size: 12.5px;
  letter-spacing: 0.04em;
  color: var(--ink-0);
}

/* ---------- 档案摘录 ---------- */

.profile-wrap {
  grid-area: profile;
}

.profile {
  margin-top: 22px;
  color: var(--ink-1);
  font-size: 14px;
  line-height: 1.9;
  max-width: 58ch;
}

/* ---------- 移动端：单列，画像紧随标识区 ---------- */

@media (max-width: 860px) {
  .main {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      'id'
      'portrait'
      'dossier'
      'profile';
    row-gap: 8px;
  }

  .portrait {
    width: min(300px, 78vw);
  }

  .dossier {
    margin-top: 10px;
  }

  .d-item {
    padding-inline: 14px;
  }
}
</style>
