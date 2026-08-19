<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { iconSources } from '@/data/icons'
import { CATALOG } from '@/domain/catalog'
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
// 代理人类目图标：用户指定改用 nanoka 圆形头像（优先），其余沿用候选链兜底
const AGENT_CIRCLE_ICON = 'https://static.nanoka.cc/assets/zzz/IconRoleCircle01.webp'

const sections = CATALOG.map((c) => ({
  no: c.no,
  label: c.label,
  en: c.en,
  to: c.path,
  desc: c.desc,
  icon: c.icon,
  cat: c.iconCategory,
  iconSrcs:
    c.no === '01'
      ? [AGENT_CIRCLE_ICON, ...iconSources(c.icon, 'list', c.iconCategory)]
      : iconSources(c.icon, 'list', c.iconCategory),
}))
</script>

<template>
  <div class="wrap home">
    <section class="hero">
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
                :srcs="s.iconSrcs"
                :alt="s.label"
                :fallback="s.en"
              />
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
</template>

<style scoped>
.home {
  padding-top: calc(var(--pad-section) * 1.1);
}

/* ---------- hero ---------- */

.hero {
  padding-bottom: var(--pad-section);
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
  gap: 14px;
  font-size: 12px;
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
  background: var(--bg-1);
}

.specimen {
  width: 40px;
  height: 40px;
  display: block;
}

.specimen :deep(.frame) {
  border-radius: 2px;
}

.idx {
  font-size: 15px;
  color: var(--ink-3);
}

.name {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.name .zh {
  font-family: var(--serif);
  font-size: 24px;
  line-height: 1.1;
}

.name .en {
  font-size: 10px;
  letter-spacing: 0.24em;
  color: var(--ink-2);
}

.desc {
  color: var(--ink-1);
  font-size: 14px;
  max-width: 52ch;
}

.go {
  color: var(--ink-3);
  font-size: 18px;
  transition: color var(--t-fast) var(--ease),
    transform var(--t-fast) var(--ease);
}

.index-row:hover .go {
  color: var(--amber);
  transform: translateX(4px);
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