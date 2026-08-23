<script setup lang="ts">
import { ref } from 'vue'
import { usePageMeta } from '@/composables/usePageMeta'
import { CATALOG } from '@/domain/catalog'
import {
  CatalogTable,
  DescRow,
  DetailSection,
  FilterDropdown,
  KeyValueGrid,
  ListPage,
  SearchField,
  type CatalogColumn,
} from '@/components'
import HollowImage from '@/components/HollowImage.vue'
import Rarity from '@/components/Rarity.vue'
import Tags from '@/components/Tags.vue'
import { contrastRatio } from '@/utils/contrast'

usePageMeta()

/* ---------- token 采集（运行时读取，杜绝二次维护） ---------- */

interface TokenRow {
  name: string
  desc: string
  value: string
}

/* ---------- WCAG 对比度标尺（运行时计算，token 零二次维护） ----------
   评测底从 token 实读：背景类评 ink-0 可读性，前景类评对 bg-0 的对比。
   token 读取惰性化：模块求值阶段不触碰 document（import 即执行的
   SSR/预渲染场景下不至于立即崩溃；当前为纯 SPA，setup 期完成采集） */

/** 惰性读取 :root 自定义属性（trim + 小写归一） */
function tokenOf(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim().toLowerCase()
}

type Graded = TokenRow & { cr: number | null }

function withCr(rows: TokenRow[], ground: string): Graded[] {
  return rows.map((r) => ({ ...r, cr: contrastRatio(r.value, tokenOf(ground)) }))
}

const surfaces = withCr(
  readTokens([
    ['--bg-0', '页面底色'],
    ['--bg-1', '抬升面板'],
    ['--bg-2', '卡面'],
    ['--bg-3', '悬停'],
  ]),
  '--ink-0', // 评 ink-0 在此底上的可读性
)

const lines = withCr(
  readTokens([
    ['--line-0', '细分隔'],
    ['--line-1', '主分隔'],
    ['--line-2', '强调分隔'],
  ]),
  '--bg-0', // 线色对页面底的可见性
)

const inks = withCr(
  readTokens([
    ['--ink-0', '正文'],
    ['--ink-1', '次级正文'],
    ['--ink-2', '弱化'],
    ['--ink-3', '最弱（装饰层）'],
  ]),
  '--bg-0',
)

const accents = withCr(
  readTokens([
    ['--amber', '信号琥珀'],
    ['--amber-hi', '琥珀高亮'],
    ['--amber-dim', '琥珀低透底'],
    ['--danger', '危险'],
    ['--ok', '通过'],
  ]),
  '--bg-0',
)

const semantic = withCr(
  readTokens([
    ['--focus', '焦点环'],
    ['--rank-s', '稀有度 S 金'],
    ['--rank-a', '稀有度 A 紫'],
    ['--rank-b', '稀有度 B 绿'],
    ['--violet', '派生技能徽标'],
  ]),
  '--bg-0',
)

function readTokens(keys: Array<[string, string]>): TokenRow[] {
  const cs = getComputedStyle(document.documentElement)
  return keys.map(([name, desc]) => ({ name, desc, value: cs.getPropertyValue(name).trim() }))
}

const typeTokens = readTokens([
  ['--serif', '衬线（标题族）'],
  ['--sans', '无衬线（正文族）'],
  ['--mono', '等宽（数据族）'],
])

/* 字号排版阶梯：全站唯一字号来源（组件不写裸 px） */
const typeScale = readTokens([
  ['--fs-badge', '徽标 / 键位角标'],
  ['--fs-nano', '微注释 / 编号'],
  ['--fs-micro', 'eyebrow / 表头 / 导航'],
  ['--fs-caption', '标签 / 元数据 / 表格行'],
  ['--fs-small', '辅助正文 / 筛选'],
  ['--fs-md', '次级正文 / 数值'],
  ['--fs-body', '正文基准'],
  ['--fs-lead', '强调值 / 行内标题'],
  ['--fs-subhead', '小节标题 / 卡片名'],
  ['--fs-title', '区块标题'],
  ['--fs-hero', '大数字'],
  ['--fs-display', '页面标题'],
])

const rhythm = readTokens([
  ['--pad-page', '页面水平留白'],
  ['--pad-section', '区块纵向节奏'],
  ['--rule', '细线规则'],
  ['--t-fast', '快速动效'],
  ['--t-med', '常规动效'],
])

/* ---------- 色彩对比度徽标 ---------- */

function crText(t: Graded): string {
  if (t.cr == null) return '—'
  return `${t.cr} · ${t.cr >= 7 ? 'AAA' : t.cr >= 4.5 ? 'AA' : 'LOW'}`
}

function crLow(t: Graded): boolean {
  return t.cr != null && t.cr < 4.5
}

/* ---------- 组件交互示例 ---------- */

const query = ref('')
const attr = ref<'all' | 200 | 201>('all')
const prof = ref<'all' | 1 | 2>('all')

