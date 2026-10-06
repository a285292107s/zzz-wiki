<script setup lang="ts">
/**
 * AboutView — 数据说明（面向读者的出处与机制页）。
 *
 * 站点此前只有开发者文档（DATA_GUIDE）与页脚一行版权；本页把「数据从哪来、
 * 覆盖什么、怎么更新、怎么校验、版权归属」写给读者——资料档案站的可信度
 * 来自可核查的出处，也是 Webby/FWA 这类评审在意的「编辑严谨性」。
 *
 * 所有事实取自仓库现状（不得杜撰）：来源与合规约定、sync 流程与门禁、
 * 资产管理方式、版权声明。数字（各类目收录量/版本/更新日）全部动态取，
 * 避免与数据漂移。
 */
import { computed, onMounted, ref } from 'vue'
import { CATALOG } from '@/domain/catalog'
import { listFor } from '@/data/resources'
import { dataVersions } from '@/data/api'
import { usePageMeta } from '@/composables/usePageMeta'
import { ListPage, DetailSection } from '@/components'

usePageMeta(
  '数据说明',
  '绳网档案的数据来源、覆盖范围、更新机制、校验门禁与版权声明——可核查的档案出处。',
)

/** 各类目收录量：与名录页同源（api 层缓存，进入本页基本零网络） */
const counts = ref<Record<string, number>>({})
const version = ref('')
const updatedAt = ref('')

