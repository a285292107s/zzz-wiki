<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { iconSources } from '@/data/icons'
import { CATALOG, GUIDE_ENTRY } from '@/domain/catalog'
import { usePageMeta } from '@/composables/usePageMeta'
import { dataVersion, dataVersions } from '@/data/api'
import { useFeaturedAgents, type FeaturedCard } from '@/composables/useFeaturedAgents'
import HollowImage from '@/components/HollowImage.vue'

usePageMeta()

// 数据版本元信息（live/latest 版本号，来自根 manifest.json；切换入口在全站站头）
const versions = ref<{ live: string; latest: string; liveAvailable: boolean } | null>(null)
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
  return dataVersion.value === 'live'
    ? `LIVE ${versions.value.live}`
    : `LATEST ${versions.value.latest}`
})

// 目录由 catalog.ts 派生（DESIGN.md §5.3 单一事实源）
// 代理人类目图标：圆形头像已本地化（public/data/img/character/），其余沿用候选链兜底
const AGENT_CIRCLE_ICON = `${import.meta.env.BASE_URL ?? '/'}data/img/character/IconRoleCircle01.webp`

// 今日角色：精选池 + 每次挂载随机取 4 张（取数与解析收敛在 useFeaturedAgents composable，
// 构图参数 pos/zoom/originY 含义见 IMG_GUIDE.md）
const { featured } = useFeaturedAgents()

/** 图源候选链：本地 404 切 CDN；耗竭后隐藏底图（与 AgentHead 同源兜底，落回 --bg-0） */
function onImgError(card: FeaturedCard): void {
  if (card.idx < card.srcs.length - 1) card.idx += 1
  else card.idx = card.srcs.length
}

const sections = [
  ...CATALOG.map((c) => ({
    no: c.no,
    label: c.label,
    en: c.en,
    to: c.path,
    desc: c.desc,
    icon: c.icon,
    cat: c.iconCategory,
    iconSrcs:
      c.no === '01'
        ? [AGENT_CIRCLE_ICON, ...iconSources(c.icon, c.iconCategory)]
        : iconSources(c.icon, c.iconCategory),
    guide: false as boolean,
  })),
  {
    // 图文板块：无游戏图标，用主题符号「×」作标本占位
    no: GUIDE_ENTRY.no,
    label: GUIDE_ENTRY.label,
    en: GUIDE_ENTRY.en,
    to: GUIDE_ENTRY.path,
    desc: GUIDE_ENTRY.desc,
    iconSrcs: [] as string[],
    guide: true as boolean,
  },
]
</script>

<template>
  <div class="home">
    <!-- hero：文字陈列；头图已移除，双形态切换钮移至 1551 佩洛伊斯详情页 AgentHead -->
    <section class="hero">
      <div class="wrap">
        <p class="eyebrow mono">NEW Eridu · Data Terminal</p>
        <h1 class="page-title">
          绳网档案
          <span class="title-en">Ropeweb Archive</span>
        </h1>
        <p class="page-sub">
          基于开放数据源整理的绝区零资料库。以档案编号为纲，收录代理人、音擎、邦布与驱动盘的结构化数据——不含任何主观评述，只做客观陈列。
        </p>

        <div class="hero-meta mono">
          <span>游戏客户端数据</span>
          <span class="dot">·</span>
          <span>持续更新</span>
          <span class="dot">·</span>
          <span>非官方项目</span>
          <template v-if="currentVersionLabel">
            <span class="dot">·</span>
            <span class="hero-ver">{{ currentVersionLabel }}</span>
          </template>
        </div>
      </div>
    </section>

    <div class="wrap">
      <!-- 今日角色：精选角色 9:16 标本卡（Mindscape 全景局部遮罩），4 张并列；无损无卡时不渲染 -->
      <section v-if="featured.length" class="banners">
        <div class="section-head">
          <h2>今日角色</h2>
          <span class="rule" />
        </div>
        <div class="specimen-row">
          <RouterLink v-for="card in featured" :key="card.id" :to="card.to" class="specimen-card">
            <span class="specimen-figure">
              <!-- 首屏重点头图，勿 lazy：懒加载会把它降为低优先级，且带 transform:scale 的
                   img 会升级为独立合成层，合成器按 DOM 顺序逐个绘制，最右一格最后上屏
                   （网络其实并行，见 DevTools）。故用 eager 并行、常规优先级加载。 -->
              <img
                v-if="card.idx < card.srcs.length"
                :src="card.srcs[card.idx]"
                :alt="card.zh || card.en"
                :style="{
                  objectPosition: card.pos,
                  transformOrigin: `50% ${card.originY}%`,
                  transform: `scale(${card.zoom})`,
                }"
                decoding="async"
                @error="onImgError(card)"
              />
            </span>
            <span class="specimen-plate">
              <span class="plate-top">
                <span class="no mono">{{ card.no }}</span>
                <span
                  v-if="card.elementZh"
                  class="el mono"
                  :style="card.elementColor ? { color: card.elementColor } : undefined"
                >{{ card.elementZh }}</span>
              </span>
              <span class="zh">{{ card.zh }}</span>
              <span class="en mono">{{ card.en }}</span>
            </span>
          </RouterLink>
        </div>
      </section>

      <section class="index">
      <div class="section-head">
        <span class="no mono">00</span>
        <h2>目录</h2>
        <span class="rule" />
      </div>

      <ol class="index-list">
        <li v-for="(s, i) in sections" :key="s.to">
          <RouterLink :to="s.to" class="index-row">
            <span class="specimen">
              <HollowImage
                v-if="!s.guide"
                :srcs="s.iconSrcs"
                :alt="s.label"
                :fallback="s.en"
              />
              <span v-else class="specimen-guide" aria-hidden="true">×</span>
            </span>
            <span class="idx mono">{{ String(i + 1).padStart(2, '0') }}</span>
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
/* ---------- hero ---------- */

.hero {
  position: relative;
  /* 头图已移除：hero 只作文字陈列，落回页底 --bg-0（无遮罩/scrim，与内页一致） */
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

.specimen-card:hover {
  background: var(--bg-2);
  border-color: var(--line-2);
}

/* 9:16 竖视口：遮罩住超宽全景图只露局部（object-fit:cover + object-position）。
   底图透明区透出页面深底色，形成浮空立绘；不加遮罩色阶，避免发糊 */
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

.index-row:hover {
  background: var(--bg-3);
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

.index-row:hover .go {
  color: var(--amber);
  transform: translateX(4px);
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