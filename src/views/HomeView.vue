<script setup lang="ts">
import { iconSources } from '@/data/icons'
import HollowImage from '@/components/HollowImage.vue'

const sections = [
  {
    no: '01',
    label: '代理人',
    en: 'AGENTS',
    to: '/agents',
    desc: '新艾利都的代理人档案：属性、职业、阵营与战斗数据。',
    count: '全部角色',
    icon: { Id: 1011, icon: 'IconRole01' },
    cat: 'character' as const,
  },
  {
    no: '02',
    label: '音擎',
    en: 'W-ENGINES',
    to: '/w-engines',
    desc: '驱动代理人的武装终端，按职业与稀有度编目。',
    count: '全部武器',
    icon: { Id: 12001, icon: 'Weapon_B_Common_01' },
    cat: 'weapon' as const,
  },
  {
    no: '03',
    label: '邦布',
    en: 'BANGBOO',
    to: '/bangboos',
    desc: '空洞探索的忠实伙伴，收录全部型号与数据。',
    count: '全部邦布',
    icon: { Id: 53001, icon: 'IconBangbooPiece12' },
    cat: 'bangboo' as const,
  },
  {
    no: '04',
    label: '驱动盘',
    en: 'DISK DRIVES',
    to: '/disks',
    desc: '驱动盘的套装效果与词条一览。',
    count: '全部套装',
    icon: { Id: 31000, icon: 'SuitWoodpeckerElectro' },
    cat: 'disc' as const,
  },
]
</script>

<template>
  <div class="wrap home">
    <section class="hero">
      <p class="eyebrow mono">NEW Eridu · Data Terminal</p>
      <h1 class="page-title">
        空洞档案
        <span class="title-en">Hollow Archive</span>
      </h1>
      <p class="page-sub">
        基于开放数据源整理的绝区零资料库。以档案编号为纲，收录代理人、音擎、邦布与驱动盘的结构化数据——不含任何主观评述，只做客观陈列。
      </p>

      <div class="hero-meta mono">
        <span>数据源 · Dimbreath ZenlessData</span>
        <span class="dot">·</span>
        <span>持续更新</span>
        <span class="dot">·</span>
        <span>非官方项目</span>
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
                :srcs="iconSources(s.icon, 'list', s.cat)"
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