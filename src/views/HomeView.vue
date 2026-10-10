<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { iconSources } from '@/data/icons'
import { CATALOG, GUIDE_ENTRIES } from '@/domain/catalog'
import { usePageMeta } from '@/composables/usePageMeta'
import { dataVersions } from '@/data/api'
import { useFeaturedAgents } from '@/composables/useFeaturedAgents'
import { prefetchList } from '@/composables/useDetailPrefetch'
import { catalogByPath } from '@/domain/catalog'
import HollowImage from '@/components/HollowImage.vue'
import FeaturedDeck from '@/components/home/FeaturedDeck.vue'

usePageMeta()

// 数据版本元信息（正式服版本号，来自根 manifest.json；站点只展示正式服数据）
const versions = ref<{ live: string; generated?: string } | null>(null)
onMounted(() => {
  dataVersions()
    .then((v) => {
      versions.value = v
    })
    .catch(() => {
      // manifest 缺失时版本信息静默隐藏，不阻断页面
    })
})

const currentVersionLabel = computed(() => {
  if (!versions.value) return ''
  return `VER ${versions.value.live}`
})

/** 快照日期（hero 规格板用）：与数据说明页同一格式化口径 */
const currentUpdatedLabel = computed(() => {
  const g = versions.value?.generated
  const t = g ? new Date(g) : null
  if (!t || Number.isNaN(t.getTime())) return ''
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
})

// 目录由 catalog.ts 派生（DESIGN.md §5.3 单一事实源）
// 代理人类目图标：圆形头像已本地化（public/data/img/character/），其余沿用候选链兜底
const AGENT_CIRCLE_ICON = `${import.meta.env.BASE_URL ?? '/'}data/img/character/IconRoleCircle01.webp`

// 今日角色：精选池 + 按当天日期确定性取 4 张（取数与解析收敛在 useFeaturedAgents composable，
// 构图参数 pos/zoom/originY 含义见 IMG_GUIDE.md）。picks 同步可得（池为空即不渲染该区块），
// 牌堆不等名录 JSON 返回才插入：卡图 src 只依赖 id，缺失的名字/元素由规格条占位。
const { featured, picks } = useFeaturedAgents()

/** 预热名录视图 chunk + 名录 JSON（目录行悬停；详情预热在 FeaturedDeck 内） */
function warmList(path: string): void {
  const entry = catalogByPath(path)
  if (entry) prefetchList(entry)
}

const sections = [
  ...CATALOG.map((c) => ({
    no: c.no,
    label: c.label,
    en: c.en,
    to: c.path,
    desc: c.desc,
    iconSrcs:
      c.no === '01'
        ? [AGENT_CIRCLE_ICON, ...iconSources(c.icon, c.iconCategory)]
        : iconSources(c.icon, c.iconCategory),
    guide: false as boolean,
    glyph: '' as string,
  })),
  // 图文板块（战斗公式 / 数据说明）：无游戏图标，用各自的标本符号作占位。
  // 首页目录是站点索引，常设页面全部列入（站头导航只用 nav:true 的子集）。
  ...GUIDE_ENTRIES.map((g) => ({
    no: g.no,
    label: g.label,
    en: g.en,
    to: g.path,
    desc: g.desc,
    iconSrcs: [] as string[],
    guide: true as boolean,
    glyph: g.glyph,
  })),
]
</script>