const sampleColumns: CatalogColumn[] = [
  { key: 'name', label: '名称' },
  { key: 'en', label: '英文' },
  { key: 'path', label: '路径', cls: 'mono' },
]

const sampleRows = CATALOG.map((c) => ({ name: c.label, en: c.en, path: c.path }))
</script>

<template>
  <ListPage>
    <header class="page-head">
      <p class="eyebrow mono">Style Guide</p>
      <h1 class="page-title">设计系统</h1>
      <p class="page-sub">
        绳网档案的组件速查与设计 token 实况。所有视觉均来自
        <code>tokens.css</code> 与组件库，本页不额外定义任何新样式。
      </p>
    </header>

    <DetailSection no="01" title="色彩">
      <div class="grid">
        <div v-for="c in surfaces" :key="c.name" class="swatch">
          <span class="chip-color" :style="{ background: c.value }" />
          <span class="meta mono"><b>{{ c.name }}</b> · {{ c.desc }}</span>
          <span class="val mono">{{ c.value }}</span>
          <span class="cr mono" :class="{ low: crLow(c) }">{{ crText(c) }}</span>
        </div>
        <div v-for="c in lines" :key="c.name" class="swatch">
          <span class="chip-color" :style="{ background: c.value }" />
          <span class="meta mono"><b>{{ c.name }}</b> · {{ c.desc }}</span>
          <span class="val mono">{{ c.value }}</span>
          <span class="cr mono" :class="{ low: crLow(c) }">{{ crText(c) }}</span>
        </div>
        <div v-for="c in inks" :key="c.name" class="swatch">
          <span class="chip-color" :style="{ background: c.value }" />
          <span class="meta mono"><b>{{ c.name }}</b> · {{ c.desc }}</span>
          <span class="val mono">{{ c.value }}</span>
          <span class="cr mono" :class="{ low: crLow(c) }">{{ crText(c) }}</span>
        </div>
        <div v-for="c in accents" :key="c.name" class="swatch">
          <span class="chip-color" :style="{ background: c.value }" />
          <span class="meta mono"><b>{{ c.name }}</b> · {{ c.desc }}</span>
          <span class="val mono">{{ c.value }}</span>
          <span class="cr mono" :class="{ low: crLow(c) }">{{ crText(c) }}</span>
        </div>
        <div v-for="c in semantic" :key="c.name" class="swatch">
          <span class="chip-color" :style="{ background: c.value }" />
          <span class="meta mono"><b>{{ c.name }}</b> · {{ c.desc }}</span>
          <span class="val mono">{{ c.value }}</span>
          <span class="cr mono" :class="{ low: crLow(c) }">{{ crText(c) }}</span>
        </div>
      </div>
      <p class="scale-note">
        对比度标尺按 WCAG：<code>AAA ≥ 7:1</code>、<code>AA ≥ 4.5:1</code>（正文基准，背景类评
        <code>ink-0</code> 可读性，其余评对 <code>bg-0</code> 的对比）；<code>LOW</code> 仅允许
        装饰性最弱层或非 hex 展示。属性元素色与稀有度色属 <code>domain/enums.ts</code> 数据契约
        （游戏语义色），不在样式 token 之列、不做此表裁剪。
      </p>
    </DetailSection>

    <DetailSection no="02" title="字体与排版阶梯">
      <div class="type-block">
        <div v-for="t in typeTokens" :key="t.name" class="type-row">
          <span class="type-name mono">{{ t.name }}</span>
          <span class="type-preview" :style="{ fontFamily: t.value }">
            绳网档案 Ropeweb Archive 0123456789
          </span>
          <span class="val mono">{{ t.value }}</span>
        </div>
      </div>
      <p class="scale-note">
        字号一律取自 <code>--fs-*</code> 排版阶梯，组件禁止写裸 px；相邻档位语义不可混用。
      </p>
      <div class="type-scale">
        <div v-for="s in typeScale" :key="s.name" class="scale-row">
          <span class="scale-name mono">{{ s.name }}</span>
          <span
            class="scale-preview"
            :style="{ fontSize: s.value, lineHeight: 1.4 }"
          >绳网档案 0123456789</span>
          <span class="val mono">{{ s.value }}</span>
          <span class="scale-desc">{{ s.desc }}</span>
        </div>
      </div>
      <ul class="rhythm">
        <li v-for="r in rhythm" :key="r.name" class="mono">
          <b>{{ r.name }}</b> = {{ r.value }} · {{ r.desc }}
        </li>
      </ul>
    </DetailSection>

    <DetailSection no="03" title="检索与筛选">
      <div class="demo-col">
        <SearchField v-model="query" :count="4" placeholder="检索示例…" />
        <FilterDropdown v-model:attr="attr" v-model:prof="prof" />
      </div>
    </DetailSection>

    <DetailSection no="04" title="表格（CatalogTable 列配置驱动）">
      <CatalogTable :columns="sampleColumns" :items="sampleRows">
        <template #cell-name="{ row }">
          <RouterLink :to="row.path" class="name-link">{{ row.name }}</RouterLink>
        </template>
      </CatalogTable>
    </DetailSection>

    <DetailSection no="05" title="详情行与数值网格">
      <DescRow
        no="01"
        title="普通攻击"
        :html="'<svg class=\'rich-key\' viewBox=\'0 0 24 24\' aria-hidden=\'true\'><rect x=\'1.5\' y=\'1.5\' width=\'21\' height=\'21\' rx=\'1\' fill=\'none\' stroke=\'currentColor\'/><path d=\'M8 8h8v3l-2 2v3h-4v-3l-2-2z\' fill=\'currentColor\'/></svg> 三连击'"
        variant="skill"
      />
      <DescRow no="02" title="影画一" text="纯文本描述示例" text2="剧情札记（lore）示例：发丝线分隔的档案注记。" variant="talent" />
      <KeyValueGrid
        :items="[
          { label: '生命值', value: '12,340' },
          { label: '暴击率', value: '5.00%' },
          { label: '冲击力', value: '96', tag: '主属性' },
        ]"
      />
    </DetailSection>

    <DetailSection no="06" title="徽记与占位">
      <div class="inline-row">
        <Rarity :rank="4" />
        <Rarity :rank="3" />
        <Rarity :rank="2" />
        <Tags :element="201" :specialty="1" />
        <span class="img-wrap">
          <HollowImage :srcs="[]" alt="占位" :fallback="'占位'" />
        </span>
      </div>
    </DetailSection>

    <DetailSection no="07" title="命名规范">
      <ul class="norms">
        <li>组件：PascalCase 单文件（<code>SearchField.vue</code>），职责单一、纯 props/emits。</li>
        <li>组合函数：<code>useXxx</code>（异步状态机 / 列表筛选 / 路由参数 / 页面元信息）。</li>
        <li>领域：<code>domain/</code> 只放枚举、schema、类目元信息（无 Vue 依赖）。</li>
        <li>视觉：1px 细线、2px 圆角、等宽数据、纸墨配色；禁止渐变霓虹与圆角卡片堆叠。</li>
        <li>字号：一律取 <code>--fs-*</code> 排版阶梯；配色一律取 <code>--bg-* / --ink-* / --amber*</code> 语义 token。</li>
      </ul>
    </DetailSection>
  </ListPage>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1px;
  background: var(--line-1);
  border: var(--rule);
}

