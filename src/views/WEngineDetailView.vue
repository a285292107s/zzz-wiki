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
import { dictToRows, type DetailRow, type StatItem } from '@/domain/sections'
import { PROFESSIONS, type SpecCode } from '@/data/types'
import type { WEngineDetail } from '@/data/types'
import { AsyncState, DescRow, DetailHead, DetailSection, KeyValueGrid } from '@/components'
import BackToTop from '@/components/BackToTop.vue'
import Rarity from '@/components/Rarity.vue'
import Tags from '@/components/Tags.vue'

const id = useRouteParam('id')
const { data: detail, status, error } = useDetailResource<WEngineDetail>('weapon', id)

usePageMeta(() => detail.value?.name ?? undefined)

const specCode = computed<SpecCode | null>(() => {
  const wd = detail.value?.weapon_type
  const key = wd ? Object.keys(wd)[0] : null
  return key ? (Number(key) as SpecCode) : null
})

const specName = computed(() =>
  (specCode.value != null ? PROFESSIONS[specCode.value]?.zh : null) ?? null,
)

/** 副属性/主属性显示值：% 格式按 0-100 整数显示百分号，其余平值原样 */
function formatValue(p: { value?: number; format?: string } | null | undefined): string | null {
  if (!p || p.value == null) return null
  const fmt = p.format ?? ''
  return fmt.includes('%') ? `${p.value}%` : String(p.value)
}

const propItems = computed<StatItem[]>(() => {
  const d = detail.value
  const items: StatItem[] = []
  if (d?.base_property?.name && formatValue(d.base_property)) {
    items.push({
      label: d.base_property.name,
      value: formatValue(d.base_property)!,
      tag: '主属性',
    })
  }
  if (d?.rand_property?.name && formatValue(d.rand_property)) {
    items.push({
      label: d.rand_property.name,
      value: formatValue(d.rand_property)!,
      tag: '副属性',
    })
  }
  return items
})

const talents = computed<DetailRow[]>(() => dictToRows(detail.value?.talents))

const hasBody = computed(
  () => detail.value?.desc || detail.value?.desc2 || detail.value?.desc3,
)

const bodyText = computed<string>(() => {
  const d = detail.value
  if (!d) return ''
  return [d.desc, d.desc2, d.desc3]
    .map((x) => stripRichText(x))
    .filter((x) => x && x.trim())
    .join('\n\n')
})

const portraitSrcs = computed(() =>
  iconSources({ Id: detail.value?.id, icon: detail.value?.icon }, 'portrait', 'weapon'),
)

/* ---------- 区块导航（条件区块）+ scrollspy + reveal ---------- */

const navItems = computed(() => {
  const items: Array<{ id: string; no: string; label: string }> = []
  if (hasBody.value) items.push({ id: 'overview', no: '01', label: '概述' })
  items.push({ id: 'props', no: hasBody.value ? '02' : '01', label: '基础属性' })
  items.push({ id: 'talents', no: hasBody.value ? '03' : '02', label: '精炼效果' })
  return items
})

const { activeSection, revealDir, activate } = useDetailNavigation()
const vReveal = revealDir
const noOf = (id: string) => navItems.value.find((n) => n.id === id)?.no

/** 404 时返回音擎图鉴 */
const backTo = computed(() => (detail.value ? undefined : '/w-engines'))

watch(status, (s) => {
  if (s !== 'success') return
  nextTick(() => activate(navItems.value.map((n) => n.id)))
})
</script>

<template>
  <div class="wrap page">
    <RouterLink to="/w-engines" class="back mono">← 返回音擎图鉴</RouterLink>

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
          :eyebrow="`W-Engine · ${String(id).padStart(4, '0')}`"
          :title="detail.name ?? '—'"
          :portrait-srcs="portraitSrcs"
          :alt="detail.name ?? ''"
          :fallback="detail.name ?? '—'"
          ratio="1 / 1"
        >
          <template #meta>
            <Rarity :rank="detail.rarity" />
            <Tags :specialty="specCode" />
            <span v-if="specName" class="spec serif">{{ specName }}</span>
          </template>
          <template #sub>
            <p v-if="detail.code_name" class="codename mono">{{ detail.code_name }}</p>
          </template>
        </DetailHead>

        <DetailSection v-if="hasBody" id="overview" :no="noOf('overview') ?? '01'" title="概述" en="Lore">
          <p class="story">{{ bodyText }}</p>
        </DetailSection>

        <DetailSection v-reveal id="props" :no="noOf('props') ?? '01'" title="基础属性" en="Specs">
          <KeyValueGrid :items="propItems" />
        </DetailSection>

        <DetailSection v-reveal id="talents" :no="noOf('talents') ?? '01'" title="精炼效果" en="Refine">
          <ul v-if="talents.length" class="desc-list">
            <DescRow
              v-for="t in talents"
              :key="t.no"
              :no="String(t.no).padStart(2, '0')"
              :title="t.name ?? '未命名'"
              :html="richDesc(t.desc)"
              variant="talent"
            />
          </ul>
          <p v-else class="empty mono">—</p>
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

/* 音擎类型名：标签化与 meta 行其他标签统一（24px 高，2px 圆角） */
.spec {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 9px;
  box-sizing: border-box;
  font-size: 12px;
  letter-spacing: 0.06em;
  border: 1px solid var(--line-1);
  border-radius: 2px;
  color: var(--ink-1);
}

.codename {
  margin-top: 0;
  font-size: 12px;
  letter-spacing: 0.14em;
  color: var(--ink-2);
}

.story {
  color: var(--ink-1);
  font-size: 14px;
  line-height: 1.9;
  max-width: 72ch;
  white-space: pre-line;
}

.desc-list {
  list-style: none;
}

.empty {
  font-size: 12.5px;
  letter-spacing: 0.2em;
  color: var(--ink-2);
}
</style>