<template>
  <div class="home">
    <!-- 首页 hero 壁纸：绳网情报站 wiki 首页 banner 同款全幅拼贴（tokens.css --home-bg-image）。
         仅首页铺装，固定视口层不随页滚动（手法同 body::before）；内页仍为 --page-bg-image。 -->
    <div class="home-backdrop" aria-hidden="true" />

    <!-- hero：文字陈列浮于壁纸之上；旧 Mindscape 头图已移除，双形态切换钮移至 1551 佩洛伊斯详情页 AgentHead -->
    <section class="hero">
      <div class="wrap hero-inner">
        <div class="hero-text">
          <p v-reveal="0" class="eyebrow mono" data-vt-block>NEW Eridu · Data Terminal</p>
          <h1 v-reveal="60" class="page-title" data-vt-block>
            绳网档案
            <span class="title-en">Ropeweb Archive</span>
          </h1>
          <p v-reveal="120" class="page-sub" data-vt-block>
            基于开放数据源整理的绝区零资料库。以档案编号为纲，收录代理人、音擎、邦布与驱动盘的结构化数据——不含任何主观评述，只做客观陈列。
          </p>

          <div v-reveal="220" class="hero-meta mono" data-vt-block>
            <span>游戏客户端数据</span>
            <span class="dot">·</span>
            <span>持续更新</span>
            <span class="dot">·</span>
            <span>非官方项目</span>
            <!-- 版本位常驻（清单到达前占位「VER ···」）：若改用 v-if 等清单到达再插入，
                 窄屏这一行会从 1 行折成 2 行（+34px）并把下方整块推下去——实测即首页
                 CLS 0.023 的全部来源。占位与真值同为「VER + 版本号」量级宽度，折行数不变。 -->
            <span class="dot">·</span>
            <span class="hero-ver">{{ currentVersionLabel || 'VER ···' }}</span>
          </div>
        </div>

        <!-- 档案规格板：宽屏时补上 hero 右侧的大片空白（实测 1920 下内容栏 1280、
             hero 文字仅占左侧 ~450px，右侧 ~800px 是空的）。
             内容是「档案该有的规格信息」而不是装饰——与数据说明页的「档案规格」同一语言，
             角标沿用详情页 hero 的 ⌐ 框，形成跨页面的家族感。
             **窄屏隐藏**：移动端首屏本就紧凑干净，不需要它，也避免拉长首屏。 -->
        <aside v-reveal="280" class="hero-spec" aria-label="档案规格" data-vt-block>
          <p class="hs-title mono">档案规格</p>
          <dl class="hs-list">
            <div class="hs-row">
              <dt>类目</dt>
              <dd class="mono">{{ String(CATALOG.length).padStart(2, '0') }}</dd>
            </div>
            <div class="hs-row">
              <dt>数据版本</dt>
              <dd class="mono">{{ currentVersionLabel || '···' }}</dd>
            </div>
            <div class="hs-row">
              <dt>最近更新</dt>
              <dd class="mono">{{ currentUpdatedLabel || '···' }}</dd>
            </div>
            <div class="hs-row">
              <dt>数据源</dt>
              <dd class="mono">hakushin raw</dd>
            </div>
          </dl>
        </aside>
      </div>
    </section>

    <div class="wrap">
      <!-- 今日角色：标本陈列（桌面 2.36:1 横幅 / 手机 4:5 竖幅，一次一张、不露邻卡）。
           信息在**图下的标本签**里、不压画面；横向拖拽 1:1 跟手、松手吸附，另有
           ←/→/Home/End 与刻度切换；整卡点击跳 /agents/{id}。
           区块挂载即渲染（图 src 只依赖 id，与清单请求并行）；名字/元素未就绪时标本签留条形占位。
           逐图构图参数 pos/zoom/originY 与详情页 AgentHead 同一套校准（IMG_GUIDE.md）。池为空不渲染。 -->
      <section v-if="picks.length" class="banners">
        <div v-reveal class="section-head" data-vt-block>
          <h2>今日角色</h2>
          <span class="rule" />
          <!-- 右端英文标签是延伸线的收尾锚点（缺了它，延伸线就与上方基线成为两条平行线，
               见 base.css 的 .section-head .en）。词取 Featured：与 FeaturedDeck /
               useFeaturedAgents / featured-pool.json 同名，不另造叫法。 -->
          <span class="en mono">Featured</span>
        </div>
        <!-- 入场不动用 v-reveal：牌堆自带「标本装匣」编排（首次入画时演一次，见 FeaturedDeck），
             整块上浮会与那三拍抢同一段时间。区块标题仍走 v-reveal。 -->
        <FeaturedDeck :cards="featured" />
      </section>

      <section class="index">
      <div v-reveal class="section-head" data-vt-block>
        <span class="no mono" aria-hidden="true">00</span>
        <h2>目录</h2>
        <span class="rule" />
        <!-- 右端英文标签（同「今日角色」）。词取 Contents：这一栏就是站点的目录，
             与页脚「数据说明」的 Colophon 同一层语义，不复用类目页的 AGENTS 等「内容类目名」。 -->
        <span class="en mono">Contents</span>
      </div>

      <ol class="index-list">
        <li v-for="(s, i) in sections" :key="s.to" v-reveal="i * 55" data-vt-block>
          <RouterLink :to="s.to" class="index-row" @pointerenter="warmList(s.to)" @focus="warmList(s.to)">
            <span class="specimen">
              <HollowImage
                v-if="!s.guide"
                :srcs="s.iconSrcs"
                alt=""
                :fallback="s.en"
              />
              <!-- 图文板块：无游戏图标，用该板块的标本符号（战斗公式 × / 数据说明 §） -->
              <span v-else class="specimen-guide" aria-hidden="true">{{ s.glyph }}</span>
            </span>
            <span class="idx mono" aria-hidden="true">{{ String(i + 1).padStart(2, '0') }}</span>
            <span class="name">
              <span class="zh">{{ s.label }}</span>
              <span class="en mono">{{ s.en }}</span>
            </span>
            <span class="desc">{{ s.desc }}</span>
            <span class="go mono" aria-hidden="true">→</span>
          </RouterLink>
        </li>
      </ol>
      </section>
    </div>
  </div>
