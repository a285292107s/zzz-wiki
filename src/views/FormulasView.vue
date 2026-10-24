<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { usePageMeta } from '@/composables/usePageMeta'
import { useLocale } from '@/composables/useLocale'
import { useUiText } from '@/composables/useUiText'
import { resolveAnchorOffset } from '@/composables/anchorOffset'
import { useNavScrollable } from '@/composables/useNavScrollable'
import { useDataVersion } from '@/composables/useDataVersion'
import { FORMULA_GUIDE } from '@/data/formulaGuide'
import { ListPage, DetailSection } from '@/components'
import NavScrollButton from '@/components/NavScrollButton.vue'
import FormulaEq from '@/components/FormulaEq.vue'

const { lang } = useLocale()
const { t } = useUiText()

const title = FORMULA_GUIDE.title
usePageMeta(title, FORMULA_GUIDE.sub)

// 段锚点导航（复用 base.css .section-nav：宽屏左侧索引 / 窄屏吸顶横条）
const parts = computed(() => FORMULA_GUIDE.parts)
const nav = computed(() =>
  parts.value.map((p) => ({ id: p.id, no: p.no, label: p.title })),
)

// 窄屏吸顶横条的「可横滑」提示与交互（nav 静态，onMounted 内首次量测即可）
const { navEl, scrollRight, ensureActiveVisible } = useNavScrollable()

// 轻量滚动高亮：依据吸顶横条实际高度（anchorOffset，与 router scrollBehavior 同源）判定当前段
const active = ref<string | null>(null)
const NAV_SLOP = 80

const { version, updatedAt, versionLabel } = useDataVersion()

