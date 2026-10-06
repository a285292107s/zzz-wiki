<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { iconSources } from '@/data/icons'
import { CATALOG, GUIDE_ENTRIES } from '@/domain/catalog'
import { usePageMeta } from '@/composables/usePageMeta'
import { dataVersions } from '@/data/api'
import { useFeaturedAgents } from '@/composables/useFeaturedAgents'
import { prefetchDetail, prefetchList, armPrefetchDetail } from '@/composables/useDetailPrefetch'
import { catalogByPath } from '@/domain/catalog'
import HollowImage from '@/components/HollowImage.vue'

usePageMeta()

// 数据版本元信息（正式服版本号，来自根 manifest.json；站点只展示正式服数据）
const versions = ref<{ live: string } | null>(null)
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

// 目录由 catalog.ts 派生（DESIGN.md §5.3 单一事实源）
// 代理人类目图标：圆形头像已本地化（public/data/img/character/），其余沿用候选链兜底
const AGENT_CIRCLE_ICON = `${import.meta.env.BASE_URL ?? '/'}data/img/character/IconRoleCircle01.webp`

// 今日角色：精选池 + 每次挂载随机取 4 张（取数与解析收敛在 useFeaturedAgents composable，
// 构图参数 pos/zoom/originY 含义见 IMG_GUIDE.md）。picks 同步可得，供骨架卡占位（防 CLS）：
// 卡片区不再等清单 JSON 返回才插入，首帧即以等高骨架占位。
const { featured, picks } = useFeaturedAgents()

/** 预热详情回路：标本卡悬停预热对应详情；目录行悬停预热名录视图 chunk + 名录 JSON */
function warmDetailDwell(to: string): void {
  const seg = to.split('/')
  const entry = catalogByPath(`/${seg[1]}`)
  if (entry && seg[2]) armPrefetchDetail(entry, seg[2])
}
function warmDetailNow(to: string): void {
  const seg = to.split('/')
  const entry = catalogByPath(`/${seg[1]}`)
  if (entry && seg[2]) prefetchDetail(entry, seg[2])
}
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
      <div class="wrap">
        <p v-reveal="0" class="eyebrow mono">NEW Eridu · Data Terminal</p>
        <h1 v-reveal="60" class="page-title">
          绳网档案
          <span class="title-en">Ropeweb Archive</span>
        </h1>
        <p v-reveal="120" class="page-sub">
          基于开放数据源整理的绝区零资料库。以档案编号为纲，收录代理人、音擎、邦布与驱动盘的结构化数据——不含任何主观评述，只做客观陈列。
        </p>

        <div v-reveal="220" class="hero-meta mono">
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
    </section>

    <div class="wrap">
      <!-- 今日角色：精选角色 9:16 标本卡（Mindscape 全景局部遮罩），4 张并列；池为空不渲染。
           挂载即渲染（图 src 只依赖 id，与清单请求并行）；名字/元素未就绪时盘内条形占位，到达后填充。 -->
      <section v-if="picks.length" class="banners">
        <div v-reveal class="section-head">
          <h2>今日角色</h2>
          <span class="rule" />
        </div>
        <div class="specimen-row">
          <RouterLink
            v-for="(card, i) in featured"
            :key="card.id"
            v-reveal="i * 70"
            :to="card.to"
            class="specimen-card"
            @pointerenter="warmDetailDwell(card.to)"
            @pointerdown="warmDetailNow(card.to)"
            @focus="warmDetailNow(card.to)"
          >
            <span class="specimen-figure">
              <!-- 首屏重点头图，勿 lazy：懒加载会把它降为低优先级，且带 transform:scale 的
                   img 会升级为独立合成层，合成器按 DOM 顺序逐个绘制，最右一格最后上屏
                   （网络其实并行，见 DevTools）。故用 eager 并行、常规优先级加载。 -->
              <!-- 卡片里已有名称文本，图片再报同一名字会让读屏念两遍（AX 树审计发现 7 处
                   同类冗余）→ 头图按装饰处理，语义交给文本 -->
              <!-- 试过并**回退**：首卡 high / 其余 low 的优先级分化。冷缓存实测 LCP
                   2360ms vs 全部同优先级 2400ms——噪声内无收益。根因是 4 张图都在
                   JS 引导后才被发现（~1.36s 同批出发），瓶颈是**发现时刻**不是带宽竞争。 -->
              <HollowImage
                unframed
                loading="eager"
                :srcs="card.srcs"
                alt=""
                :fallback="card.zh || card.en"
                :img-style="{
                  objectPosition: card.pos,
                  transformOrigin: `50% ${card.originY}%`,
                  transform: `scale(${card.zoom})`,
                }"
              />
            </span>
            <span class="specimen-plate">
              <span class="plate-top">
                <span class="no mono" aria-hidden="true">{{ card.no }}</span>
                <span
                  v-if="card.elementZh"
                  class="el mono"
                  :style="card.elementColor ? { color: card.elementColor } : undefined"
                >{{ card.elementZh }}</span>
              </span>
              <template v-if="card.zh">
                <span class="zh">{{ card.zh }}</span>
                <span class="en mono">{{ card.en }}</span>
              </template>
              <!-- 名单未就绪：条形占位（与骨架同构），名字到达后填充，盘高不变 -->
              <template v-else aria-hidden="true">
                <span class="bar zh-bar" />
                <span class="bar en-bar" />
              </template>
            </span>
          </RouterLink>
        </div>
      </section>

      <section class="index">
      <div v-reveal class="section-head">
        <span class="no mono" aria-hidden="true">00</span>
        <h2>目录</h2>
        <span class="rule" />
      </div>

      <ol class="index-list">
        <li v-for="(s, i) in sections" :key="s.to" v-reveal="i * 55">
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