</template>

<style scoped>
/* ---------- 首页 hero 壁纸 ---------- */

.home {
  position: relative;
}

/* 固定视口层（不随页滚动，手法同 base.css 的 body::before）。铺装规则沿用原站量得的
   放大规则：图恒以 2400:1080 比例、高度撑满视口（auto 100%）水平居中 —— common 桌面
   两侧出血 ≈1.25×，宽屏更宽；视口顶被实底页头遮住 62px（SiteHeader 内写死，无 token），
   故直接 inset:0 不再让位。压暗：叠一层 --scrim-3（页面底色染墨，遮罩色阶见 tokens.css，
   禁止手写 rgba）。图自带向下渐隐近黑，fixed 层永不露边，无需再接 mask 渐隐。
   z-index:-1 收在本组件内：#app(z-index:1) 已建立堆叠上下文，故只压在首页内容之下、
   不会掉到 body::before 之下去；内容各 section 为普通流，天然浮于其上。 */
.home-backdrop {
  position: fixed;
  inset: 0;
  z-index: -1;
  background-image: linear-gradient(var(--scrim-3), var(--scrim-3)),
    var(--home-bg-image);
  background-size: auto, auto 100%;
  background-position: center top;
  background-repeat: no-repeat;
  pointer-events: none;
}

/* ---------- hero ---------- */

.hero {
  position: relative;
  /* 头图已移除：hero 只作文字陈列，浮于 .home-backdrop 壁纸之上（无遮罩/scrim，与内页一致） */
  padding-top: calc(var(--pad-section) * 0.9);
  padding-bottom: var(--pad-section);
}

/* 宽屏两栏：文字陈列 + 档案规格板。
   实测 1920 下内容栏 1280、hero 文字仅占左侧 ~450px，右侧 ~800px 是空白——
   规格板把这块空白换成「档案该有的规格信息」。窄屏（<1080）保持单栏、规格板隐藏，
   移动端首屏维持原样（紧凑、干净）。 */
.hero-inner {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: end;
  gap: clamp(24px, 3vw, 48px);
}

@media (min-width: 1080px) {
  .hero-inner {
    grid-template-columns: minmax(0, 1fr) minmax(300px, 380px);
    gap: clamp(48px, 6vw, 112px);
  }
}

/* 规格板：与数据说明页「档案规格」同一语言（细线行 + 等宽数字），
   四角用详情页 hero 的 ⌐ 框，形成跨页面的家族感 */
