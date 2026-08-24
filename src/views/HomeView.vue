<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { iconSources } from '@/data/icons'
import { CATALOG, GUIDE_ENTRY } from '@/domain/catalog'
import { usePageMeta } from '@/composables/usePageMeta'
import { dataVersion, dataVersions } from '@/data/api'
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

// 活动横幅区块：本地 banner 资源，5 张并列、独立成区（运行时零外部请求）
const BANNER_FILES = [
  'thumb.webp',
  'thumb-1.webp',
  'thumb-2.webp',
  'thumb-3.webp',
  'thumb-4.webp',
]
const banners = BANNER_FILES.map((f) => ({
  src: `${import.meta.env.BASE_URL ?? '/'}data/img/banner/${f}`,
  alt: '',
}))

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
    <!-- hero：文字陈列（横幅已移至下方独立区块） -->
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
      <!-- 活动横幅：独立区块，5 张并列、零间隙 -->
      <section class="banners">
        <div class="section-head">
          <h2>今日角色</h2>
          <span class="rule" />
        </div>
        <div class="banner-row">
          <span v-for="b in banners" :key="b.src" class="banner-cell">
            <img :src="b.src" :alt="b.alt" />
          </span>
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
  /* Mindscape 场景图作背景：顶部极透露出场景，底部深遮罩确保文字可读；
     色阶统一取 --scrim-*（以 bg-0 为基色，与详情页 AgentHead 同一份），禁止手写 rgba */
  background:
    linear-gradient(180deg,
      var(--scrim-1) 0%,
      var(--scrim-2) 30%,
      var(--scrim-3) 60%,
      var(--scrim-4) 100%),
    url('/data/img/hero/Mindscape_1311_2.webp') no-repeat center/cover;
  padding-top: calc(var(--pad-section) * 0.9);
  padding-bottom: var(--pad-section);
}

/* ---------- 活动横幅区块 ---------- */

.banners {
  /* 顶部直接承接 hero 底 padding；底部节奏复用 --space-section 标尺 */
  padding-bottom: var(--space-section);
}

/* 5 张并列：flex 均分宽度、零间隙，1px 细线框标本陈列；
   遮罩层统一压暗亮度（色阶取 --scrim-*，禁止手写 rgba） */
.banner-row {
  display: flex;
  align-items: stretch;
}

.banner-cell {
  position: relative;
  flex: 1;
  min-width: 0;
  height: clamp(180px, 26vw, 340px);
  border: 1px solid var(--line-1);
  border-radius: 2px;
  overflow: hidden;
}

.banner-cell img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 亮度蒙版：自上而下递暗的 scrim 色阶，顶部适度压暗、底部更深 */
.banner-cell::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg,
    var(--scrim-1) 0%,
    var(--scrim-2) 50%,
    var(--scrim-3) 100%);
  pointer-events: none;
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
  .banner-row {
    flex-wrap: wrap;
  }
  .banner-cell {
    flex: 1 1 calc(50% - 1px);
    height: clamp(120px, 30vw, 200px);
  }
  /* 末张独占一行：避免单图被 grow 拉满全宽放大失真 */
  .banner-cell:last-child {
    flex-basis: 100%;
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