/* ---------- 今日角色标本卡 ---------- */

.banners {
  /* 底部节奏复用 --space-section 标尺 */
  padding-bottom: var(--space-section);
}

/* 4 张并列：flex 均分宽度、hairline 间隙；整卡一框，细线框标本陈列 */
.specimen-row {
  display: flex;
  align-items: stretch;
  gap: 1px;
}

.specimen-card {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--line-1);
  border-radius: 2px;
  overflow: hidden;
  background: var(--bg-1);
  transition: background var(--t-fast) var(--ease),
    border-color var(--t-fast) var(--ease);
}

@media (hover: hover) {
  .specimen-card:hover {
    background: var(--bg-2);
    border-color: var(--line-2);
  }
}

/* 9:16 竖视口：遮罩住超宽全景图只露局部（object-fit:cover + object-position）。
   底图透明区透出页面深底色，形成浮空立绘；不加遮罩色阶，避免发糊 */

/* ---------- 名字占位条（名单未就绪时盘内条形，与文字行盒同高，交换不跳变） ---------- */

.specimen-plate .bar {
  display: block;
  height: 12px;
  background: linear-gradient(
    90deg,
    var(--bg-2) 0%,
    var(--bg-3) 50%,
    var(--bg-2) 100%
  );
  background-size: 200% 100%;
  animation: skel-pulse var(--t-skel) ease-in-out infinite;
}

.specimen-plate .zh-bar {
  height: 21px;
  width: 64px;
}

.specimen-plate .en-bar {
  height: 17px;
  width: 90px;
}

@media (prefers-reduced-motion: reduce) {
  .specimen-plate .bar {
    animation: none;
    background: var(--bg-2);
  }
}
.specimen-figure {
  position: relative;
  width: 100%;
  aspect-ratio: 9 / 16;
  overflow: hidden;
  background: var(--bg-0);
}

.specimen-figure img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  /* 逐图放大（FEATURED_POOL.zoom）配合逐图变换原点（FEATURED_POOL.originY，内容纵向中心，内联设置）
     把角色放大到填满，让上下透明边滚出视口（overflow:hidden 裁掉）；水平焦点由 object-position 控制 */
  transform-origin: 50% 50%;
  /* hover 微推近：独立 scale 属性与内联 transform（构图 zoom）相乘，互不覆盖 */
  transition: scale var(--t-zoom) var(--ease);
}

@media (hover: hover) {
  .specimen-card:hover .specimen-figure img {
    scale: 1.04;
  }
}

/* 标本标签牌：编号 + 中英名 + 元素 */
.specimen-plate {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 12px 14px;
  border-top: 1px solid var(--line-0);
}

.plate-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.plate-top .no {
  font-size: var(--fs-caption);
  letter-spacing: 0.12em;
  color: var(--ink-2);
  transition: color var(--t-fast) var(--ease);
}

@media (hover: hover) {
  .specimen-card:hover .plate-top .no {
    color: var(--amber);
  }
}

.plate-top .el {
  font-size: var(--fs-caption);
  letter-spacing: 0.08em;
  color: var(--ink-2);
}

.specimen-plate .zh {
  font-family: var(--serif);
  font-size: var(--fs-subhead);
  line-height: 1.15;
  color: var(--ink-0);
}

.specimen-plate .en {
  font-size: var(--fs-nano);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--ink-2);
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

@media (max-width: 860px) {
  /* 今日角色：手机转横向胶片条（保留 9:16 比例、不拖高页面） */
  .specimen-row {
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    gap: 10px;
    padding-bottom: 8px;
    scrollbar-width: none;
  }
  .specimen-row::-webkit-scrollbar {
    display: none;
  }
  .specimen-card {
    flex: 0 0 62vw;
    scroll-snap-align: start;
  }

  .index-row {
    grid-template-columns: 40px 40px 1fr auto;
  }
  .desc {
    grid-column: 3 / -1;
    grid-row: 2;
  }
}
</style>