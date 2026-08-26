<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { usePageMeta } from '@/composables/usePageMeta'
import { resolveAnchorOffset } from '@/composables/anchorOffset'
import { useNavScrollable } from '@/composables/useNavScrollable'
import { FORMULA_GUIDE } from '@/data/formulaGuide'
import { ListPage, DetailSection } from '@/components'
import FormulaEq from '@/components/FormulaEq.vue'

const title = FORMULA_GUIDE.title
usePageMeta(title, FORMULA_GUIDE.sub)

// 段锚点导航（复用 base.css .section-nav：宽屏左侧索引 / 窄屏吸顶横条）
const parts = computed(() => FORMULA_GUIDE.parts)
const nav = computed(() =>
  parts.value.map((p) => ({ id: p.id, no: p.no, label: p.title })),
)

// 窄屏吸顶横条的「可横滑」提示与交互（nav 静态，onMounted 内首次量测即可）
const { navEl, scrollRight } = useNavScrollable()

// 轻量滚动高亮：依据吸顶横条实际高度（anchorOffset，与 router scrollBehavior 同源）判定当前段
const active = ref<string | null>(null)
const NAV_SLOP = 80
function onScroll() {
  const offset = resolveAnchorOffset()
  let cur: string | null = parts.value[0]?.id ?? null
  for (const p of parts.value) {
    const el = document.getElementById(p.id)
    if (!el) continue
    if (el.getBoundingClientRect().top <= offset + NAV_SLOP) cur = p.id
  }
  active.value = cur
}
onMounted(() => {
  onScroll()
  document.addEventListener('scroll', onScroll)
})
onBeforeUnmount(() => {
  document.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <ListPage>
    <!-- 段导航：宽屏左侧索引 / 窄屏吸顶横条 -->
    <nav v-if="nav.length" ref="navEl" class="section-nav" aria-label="战斗公式段落">
      <div class="sn-list">
        <RouterLink
          v-for="n in nav"
          :key="n.id"
          class="sn-item mono"
          :class="{ active: active === n.id }"
          :aria-current="active === n.id ? 'true' : undefined"
          :to="{ hash: '#' + n.id }"
        >
          <span class="no">{{ n.no }}</span>
          <span>{{ n.label }}</span>
        </RouterLink>
      </div>
      <button class="sn-scroll-btn" aria-label="向右滚动" @click="scrollRight">→</button>
    </nav>

    <header class="page-head">
      <p class="eyebrow mono">Combat Formulas</p>
      <h1 class="page-title">{{ title }}</h1>
      <p class="page-sub">{{ FORMULA_GUIDE.sub }}</p>
    </header>

    <!-- 出处与提示：纯细线盒，无卡片堆叠 -->
    <aside class="notice" aria-label="阅读提示">
      <p class="notice-source">
        <span class="notice-tag mono">SOURCE</span>
        <a :href="FORMULA_GUIDE.sourceUrl" target="_blank" rel="noopener" class="source-link">
          {{ FORMULA_GUIDE.sourceTitle }}
        </a>
      </p>
      <ul class="notice-list">
        <li v-for="(n, i) in FORMULA_GUIDE.notice" :key="i">{{ n }}</li>
      </ul>
    </aside>

    <DetailSection
      v-for="part in parts"
      :id="part.id"
      :key="part.id"
      :no="part.no"
      :title="part.title"
      :en="part.en"
    >
      <p v-if="part.lead" class="part-lead">{{ part.lead }}</p>

      <div v-if="part.formulas?.length" class="eq-list">
        <FormulaEq v-for="(f, i) in part.formulas" :key="i" :formula="f" />
      </div>

      <div v-for="(g, gi) in part.groups" :key="gi" class="group">
        <h3 v-if="g.title" class="group-title mono">{{ g.title }}</h3>
        <p v-if="g.note" class="group-note">{{ g.note }}</p>

        <div class="items">
          <article v-for="item in g.items" :key="item.no" class="item">
            <span class="it-no">{{ item.no }}</span>
            <div class="it-body">
              <h4 class="it-title">{{ item.title }}</h4>
              <p v-if="item.desc" class="it-desc">{{ item.desc }}</p>
              <FormulaEq v-if="item.formula" :formula="item.formula" />
            </div>
          </article>
        </div>
      </div>
    </DetailSection>
  </ListPage>
</template>

<style scoped>
.notice {
  border: var(--rule);
  border-radius: 2px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: var(--pad-section);
}

.notice-source {
  display: flex;
  align-items: baseline;
  gap: 12px;
  font-size: var(--fs-small);
  color: var(--ink-1);
  line-height: 1.6;
}

.notice-tag {
  font-size: var(--fs-nano);
  letter-spacing: 0.22em;
  color: var(--ink-3);
  flex: none;
}

.source-link {
  color: var(--ink-0);
  border-bottom: 1px solid var(--line-1);
  transition: color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease);
}

.source-link:hover {
  color: var(--amber-hi);
  border-color: var(--amber);
}

.notice-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: var(--fs-caption);
  color: var(--ink-2);
  line-height: 1.65;
}

.notice-list li::before {
  content: '—';
  color: var(--amber);
  margin-right: 10px;
}

.part-lead {
  color: var(--ink-1);
  font-size: var(--fs-body);
  max-width: 66ch;
  line-height: 1.85;
  margin-bottom: 30px;
}

/* 公式合集：左侧琥珀书脊聚合，避免每则成盒的叠卡感 */
.eq-list {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin-bottom: var(--space-group);
  border-left: 1px solid var(--line-1);
  padding-left: 26px;
}

.group {
  margin-bottom: var(--space-group);
}

.group-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: var(--fs-micro);
  font-weight: 400;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--ink-1);
  margin-bottom: 16px;
}

.group-title::before {
  content: '';
  width: 16px;
  height: 1px;
  background: var(--amber);
  flex: none;
}

.group-note {
  font-size: var(--fs-md);
  color: var(--ink-1);
  line-height: 1.85;
  margin: -6px 0 20px;
  max-width: 66ch;
}

/* 条目台账：等宽索引列 + 内容列，发丝横线分条；索引列保持单一左缘对齐 */
.items {
  border-top: var(--rule);
}

.item {
  display: grid;
  grid-template-columns: 92px 1fr;
  gap: 26px;
  padding: 26px 0;
  border-bottom: var(--rule);
}

.it-no {
  font-family: var(--mono);
  font-size: var(--fs-micro);
  letter-spacing: 0.1em;
  color: var(--ink-3);
  padding-top: 4px;
}

.it-title {
  font-family: var(--serif);
  font-weight: 500;
  font-size: var(--fs-subhead);
  letter-spacing: 0.01em;
  color: var(--ink-0);
}

.it-desc {
  margin-top: 9px;
  font-size: var(--fs-md);
  color: var(--ink-1);
  line-height: 1.85;
  max-width: 68ch;
}

.it-body {
  min-width: 0;
}

@media (max-width: 600px) {
  .item {
    grid-template-columns: 1fr;
    gap: 8px;
    padding: 22px 0;
  }
  .it-no {
    padding: 0;
  }
  .eq-list {
    padding-left: 18px;
  }
}
</style>