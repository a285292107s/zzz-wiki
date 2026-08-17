<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { api } from '@/data/api'
import { iconSources } from '@/data/icons'
import { richDesc } from '@/utils/rich'
import { stripRichText } from '@/utils/text'
import { PROFESSIONS, type SpecCode } from '@/data/types'
import type { WEngineDetail } from '@/data/types'
import Rarity from '@/components/Rarity.vue'
import Tags from '@/components/Tags.vue'
import HollowImage from '@/components/HollowImage.vue'

const route = useRoute()
const detail = ref<WEngineDetail | null>(null)
const loaded = ref(false)
const error = ref<string | null>(null)

const id = computed(() => String(route.params.id))

watchEffect(async () => {
  loaded.value = false
  error.value = null
  try {
    detail.value = await api.wengine(id.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loaded.value = true
  }
})

const specCode = computed<SpecCode | null>(() => {
  const w = detail.value?.weapon_type
  if (!w) return null
  const key = Object.keys(w)[0]
  return key ? (Number(key) as SpecCode) : null
})

const specName = computed(
  () => (specCode.value != null ? PROFESSIONS[specCode.value]?.zh : null) ?? null,
)

/** 副属性/主属性显示值：% 格式按 0-100 整数显示百分号，其余平值原样 */
function formatValue(p: { value?: number; format?: string } | null | undefined): string | null {
  if (!p || p.value == null) return null
  const fmt = p.format ?? ''
  if (fmt.includes('%')) return `${p.value}%`
  return String(p.value)
}

const baseProp = computed(() => formatValue(detail.value?.base_property))
const randProp = computed(() => formatValue(detail.value?.rand_property))
const baseName = computed(() => detail.value?.base_property?.name)
const randName = computed(() => detail.value?.rand_property?.name)

interface TalentRow {
  no: number
  name?: string
  desc?: string
}

const talents = computed<TalentRow[]>(() => {
  const t = detail.value?.talents
  if (!t) return []
  return Object.entries(t)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([k, v]) => ({
      no: Number(k),
      name: (v as { name?: string }).name,
      desc: (v as { desc?: string }).desc,
    }))
})

const hasBody = computed(
  () => detail.value?.desc || detail.value?.desc2 || detail.value?.desc3,
)
const bodyText = computed<string>(() => {
  const d = detail.value
  if (!d) return ''
  const parts = [d.desc, d.desc2, d.desc3]
    .map((x) => stripRichText(x))
    .filter((x) => x && x.trim())
  return parts.join('\n\n')
})
</script>

<template>
  <div class="wrap page">
    <RouterLink to="/w-engines" class="back mono">← 返回音擎图鉴</RouterLink>

    <p v-if="error" class="err mono">⚠ 数据加载失败：{{ error }}</p>
    <p v-else-if="!loaded" class="loading mono">LOADING…</p>

    <template v-else-if="detail">
      <header class="head">
        <div class="id-block">
          <p class="eyebrow mono">W-Engine · {{ String(id).padStart(4, '0') }}</p>
          <h1 class="page-title">{{ detail.name }}</h1>
          <div class="meta">
            <Rarity :rank="detail.rarity" />
            <Tags :specialty="specCode" />
            <span v-if="specName" class="spec serif">{{ specName }}</span>
          </div>
          <p v-if="detail.code_name" class="codename mono">{{ detail.code_name }}</p>
        </div>

        <div class="portrait">
          <HollowImage
            :srcs="iconSources({ Id: detail.id, icon: detail.icon }, 'portrait', 'weapon')"
            :alt="detail.name"
            :fallback="detail.name"
            :ratio="'1 / 1'"
          />
        </div>
      </header>

      <section v-if="hasBody" class="block">
        <div class="section-head">
          <span class="no mono">01</span>
          <h2>概述</h2>
          <span class="rule" />
        </div>
        <p class="story">{{ bodyText }}</p>
      </section>

      <section class="block">
        <div class="section-head">
          <span class="no mono">02</span>
          <h2>基础属性</h2>
          <span class="rule" />
        </div>
        <div class="stat-grid">
          <div v-if="baseName && baseProp" class="stat">
            <span class="k">{{ baseName }}</span>
            <span class="v mono">{{ baseProp }}</span>
            <span class="tag-lbl">主属性</span>
          </div>
          <div v-if="randName && randProp" class="stat">
            <span class="k">{{ randName }}</span>
            <span class="v mono">{{ randProp }}</span>
            <span class="tag-lbl">副属性</span>
          </div>
        </div>
      </section>

      <section class="block">
        <div class="section-head">
          <span class="no mono">03</span>
          <h2>精炼效果</h2>
          <span class="rule" />
        </div>
        <ul v-if="talents.length" class="talent-list">
          <li v-for="t in talents" :key="t.no" class="talent">
            <span class="talent-no mono">{{ String(t.no).padStart(2, '0') }}</span>
            <div class="talent-body">
              <h3 class="serif">{{ t.name ?? '未命名' }}</h3>
              <p v-if="t.desc" class="desc" v-html="richDesc(t.desc)"></p>
            </div>
          </li>
        </ul>
        <p v-else class="empty mono">—</p>
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

.spec {
  font-size: 14px;
  letter-spacing: 0.06em;
  color: var(--ink-1);
}

.codename {
  margin-top: 14px;
  font-size: 12px;
  letter-spacing: 0.14em;
  color: var(--ink-2);
}

.portrait {
  flex: none;
  width: min(260px, 34vw);
}

.portrait :deep(.frame) {
  border: var(--rule);
  background: var(--bg-1);
}

/* ---------- blocks ---------- */

.block {
  margin-bottom: calc(var(--pad-section) * 0.7);
}

.story {
  color: var(--ink-1);
  font-size: 14px;
  line-height: 1.9;
  max-width: 72ch;
  white-space: pre-line;
}

.story :deep(.rich-key) {
  display: inline-block;
  width: 1.15em;
  height: 1.15em;
  margin: 0 0.1em;
  vertical-align: -0.22em;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1px;
  background: var(--line-1);
  border: var(--rule);
}

.stat {
  background: var(--bg-2);
  padding: 16px 18px;
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
  font-size: 26px;
  color: var(--amber);
  line-height: 1.1;
}

.stat .tag-lbl {
  font-size: 11px;
  letter-spacing: 0.14em;
  color: var(--ink-3);
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

.talent-body h3 {
  font-size: 16px;
  font-weight: 500;
  color: var(--ink-0);
  margin-bottom: 6px;
}

.desc {
  color: var(--ink-1);
  font-size: 13.5px;
  line-height: 1.8;
  max-width: 76ch;
  white-space: pre-line;
}

.empty,
.err,
.loading {
  font-size: 12.5px;
  letter-spacing: 0.2em;
  color: var(--ink-2);
}

.err {
  color: var(--danger);
}

@media (max-width: 860px) {
  .head {
    flex-direction: column-reverse;
  }
  .portrait {
    width: 52vw;
  }
}
</style>