onMounted(() => {
  for (const c of CATALOG) {
    void listFor<Record<string, unknown>>(c)
      .then((rows) => {
        counts.value = { ...counts.value, [c.path]: rows.length }
      })
      .catch(() => {
        /* 计数失败不阻断页面（显示占位 ···） */
      })
  }
  void dataVersions()
    .then((v) => {
      version.value = v.live
      const t = v.generated ? new Date(v.generated) : null
      if (t && !Number.isNaN(t.getTime())) {
        updatedAt.value = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(
          t.getDate(),
        ).padStart(2, '0')}`
      }
    })
    .catch(() => {
      /* manifest 缺失时版本行不显示数值 */
    })
})

/** 档案规格账目：类目 / 收录量（动态） */
const ledger = computed(() =>
  CATALOG.map((c) => ({
    no: c.no,
    label: c.label,
    en: c.en,
    count: counts.value[c.path],
  })),
)

const total = computed(() => {
  const vals = Object.values(counts.value)
  return vals.length === CATALOG.length ? vals.reduce((a, b) => a + b, 0) : null
})

const fmt = (n: number | null | undefined) => (typeof n === 'number' ? String(n) : '···')
</script>

<template>
  <ListPage>
    <header v-reveal class="page-head">
      <p class="eyebrow mono">Colophon</p>
      <h1 class="page-title">数据说明</h1>
      <p class="page-sub">
        本站以档案编号为纲，只做客观陈列：数据取自公开数据源，构建期落地为静态档案，
        运行时不经任何外部服务。以下说明收录范围、更新机制、校验门禁与版权归属。
      </p>
    </header>

    <!-- 档案规格：版本 / 更新日 / 收录总量（数字全部动态取，避免与数据漂移） -->
    <aside v-reveal="80" class="spec" aria-label="档案规格">
      <dl class="spec-list">
        <div class="spec-item">
          <dt>数据版本</dt>
          <dd class="mono">{{ version ? `LIVE ${version}` : '···' }}</dd>
        </div>
        <div class="spec-item">
          <dt>最近更新</dt>
          <dd class="mono">{{ updatedAt || '···' }}</dd>
        </div>
        <div class="spec-item">
          <dt>收录总量</dt>
          <dd class="mono">{{ fmt(total) }} 条</dd>
        </div>
      </dl>
      <ul class="spec-cats">
        <li v-for="l in ledger" :key="l.en" class="spec-cat">
          <span class="no mono">{{ l.no }}</span>
          <span class="label">{{ l.label }}</span>
          <span class="en mono">{{ l.en }}</span>
          <span class="count mono">{{ fmt(l.count) }}</span>
        </li>
      </ul>
    </aside>

    <DetailSection v-reveal id="source" no="01" title="数据来源与范围" en="Source">
      <p class="prose">
        条目数据取自公开数据源 <strong> hakushin raw </strong>（由
        <a href="https://zzz.nanoka.cc" target="_blank" rel="noopener" class="ext">zzz.nanoka.cc</a>
        及其同源 CDN 提供），在构建期一次性拉取并规整为静态 JSON，随仓库一起入库。
        前端运行时只读本地 <code class="mono">/data</code>，不请求任何外部接口。
      </p>
      <p class="prose">
        <strong>只收录正式服（live）数据</strong>：源站的前瞻与测试服内容不拉取、不降级、不补位——
        避免未上线内容提前流出。数据版本号从归档清单动态读取，不在代码中写死。
      </p>
    </DetailSection>

    <DetailSection v-reveal id="update" no="02" title="更新机制" en="Pipeline">
      <ol class="steps">
        <li>
          <span class="step-no mono">01</span>
          <span class="step-txt">定时任务探测源站版本；无新版本则直接结束，不产生提交。</span>
        </li>
        <li>
          <span class="step-no mono">02</span>
          <span class="step-txt">有新版本时重建名录与详情 JSON，并增量补齐缺失的图标与头图派生图（已有美术资源不重复下载）。</span>
        </li>
        <li>
          <span class="step-no mono">03</span>
          <span class="step-txt">跑数据契约校验（名录与详情必须一一对应）；校验不通过则整批不提交，站点停留在上一次的好数据上。</span>
        </li>
        <li>
          <span class="step-no mono">04</span>
          <span class="step-txt">校验通过后一次性提交，触发部署；部署只构建已提交的快照，不在构建期访问数据源。</span>
        </li>
      </ol>
    </DetailSection>

    <DetailSection v-reveal id="assets" no="03" title="资产与校验" en="Assets">
      <p class="prose">
        图标、西文字体与中文衬线（按字形分片、用到才加载）、首页头图派生小图，全部本地化入库；
        页面不做任何跨域请求，离线打开已缓存页面仍可阅读。
      </p>
      <ul class="checks">
        <li><span class="ck mono">契约</span>名录↔详情一一对应、字段 schema 校验</li>
        <li><span class="ck mono">图标</span>清单内零缺失（源站个别缺口如实标注、不破图）</li>
        <li><span class="ck mono">字体</span>西文与中文分片完整性（分片缺失会让个别字回退字形，故单独设防）</li>
        <li><span class="ck mono">体积</span>主包与样式体积预算、站点地图条数下限</li>
      </ul>
    </DetailSection>

    <DetailSection v-reveal id="rights" no="04" title="版权与免责" en="Rights">
      <p class="prose">
        本站为社区爱好者制作的<strong>非官方</strong>资料站，与米哈游 / HoYoverse 无隶属或合作关系。
        游戏数据与美术资源的版权、商标归米哈游 / HoYoverse 所有；本站仅作结构化陈列与检索，
        不含商业用途。数据或素材权利人如认为本站展示不当，可联系撤下。
      </p>
    </DetailSection>
  </ListPage>
</template>

<style scoped>
/* ---------- 档案规格 ---------- */

.spec {
  border: var(--rule);
  border-radius: 2px;
  background: var(--bg-1);
  padding: 18px 20px 12px;
  margin-bottom: var(--space-section);
}

.spec-list {
  display: flex;
  flex-wrap: wrap;
  gap: 28px;
  margin: 0 0 16px;
}

.spec-item dt {
  font-size: var(--fs-nano);
  letter-spacing: 0.2em;
  color: var(--ink-2);
  margin-bottom: 5px;
}

.spec-item dd {
  font-size: var(--fs-lead);
  color: var(--ink-0);
  letter-spacing: 0.04em;
}

.spec-cats {
  list-style: none;
  border-top: 1px solid var(--line-0);
  padding: 0;
}

.spec-cat {
  display: grid;
  grid-template-columns: 34px 1fr auto 60px;
  align-items: baseline;
  gap: 12px;
  padding: 9px 2px;
  border-bottom: 1px solid var(--line-0);
}

.spec-cat .no {
  font-size: var(--fs-nano);
  color: var(--amber);
}

.spec-cat .label {
  font-family: var(--serif);
  font-size: var(--fs-md);
  color: var(--ink-0);
}

.spec-cat .en {
  font-size: var(--fs-nano);
  letter-spacing: 0.18em;
  color: var(--ink-2);
}

.spec-cat .count {
  font-size: var(--fs-md);
  color: var(--ink-1);
  text-align: right;
}

/* ---------- 正文 ---------- */

.prose {
  color: var(--ink-1);
  font-size: var(--fs-md);
  line-height: 1.95;
  max-width: 68ch;
}

.prose + .prose {
  margin-top: 14px;
}

.prose strong {
  color: var(--ink-0);
  font-weight: 500;
}

.prose code {
  font-size: 0.92em;
  color: var(--ink-0);
  border-bottom: 1px solid var(--line-1);
}

.ext {
  color: var(--ink-0);
  border-bottom: 1px solid var(--line-1);
  transition: color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease);
}

@media (hover: hover) {
  .ext:hover {
    color: var(--amber-hi);
    border-color: var(--amber);
  }
}

/* ---------- 更新流程 ---------- */

.steps {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 74ch;
}

.steps li {
  display: grid;
  grid-template-columns: 32px 1fr;
  gap: 10px;
  align-items: baseline;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line-0);
}

.steps li:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.step-no {
  font-size: var(--fs-caption);
  color: var(--amber);
  letter-spacing: 0.08em;
}

.step-txt {
  color: var(--ink-1);
  font-size: var(--fs-md);
  line-height: 1.9;
}

/* ---------- 校验清单 ---------- */

.checks {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.checks li {
  display: flex;
  align-items: baseline;
  gap: 12px;
  font-size: var(--fs-md);
  color: var(--ink-1);
  line-height: 1.85;
}

.ck {
  flex: none;
  font-size: var(--fs-nano);
  letter-spacing: 0.16em;
  color: var(--ink-0);
  border: 1px solid var(--line-1);
  border-radius: 2px;
  padding: 2px 7px;
}
</style>
