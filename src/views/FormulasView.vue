<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { usePageMeta } from '@/composables/usePageMeta'
import { useLocale } from '@/composables/useLocale'
import { useUiText } from '@/composables/useUiText'
import { useNavScrollable } from '@/composables/useNavScrollable'
import { useDataVersion } from '@/composables/useDataVersion'
import { useDetailNavigation } from '@/composables/useDetailNavigation'
import { FORMULA_GUIDE } from '@/data/formulaGuide'
import { ListPage, DetailSection } from '@/components'
import NavScrollButton from '@/components/NavScrollButton.vue'
import FormulaMath from '@/components/formula/FormulaMath.vue'
import FamilyMatrix from '@/components/formula/FamilyMatrix.vue'
import ZoneLedger from '@/components/formula/ZoneLedger.vue'
import SettlementBench from '@/components/formula/SettlementBench.vue'
import DefenseLab from '@/components/formula/DefenseLab.vue'
import DazeLab from '@/components/formula/DazeLab.vue'
import ShieldLab from '@/components/formula/ShieldLab.vue'
import InterruptLab from '@/components/formula/InterruptLab.vue'

const { lang } = useLocale()
const { t } = useUiText()

usePageMeta(FORMULA_GUIDE.title, FORMULA_GUIDE.sub)

const parts = FORMULA_GUIDE.parts
const nav = computed(() => parts.map((p) => ({ id: p.id, no: p.no, label: p.title })))

const { activeSection, activate } = useDetailNavigation()
const { navEl, scrollRight, ensureActiveVisible } = useNavScrollable()

watch(activeSection, () => ensureActiveVisible())
onMounted(() => activate(parts.map((p) => p.id)))

const { version, updatedAt, versionLabel } = useDataVersion()
</script>