function onScroll() {
  const offset = resolveAnchorOffset()
  let cur: string | null = parts.value[0]?.id ?? null
  for (const p of parts.value) {
    const el = document.getElementById(p.id)
    if (!el) continue
    if (el.getBoundingClientRect().top <= offset + NAV_SLOP) cur = p.id
  }
  if (cur === active.value) return
  active.value = cur
  /* 横条里的当前段要跟着滚进来：本页的锚点滚动只发生在横条内部时
     （点条目跳转），浏览器已把它带进视野；但**滚页面**换段时不会。
     取 nearest，已可见则原地不动。 */
  ensureActiveVisible()
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
    <header v-reveal class="page-head">
      <p class="eyebrow mono">Combat Formulas</p>
      <h1 class="page-title">{{ title }}</h1>
      <p class="page-sub">{{ FORMULA_GUIDE.sub }}</p>
    </header>

    <!-- 段导航：宽屏左侧索引 / 窄屏吸顶横条（ref 挂真正滚动的 .sn-list，见 base.css）。
         放在页头**之后**：它是本页的目录，不该挡在标题与正文之间的 Tab 序最前面
         （宽屏是 fixed、视觉位置与此无关；窄屏吸顶条只是首个视图里起点低了一格）。 -->
    <nav v-if="nav.length" class="section-nav" aria-label="战斗公式段落">
      <div ref="navEl" class="sn-list">
        <RouterLink
          v-for="n in nav"
          :key="n.id"
          class="sn-item mono"
          :class="{ active: active === n.id }"
          :aria-current="active === n.id ? 'location' : undefined"
          :to="{ hash: '#' + n.id }"
        >
          <span class="no" aria-hidden="true">{{ n.no }}</span>
          <span>{{ n.label }}</span>
        </RouterLink>
      </div>
      <NavScrollButton label="向右浏览段落" @click="scrollRight" />
    </nav>

    <!-- 长文不翻译（决策记录 0011）：非中文读者先读到「这页只有中文」，中文读者不需要 -->
    <p v-if="lang !== 'zh'" v-reveal="40" class="zh-only" role="note">
      <b class="mono">{{ t.longform.chineseOnly }}</b>
      <span>{{ t.longform.chineseOnlyNote }}</span>
    </p>

    <!-- 出处与提示：纯细线盒，无卡片堆叠 -->
    <aside v-reveal="90" class="notice measure" aria-label="阅读提示">
      <p class="notice-source">
        <span class="notice-tag mono">SOURCE</span>
        <a :href="FORMULA_GUIDE.sourceUrl" target="_blank" rel="noopener" class="source-link">
          {{ FORMULA_GUIDE.sourceTitle }}
        </a>
      </p>
      <!-- 版本锚定：机制整理版本 vs 站内数据版本必须同时给出——两者不一致时读者
           才知道该以哪一边为准（此前只写了「可能随版本调整」，没有可对照的版本号）。 -->
      <p class="notice-ver mono">
        <span class="notice-tag mono">VERSION</span>
        <span>机制整理 <span class="ver-key">2.0 版</span></span>
        <span class="ver-sep" aria-hidden="true">·</span>
        <span v-if="version">站内档案数据 <span class="ver-key">{{ versionLabel('LIVE') }}</span></span>
        <span v-else>站内档案数据 ···</span>
        <span v-if="updatedAt" class="ver-snap">（快照 {{ updatedAt }}）</span>
      </p>
      <ul class="notice-list">
        <li v-for="(n, i) in FORMULA_GUIDE.notice" :key="i">{{ n }}</li>
        <li>
          公式在档案里的落点：基础属性与技能数值随等级变化，可在
          <RouterLink to="/agents" class="notice-link">代理人名录</RouterLink>
          任一条目的「基础属性」区拖动等级滑条对照读数。
        </li>
      </ul>
    </aside>

    <DetailSection
      v-for="part in parts"
      :id="part.id"
      :key="part.id"
      v-reveal
      :no="part.no"
      :title="part.title"
      :en="part.en"
    >
      <p v-if="part.lead" class="part-lead measure">{{ part.lead }}</p>

      <div v-if="part.formulas?.length" class="eq-list">
        <FormulaEq v-for="(f, i) in part.formulas" :key="i" :formula="f" />
      </div>

      <div v-for="(g, gi) in part.groups" :key="gi" class="group">
        <h3 v-if="g.title" class="group-title mono">{{ g.title }}</h3>
        <p v-if="g.note" class="group-note measure">{{ g.note }}</p>

        <div class="items">
          <article v-for="item in g.items" :key="item.no" class="item">
            <span class="it-no" aria-hidden="true">{{ item.no }}</span>
            <div class="it-body">
              <!-- 标题层级随分组标题是否存在浮动：无组标题时条目名升为 h3，
                   避免 h2 → h4 跳级（axe heading-order，读屏大纲断链） -->
              <component :is="g.title ? 'h4' : 'h3'" class="it-title">{{ item.title }}</component>
              <p v-if="item.desc" class="it-desc measure">{{ item.desc }}</p>
              <FormulaEq v-if="item.formula" :formula="item.formula" />
            </div>
          </article>
        </div>
      </div>
    </DetailSection>
  </ListPage>
</template>

<style scoped>
/* 「本页仅中文」提示条：一行注记，不抢 header 的层级（细线 + 弱墨） */
.zh-only {
  margin-top: 18px;
  padding: 10px 12px;
  border-left: 2px solid var(--amber);
  background: var(--bg-1);
  font-size: var(--fs-caption);
  line-height: 1.7;
  color: var(--ink-2);
}
.zh-only b {
  display: block;
  color: var(--amber-hi);
  letter-spacing: 0.08em;
}

.notice {
  border: var(--rule);
  border-radius: 2px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: var(--space-inline);
  margin-bottom: var(--pad-section);
}

.notice-source {
  display: flex;
  align-items: baseline;
  gap: var(--space-inline);
  font-size: var(--fs-small);
  color: var(--ink-1);
  line-height: 1.6;
}

/* 版本锚定行：机制版本与数据版本并列，读者才知道该以哪一边为准 */
.notice-ver {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px;
  font-size: var(--fs-nano);
  letter-spacing: 0.1em;
  color: var(--ink-2);
}

.ver-key {
  color: var(--ink-0);
}

.ver-sep {
  color: var(--line-2);
}

.ver-snap {
  color: var(--ink-2);
}

.notice-link {
  color: var(--ink-0);
  border-bottom: 1px solid var(--line-2);
  transition: color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease);
}

@media (hover: hover) {
  .notice-link:hover {
    color: var(--amber-hi);
    border-color: var(--amber);
  }
}

.notice-tag {
  font-size: var(--fs-nano);
  letter-spacing: 0.22em;
  color: var(--ink-2);
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
  gap: var(--space-inline);
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

@media (min-width: 1200px) {
  .items {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 3em;
  }

  .items > .item:last-child:nth-child(odd) {
    grid-column: 1 / -1;
  }

  .item {
    grid-template-columns: 64px 1fr;
    gap: 20px;
  }
}
</style>