.swatch {
  background: var(--bg-2);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chip-color {
  height: 34px;
  border: 1px solid var(--line-1);
  border-radius: 2px;
}

.meta,
.val {
  font-size: var(--fs-micro);
}

.meta b {
  color: var(--ink-0);
}

.val {
  color: var(--ink-2);
}

/* WCAG 对比度徽标：达标 ink-3，不达标 danger（runtime 计算，改动 token 即时反映） */
.cr {
  font-size: var(--fs-nano);
  letter-spacing: 0.08em;
  color: var(--ink-3);
}

.cr.low {
  color: var(--danger);
}

.type-block {
  border: var(--rule);
}

.type-row {
  display: grid;
  grid-template-columns: 90px 1fr auto;
  gap: 16px;
  align-items: center;
  padding: 14px 16px;
  border-bottom: var(--rule);
}

.type-name {
  color: var(--ink-2);
  font-size: var(--fs-caption);
}

.type-preview {
  font-size: var(--fs-body);
  color: var(--ink-0);
}

/* 排版阶梯陈列：token 名 / 真实字号预览 / 值 / 用途 */
.scale-note {
  margin-top: 18px;
  font-size: var(--fs-small);
  color: var(--ink-2);
  line-height: 1.7;
}

.scale-note code {
  font-family: var(--mono);
  font-size: var(--fs-caption);
  color: var(--amber);
}

.type-scale {
  margin-top: 14px;
  border: var(--rule);
}

.scale-row {
  display: grid;
  grid-template-columns: 96px 1fr auto 130px;
  gap: 16px;
  align-items: baseline;
  padding: 10px 16px;
  border-bottom: var(--rule);
}

.scale-row:last-child {
  border-bottom: none;
}

.scale-name {
  color: var(--ink-2);
  font-size: var(--fs-caption);
}

.scale-preview {
  font-family: var(--sans);
  color: var(--ink-0);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.scale-desc {
  font-size: var(--fs-caption);
  color: var(--ink-3);
  text-align: right;
}

.rhythm {
  list-style: none;
  margin-top: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: var(--fs-caption);
  color: var(--ink-2);
}

.rhythm b {
  color: var(--ink-1);
}

.demo-col {
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: flex-start;
}

.name-link {
  color: var(--amber-hi);
  font-size: var(--fs-body);
}

.inline-row {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.img-wrap {
  width: 40px;
  height: 40px;
  display: block;
}

.norms {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: var(--fs-small);
  color: var(--ink-1);
  line-height: 1.7;
}

.norms code {
  font-family: var(--mono);
  font-size: var(--fs-caption);
  color: var(--amber);
}
</style>