.hero-spec {
  display: none;
  position: relative;
  padding: 20px 22px 18px;
  border: 1px solid var(--line-1);
  border-radius: 2px;
  /* 底色与数据说明页的「档案规格」盒同值（--bg-1）：hero 背后是全幅水印壁纸，
     不填底色会让水印透进板面、行文读起来发噪 */
  background: var(--bg-1);
}

@media (min-width: 1080px) {
  .hero-spec {
    display: block;
  }
}

/* 角标：1px 短线，不抢内容（与 DetailHead 的 .plate 同语言） */
.hero-spec::before,
.hero-spec::after {
  content: '';
  position: absolute;
  width: 10px;
  height: 10px;
  border-color: var(--line-2);
  border-style: solid;
}

.hero-spec::before {
  top: -1px;
  left: -1px;
  border-width: 1px 0 0 1px;
}

.hero-spec::after {
  right: -1px;
  bottom: -1px;
  border-width: 0 1px 1px 0;
}

.hs-title {
  font-size: var(--fs-nano);
  letter-spacing: 0.22em;
  color: var(--ink-2);
  text-transform: uppercase;
}

.hs-list {
  margin: 12px 0 0;
}

.hs-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-inline);
  padding: 8px 0;
  border-bottom: 1px solid var(--line-0);
}

.hs-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.hs-row dt {
  font-size: var(--fs-small);
  color: var(--ink-1);
}

.hs-row dd {
  margin: 0;
  font-size: var(--fs-small);
  color: var(--ink-0);
  letter-spacing: 0.06em;
}

/* ---------- 今日角色（横向牌堆，见 components/home/FeaturedDeck.vue） ---------- */

.banners {
  /* 底部节奏复用 --space-section 标尺 */
  padding-bottom: var(--space-section);
}

.title-en {
  display: block;
  font-family: var(--mono);
  font-size: clamp(13px, 2vw, 18px);
  font-weight: 400;
  letter-spacing: 0.34em;
  text-transform: uppercase;
  color: var(--ink-2);
  margin-top: 18px;
}

.hero-meta {
  margin-top: 32px;
  display: flex;
  align-items: center;
  flex-wrap: wrap; /* 手机宽度不足时换行，避免挤出视口 */
  row-gap: 10px;
  gap: 14px;
  font-size: var(--fs-caption);
  letter-spacing: 0.1em;
  color: var(--ink-2);
}

.hero-meta .dot {
  color: var(--amber);
}

.hero-meta .hero-ver {
  color: var(--amber);
}

/* ---------- index list ---------- */

.index-list {
  list-style: none;
}

.index-row {
  display: grid;
  grid-template-columns: 44px 56px 220px 1fr auto;
  align-items: center;
  gap: 20px;
  padding: 22px 8px;
  border-bottom: var(--rule);
  transition: background var(--t-fast) var(--ease);
}

@media (hover: hover) {
  .index-row:hover {
    background: var(--bg-3);
  }

  .index-row:hover .idx {
    color: var(--amber);
  }
}

.specimen {
  width: 40px;
  height: 40px;
  display: block;
}

.specimen :deep(.frame) {
  border-radius: 2px;
}

/* 图文板块标本：主题符号「×」，与 HollowImage 框体同尺寸边框保持对齐 */
.specimen-guide {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--bg-1);
  border: 1px solid var(--line-0);
  border-radius: 2px;
  color: var(--amber);
  font-size: var(--fs-subhead);
  line-height: 1;
}

.idx {
  font-size: var(--fs-body);
  color: var(--ink-3);
  transition: color var(--t-fast) var(--ease);
}

/* hover 时编号点亮：档案检索的「抽中一档」暗号，与箭头位移同层回应 */
.index-row:hover .idx {
  color: var(--amber);
}