<template>
  <ListPage>
    <header v-reveal class="page-head">
      <p class="eyebrow mono">Combat Formulas</p>
      <h1 class="page-title">{{ FORMULA_GUIDE.title }}</h1>
      <p class="hero">{{ FORMULA_GUIDE.hero }}</p>
      <p class="page-sub">{{ FORMULA_GUIDE.sub }}</p>
    </header>

    <nav v-if="nav.length" class="section-nav" aria-label="战斗公式段落">
      <div ref="navEl" class="sn-list">
        <RouterLink
          v-for="n in nav"
          :key="n.id"
          class="sn-item mono"
          :class="{ active: activeSection === n.id }"
          :aria-current="activeSection === n.id ? 'location' : undefined"
          :to="{ hash: '#' + n.id }"
        >
          <span class="no" aria-hidden="true">{{ n.no }}</span>
          <span>{{ n.label }}</span>
        </RouterLink>
      </div>
      <NavScrollButton label="向右浏览段落" @click="scrollRight" />
    </nav>

    <p v-if="lang !== 'zh'" v-reveal="40" class="zh-only" role="note">
      <b class="mono">{{ t.longform.chineseOnly }}</b>
      <span>{{ t.longform.chineseOnlyNote }}</span>
    </p>

    <aside v-reveal="90" class="notice measure" aria-label="出处与口径">
      <div class="notice-source-group">
        <span class="notice-tag mono">SOURCE</span>
        <div class="source-body">
          <p class="source-title">{{ FORMULA_GUIDE.source.title }}</p>
          <p class="source-byline">
            {{ FORMULA_GUIDE.source.byline }}
            <span class="source-dates">
              <span class="byline-sep" aria-hidden="true">·</span>
              {{ FORMULA_GUIDE.source.dates }}
            </span>
          </p>
          <ul class="source-outlets">
            <li v-for="o in FORMULA_GUIDE.source.outlets" :key="o.url" class="source-outlet">
              <a :href="o.url" target="_blank" rel="noopener" class="source-link">{{ o.label }}</a>
              <span class="source-note">{{ o.note }}</span>
            </li>
          </ul>
        </div>
      </div>
      <p class="notice-ver mono">
        <span class="notice-tag mono">VERSION</span>
        <span>机制整理 <span class="ver-key">2.0 版</span></span>
        <span class="ver-sep" aria-hidden="true">·</span>
        <span v-if="version">站内档案数据 <span class="ver-key">{{ versionLabel('LIVE') }}</span></span>
        <span v-else>站内档案数据 ···</span>
        <span v-if="updatedAt" class="ver-snap">（快照 {{ updatedAt }}）</span>
      </p>
      <div class="notice-scope">
        <p class="notice-tag mono">SCOPE</p>
        <ul class="notice-list">
          <li v-for="(n, i) in FORMULA_GUIDE.notice" :key="i">{{ n }}</li>
          <li>
            公式对应的站内页面：基础属性与技能数值随等级变化，可在
            <RouterLink to="/agents" class="notice-link">代理人名录</RouterLink>
            任一条目的「基础属性」区拖动等级滑条对照读数。
          </li>
        </ul>
      </div>
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
      <p class="part-lead measure">{{ part.lead }}</p>

      <template v-for="(block, bi) in part.blocks" :key="bi">
        <p
          v-if="block.k === 'prose'"
          class="prose measure"
          :class="{ 'prose-coda': bi === part.blocks.length - 1 }"
        >{{ block.text }}</p>

        <ol v-else-if="block.k === 'rules'" class="rules">
          <li v-for="(rule, ri) in block.items" :key="rule.title" class="rule">
            <span class="rule-no mono" aria-hidden="true">{{ String(ri + 1).padStart(2, '0') }}</span>
            <h3 class="rule-title">{{ rule.title }}</h3>
            <p class="rule-text">{{ rule.text }}</p>
          </li>
        </ol>

        <FamilyMatrix v-else-if="block.k === 'families'" />

        <SettlementBench v-else-if="block.k === 'bench'" />

        <ZoneLedger v-else-if="block.k === 'zones'" :ids="block.ids" />

        <div v-else-if="block.k === 'formula'" class="formula-block">
          <p class="block-label mono">{{ block.label }}</p>
          <div class="formula-body">
            <FormulaMath :tokens="block.formula" size="lg" />
          </div>
          <p v-if="block.note" class="block-note">{{ block.note }}</p>
        </div>

        <div v-else-if="block.k === 'table'" class="table-block">
          <h3 v-if="block.title" class="block-title">{{ block.title }}</h3>
          <div
            v-scroll-region="block.title ? `${block.title}（表格，可横向滚动）` : '数据表（可横向滚动）'"
            class="table-wrap"
          >
            <table class="hairline-table" :style="{ minWidth: block.width === 'wide' ? '760px' : '440px' }">
              <thead>
                <tr>
                  <th v-for="col in block.columns" :key="col" scope="col">{{ col }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, ri) in block.rows" :key="ri">
                  <th v-for="(cell, ci) in row" :key="ci" :scope="ci === 0 ? 'row' : undefined">
                    {{ cell }}
                  </th>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="block.note" class="block-note">{{ block.note }}</p>
        </div>

        <div v-else-if="block.k === 'cards'" class="cards">
          <h3 v-if="block.title" class="block-title">{{ block.title }}</h3>
          <p v-if="block.note" class="block-note">{{ block.note }}</p>
          <div class="card-grid">
            <article v-for="item in block.items" :key="item.name" class="card-item">
              <h4 class="card-name">
                {{ item.name }}
                <span v-if="item.en" class="card-en mono">{{ item.en }}</span>
              </h4>
              <ul class="card-lines">
                <li v-for="(line, li) in item.lines" :key="li">{{ line }}</li>
              </ul>
            </article>
          </div>
        </div>

        <div v-else-if="block.k === 'facts'" class="facts">
          <h3 v-if="block.title" class="block-title">{{ block.title }}</h3>
          <dl class="fact-list">
            <div v-for="f in block.items" :key="f.k" class="fact">
              <dt>{{ f.k }}</dt>
              <dd>{{ f.v }}</dd>
            </div>
          </dl>
        </div>

        <DefenseLab v-else-if="block.k === 'defense-lab'" />
        <DazeLab v-else-if="block.k === 'daze-lab'" />
        <ShieldLab v-else-if="block.k === 'shield-lab'" />
        <InterruptLab v-else-if="block.k === 'interrupt-lab'" />
      </template>
    </DetailSection>

    <p class="colophon">
      本页算式均可复算：代入游戏内读数，所得系数即结算实际生效的系数。
      读数不符时，先查是否有乘区被跳过，或被有效范围截断。
    </p>
  </ListPage>
</template>

<style scoped>
.hero {
  margin-top: 14px;
  font-family: var(--serif);
  font-size: var(--fs-title);
  line-height: 1.6;
  color: var(--ink-0);
  max-width: 30ch;
}

.page-head .page-sub {
  margin-top: 12px;
}

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

@media (min-width: 900px) {
  aside.notice {
    max-width: none;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-content: start;
    gap: var(--space-inline) clamp(28px, 4vw, 56px);
    padding: 20px clamp(20px, 2.4vw, 28px) 22px;
  }

  aside.notice > p,
  aside.notice > .notice-source-group {
    grid-column: 1;
  }

  aside.notice > .notice-scope {
    grid-column: 2;
    grid-row: 1 / span 3;
    padding-left: clamp(18px, 2.2vw, 26px);
    border-left: 1px solid var(--line-0);
  }
}

.notice-scope {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.notice-source-group {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 3px 8px;
  min-width: 0;
}

.source-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.source-title {
  font-family: var(--serif);
  font-size: var(--fs-md);
  line-height: 1.55;
  color: var(--ink-0);
}

.source-byline {
  font-size: var(--fs-caption);
  line-height: 1.7;
  color: var(--ink-2);
}

.source-dates {
  white-space: nowrap;
}

@media (max-width: 559px) {
  .byline-sep {
    display: none;
  }
}

.byline-sep {
  margin-inline: 3px;
  color: var(--line-2);
}

.source-outlets {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 20px;
  margin-top: 2px;
}

.source-outlet {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
  font-size: var(--fs-small);
  color: var(--ink-1);
  line-height: 1.6;
}

.notice-tag {
  font-size: var(--fs-nano);
  letter-spacing: 0.22em;
  color: var(--ink-2);
  flex: none;
}

.source-link {
  color: var(--ink-0);
  padding-block: 2px;
  border-bottom: 1px solid var(--line-1);
  transition: color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease);
}

