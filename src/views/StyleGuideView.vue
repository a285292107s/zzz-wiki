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
  SearchField,
  type CatalogColumn,
} from '@/components'
import HollowImage from '@/components/HollowImage.vue'
import Rarity from '@/components/Rarity.vue'
import Tags from '@/components/Tags.vue'

usePageMeta('设计系统')

/* ---------- token 采集（运行时读取，杜绝二次维护） ---------- */

interface TokenRow {
  name: string
  desc: string
  value: string
}

function readTokens(keys: Array<[string, string]>): TokenRow[] {
  const cs = getComputedStyle(document.documentElement)
  return keys.map(([name, desc]) => ({ name, desc, value: cs.getPropertyValue(name).trim() }))
}

const surfaces = readTokens([
  ['--bg-0', '页面底色'],
  ['--bg-1', '抬升面板'],
  ['--bg-2', '卡面'],
  ['--bg-3', '悬停'],
])

const lines = readTokens([
  ['--line-0', '细分隔'],
  ['--line-1', '主分隔'],
  ['--line-2', '强调分隔'],
])

const inks = readTokens([
  ['--ink-0', '正文'],
  ['--ink-1', '次级正文'],
  ['--ink-2', '弱化'],
  ['--ink-3', '最弱'],
])

const accents = readTokens([
  ['--amber', '信号琥珀'],
  ['--amber-hi', '琥珀高亮'],
  ['--danger', '危险'],
  ['--ok', '通过'],
])

const typeTokens = readTokens([
  ['--serif', '衬线（标题族）'],
  ['--sans', '无衬线（正文族）'],
  ['--mono', '等宽（数据族）'],
])

const rhythm = readTokens([
  ['--pad-page', '页面水平留白'],
  ['--pad-section', '区块纵向节奏'],
  ['--rule', '细线规则'],
  ['--t-fast', '快速动效'],
  ['--t-med', '常规动效'],
])

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
  <div class="wrap page">
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
        </div>
        <div v-for="c in lines" :key="c.name" class="swatch">
          <span class="chip-color" :style="{ background: c.value }" />
          <span class="meta mono"><b>{{ c.name }}</b> · {{ c.desc }}</span>
          <span class="val mono">{{ c.value }}</span>
        </div>
        <div v-for="c in inks" :key="c.name" class="swatch">
          <span class="chip-color" :style="{ background: c.value }" />
          <span class="meta mono"><b>{{ c.name }}</b> · {{ c.desc }}</span>
          <span class="val mono">{{ c.value }}</span>
        </div>
        <div v-for="c in accents" :key="c.name" class="swatch">
          <span class="chip-color" :style="{ background: c.value }" />
          <span class="meta mono"><b>{{ c.name }}</b> · {{ c.desc }}</span>
          <span class="val mono">{{ c.value }}</span>
        </div>
      </div>
    </DetailSection>

    <DetailSection no="02" title="字体与节奏">
      <div class="type-block">
        <div v-for="t in typeTokens" :key="t.name" class="type-row">
          <span class="type-name mono">{{ t.name }}</span>
          <span class="type-preview" :style="{ fontFamily: t.value }">
            绳网档案 Ropeweb Archive 0123456789
          </span>
          <span class="val mono">{{ t.value }}</span>
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
        :html="'<span class=\'rich-key\'>本地 SVG 键位</span> 三连击'"
        variant="skill"
      />
      <DescRow no="02" title="影画一" text="纯文本描述示例" variant="talent" />
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
      </ul>
    </DetailSection>
  </div>
</template>

<style scoped>
.page {
  padding-top: calc(var(--pad-section) * 0.9);
}

.page-head {
  margin-bottom: var(--pad-section);
}

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
  font-size: 11.5px;
}

.meta b {
  color: var(--ink-0);
}

.val {
  color: var(--ink-2);
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
  font-size: 12px;
}

.type-preview {
  font-size: 15px;
  color: var(--ink-0);
}

.rhythm {
  list-style: none;
  margin-top: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12.5px;
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
  font-size: 15px;
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
  font-size: 13.5px;
  color: var(--ink-1);
  line-height: 1.7;
}

.norms code {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--amber);
}
</style>