.name {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.name .zh {
  font-family: var(--serif);
  font-size: var(--fs-hero);
  line-height: 1.1;
}

.name .en {
  font-size: var(--fs-nano);
  letter-spacing: 0.24em;
  color: var(--ink-2);
}

.desc {
  color: var(--ink-1);
  font-size: var(--fs-md);
  max-width: 52ch;
  /* 断行均衡：两栏账册里最长的一条描述（28 字）会在 584px 格内折成两行，
     不均衡时末行只剩「成。」三个字。balance 把两行拉平，末行不再孤字。 */
  text-wrap: balance;
}

.go {
  color: var(--ink-3);
  font-size: var(--fs-subhead);
  transition: color var(--t-fast) var(--ease),
    transform var(--t-fast) var(--ease);
}

@media (hover: hover) {
  .index-row:hover .go {
    color: var(--amber);
    transform: translateX(4px);
  }
}

/* ---------- 宽屏（≥1180）：目录改两栏账册 ----------
   单栏时一行要摊满整个版心，而描述列是 1fr、文本上限 52ch：1440 下这一列实占 741px、
   文字只用到 446px，箭头被孤悬在 315px 之外（7 行皆然，且版心越宽空档越大：
   2560 下 776px）。两栏后每格 584px，图标 · 编号 · 名称/描述上下排，宽度真正用上。
   1180 是「格宽仍够放最长描述」的下限：更窄时单栏的 1fr 本来就只有 500px 上下，
   空档并不成立（1440 以上才开始明显），故不做更早切换。

   三处关键取舍（都是实测出来的）：
   ⓐ **列宽按内容定、箭头紧随描述**：`minmax(0, max-content)` + `auto`。
      若把描述列写成 1fr、箭头右对齐（＝单栏那套），格内会重演同一处空洞 ——
      1440 下 87px、2560 下 **293px**（按比例并不比单栏好）。内容定宽后箭头紧跟描述，
      空档只剩格尾的普通留白。代价是箭头不再是整齐的一列 —— 换来的是任何宽度下都无空洞。
   ⓑ `column-gap: 0`：发丝线画在每格 `.index-row` 的下边框上，栏间距为 0 时两格的线
      在栏间接成一条；留出 gap 会把每行的线断成两截，读起来像画坏了。
   ⓒ 栏间留白由**奇格右内边距 + 偶格左内边距各出一半**给出（合计 ~84px），左右两端仍与
      区块头同为 8px —— 若改成整列 `padding-inline`，首格图标会相对「00 目录」右移一档。
      留白必须够宽：只有 ~50px 时，左格箭头离自己的描述 87px、离右栏图标 50px，
      看起来像右栏的箭头（Gestalt 归属错乱）；各出一半后变成 45px / 103px。 */
@media (min-width: 1180px) {
  .index-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 0;
    /* 收口线画在容器上：7 条排两栏后末行只剩左格，若沿用每格下边框，
       收口线就只有半条；容器自己的下边框横贯整个版心，账册收得干净。 */
    border-bottom: var(--rule);
  }

  .index-list > li:last-child .index-row {
    border-bottom: none;
  }

  .index-list > li:nth-child(odd) .index-row {
    padding-right: var(--space-group);
  }

  .index-list > li:nth-child(even) .index-row {
    padding-left: var(--space-group);
  }

  /* 名称与描述在格内上下排（584px 放不下「名称 | 描述」并列）；
     名称列的宽度由内容定（=该行更宽的一方），箭头列吃掉余量、箭头左对齐 → 紧贴描述。
     row-gap 必须收窄：`gap: 20px` 的行间距会让名称与它自己的描述隔开 20px，
     一条目录被读成两件事（实测行高 133 → 收紧后 121）。 */
  .index-row {
    grid-template-columns: 40px 40px minmax(0, max-content) auto;
    align-items: center;
    row-gap: var(--space-1);
  }

  /* 只占名称列：`3 / -1` 会让描述盒盖到箭头列上，长描述会顶到箭头 */
  .desc {
    grid-column: 3 / 4;
    grid-row: 2;
  }
}

@media (max-width: 860px) {
  .index-row {
    grid-template-columns: 40px 40px 1fr auto;
  }
  .desc {
    grid-column: 3 / -1;
    grid-row: 2;
  }
}
</style>