.source-link:hover {
  color: var(--amber-hi);
  border-color: var(--amber);
}

.source-note {
  color: var(--ink-2);
  font-size: var(--fs-caption);
}

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
  margin-bottom: 22px;
}

.prose {
  font-size: var(--fs-md);
  line-height: 1.9;
  color: var(--ink-1);
  margin-bottom: 20px;
}

.prose-coda {
  margin-top: var(--space-group);
  margin-bottom: 0;
  padding-top: 16px;
  border-top: var(--rule);
  font-size: var(--fs-small);
  line-height: 1.85;
  color: var(--ink-2);
}

.rules {
  display: flex;
  flex-direction: column;
  margin-bottom: var(--space-group);
  border-top: var(--rule);
  border-bottom: var(--rule);
}

.rule {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 3px 14px;
  padding-block: 15px;
  border-bottom: 1px solid var(--line-0);
}

.rule:first-child {
  padding-top: 16px;
}

.rule:last-child {
  padding-bottom: 16px;
  border-bottom: 0;
}

.rule-no {
  font-size: var(--fs-nano);
  letter-spacing: 0.16em;
  font-variant-numeric: tabular-nums;
  color: var(--amber);
  padding-top: 5px;
}

.rule-title {
  font-family: var(--serif);
  font-weight: 500;
  font-size: var(--fs-lead);
  line-height: 1.5;
  color: var(--ink-0);
}

.rule-text {
  grid-column: 2;
  max-width: 62ch;
  font-size: var(--fs-md);
  line-height: 1.85;
  color: var(--ink-1);
}

.formula-block {
  margin-bottom: var(--space-group);
}

.block-label {
  font-size: var(--fs-nano);
  letter-spacing: 0.2em;
  color: var(--ink-2);
}

.formula-body {
  margin-top: 10px;
  padding: 14px 16px;
  border-left: 2px solid var(--amber);
  background: var(--bg-2);
}

.block-note {
  margin-top: 10px;
  max-width: 68ch;
  font-size: var(--fs-caption);
  line-height: 1.8;
  color: var(--ink-2);
}

.block-title {
  font-family: var(--serif);
  font-weight: 500;
  font-size: var(--fs-lead);
  color: var(--ink-0);
  margin-bottom: 12px;
}

.table-block,
.cards,
.facts {
  margin-bottom: var(--space-group);
}

.table-wrap {
  position: relative;
  overflow-x: auto;
}

.table-wrap table {
  font-size: var(--fs-caption);
}

.table-wrap th[scope='row'] {
  font-family: var(--serif);
  font-weight: 400;
  font-size: var(--fs-caption);
  letter-spacing: 0;
  text-transform: none;
  color: var(--ink-0);
  white-space: nowrap;
}

.table-wrap td {
  font-size: var(--fs-caption);
  line-height: 1.75;
  color: var(--ink-1);
}

.cards .card-grid {
  display: grid;
  gap: 20px var(--space-group);
}

.card-item {
  padding-left: 16px;
  border-left: 1px solid var(--line-1);
}

.card-name {
  font-family: var(--serif);
  font-weight: 500;
  font-size: var(--fs-md);
  color: var(--ink-0);
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
}

.card-en {
  font-size: var(--fs-nano);
  letter-spacing: 0.16em;
  color: var(--ink-2);
}

.card-lines {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.card-lines li {
  font-size: var(--fs-caption);
  line-height: 1.8;
  color: var(--ink-1);
}

.fact-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  border-top: var(--rule);
  padding-top: 16px;
}

.fact {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 2px 16px;
}

.fact dt {
  font-size: var(--fs-caption);
  letter-spacing: 0.06em;
  color: var(--ink-2);
}

.fact dd {
  max-width: 68ch;
  font-size: var(--fs-small);
  line-height: 1.85;
  color: var(--ink-1);
}

.colophon {
  margin-top: var(--space-group);
  padding-top: 18px;
  border-top: var(--rule);
  max-width: 68ch;
  font-size: var(--fs-small);
  line-height: 1.85;
  color: var(--ink-2);
}

@media (min-width: 720px) {
  .fact {
    grid-template-columns: 128px minmax(0, 1fr);
    align-items: baseline;
  }
}

@media (min-width: 900px) {
  .cards .card-grid {
    display: block;
    column-count: 2;
    column-gap: clamp(28px, 4vw, 56px);
  }

  .card-item {
    break-inside: avoid;
    margin-bottom: 20px;
  }
}
</style>
