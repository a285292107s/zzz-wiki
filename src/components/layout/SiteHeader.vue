<template>
  <!-- 全站站头：显式 banner landmark（Vue 根挂载于 #app，隐式 banner 不生效） -->
  <header class="masthead" role="banner">
    <div class="wrap masthead-inner">
      <RouterLink to="/" class="brand">
        <!-- 品牌符号：黑色线稿反色为纸白；文字已由 brand-mark 提供，纯装饰 -->
        <img class="brand-logo" src="/logo.png" alt="" width="24" height="26" aria-hidden="true" />
        <span class="brand-text">
          <span class="brand-mark mono">ROPEWEB://ARCHIVE</span>
          <span class="brand-sub">新艾利都数据终端</span>
        </span>
      </RouterLink>

      <nav class="nav" aria-label="主导航">
        <RouterLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          :class="{ active: isActive(item.to) }"
        >
          <span class="no mono">{{ item.no }}</span>
          <span class="label">{{ item.label }}</span>
        </RouterLink>
      </nav>

      <!-- 数据版本切换（全局，桌面）：紧凑下拉，弹层展示档位说明与完整版本号 -->
      <div ref="verWrap" class="ver-wrap">
        <button
          type="button"
          class="ver-trigger mono"
          :class="{ open: verOpen }"
          :aria-haspopup="'listbox'"
          :aria-expanded="verOpen"
          aria-label="切换数据版本"
          @click="verOpen = !verOpen"
        >
          <span class="ver-tag">VER</span>
          <span class="ver-cur">{{ dataVersion.toUpperCase() }}</span>
          <span class="ver-caret" aria-hidden="true">▾</span>
        </button>

        <div v-if="verOpen" class="ver-panel" role="listbox" aria-label="数据版本">
          <p class="ver-panel-title mono">DATA VERSION</p>
          <button
            v-if="versions?.liveAvailable ?? true"
            type="button"
            role="option"
            class="ver-opt"
            :class="{ selected: dataVersion === 'live' }"
            :aria-selected="dataVersion === 'live'"
            @click="pickVersion('live')"
          >
            <span class="ver-opt-name">
              LIVE <span class="ver-opt-num">{{ versions?.live ?? '···' }}</span>
            </span>
            <span class="ver-opt-desc">游戏在线版本 · 正式服内容</span>
          </button>
          <button
            type="button"
            role="option"
            class="ver-opt"
            :class="{ selected: dataVersion === 'latest' }"
            :aria-selected="dataVersion === 'latest'"
            @click="pickVersion('latest')"
          >
            <span class="ver-opt-name">
              LATEST <span class="ver-opt-num">{{ versions?.latest ?? '···' }}</span>
            </span>
            <span class="ver-opt-desc">数据源最新 · 含前瞻/测试服内容</span>
          </button>
        </div>
      </div>

      <button
        type="button"
        class="menu-toggle mono"
        :class="{ open: menuOpen }"
        :aria-expanded="menuOpen"
        aria-controls="mobile-nav"
        aria-label="切换导航菜单"
        @click="menuOpen = !menuOpen"
      >
        <span class="burger" aria-hidden="true">
          <i /><i /><i />
        </span>
        <span class="menu-word">{{ menuOpen ? 'CLOSE' : 'MENU' }}</span>
      </button>
    </div>

    <nav id="mobile-nav" v-show="menuOpen" class="mobile-nav" aria-label="移动端导航">
      <RouterLink
        v-for="item in nav"
        :key="item.to"
        :to="item.to"
        class="mobile-item"
        :class="{ active: isActive(item.to) }"
        @click="closeMenu"
      >
        <span class="no mono">{{ item.no }}</span>
        <span class="label">{{ item.label }}</span>
      </RouterLink>

      <!-- 数据版本切换（移动）：菜单底部两档，点击即切换并收起菜单 -->
      <div class="mobile-ver">
        <p class="mobile-ver-label mono">DATA VERSION</p>
        <div class="mobile-ver-grid">
          <button
            v-if="versions?.liveAvailable ?? true"
            type="button"
            class="mobile-ver-opt mono"
            :class="{ active: dataVersion === 'live' }"
            @click="pickVersion('live'); closeMenu()"
          >
            <span class="mv-name">LIVE</span>
            <span class="mv-num">{{ versions?.live ?? '···' }}</span>
          </button>
          <button
            type="button"
            class="mobile-ver-opt mono"
            :class="{ active: dataVersion === 'latest' }"
            @click="pickVersion('latest'); closeMenu()"
          >
            <span class="mv-name">LATEST</span>
            <span class="mv-num">{{ versions?.latest ?? '···' }}</span>
          </button>
        </div>
      </div>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { CATALOG } from '@/domain/catalog'
import { dataVersion, dataVersions, setDataVersion, type DataVersions } from '@/data/api'

// 导航由 catalog.ts 派生（DESIGN.md §5.3 单一事实源）
const route = useRoute()
const nav = CATALOG.map((c) => ({ no: c.no, label: c.label, to: c.path }))

const isActive = (to: string) =>
  route.path === to || (to !== '/' && route.path.startsWith(to))

// 移动端菜单
const menuOpen = ref(false)
function closeMenu() {
  menuOpen.value = false
}

// 数据版本切换（全站）：版本偏好影响所有页面数据，常驻站头供全局可见可切
const verOpen = ref(false)
const versions = ref<DataVersions | null>(null)
const verWrap = ref<HTMLElement | null>(null)

onMounted(() => {
  dataVersions()
    .then((v) => {
      versions.value = v
      // live 不可用（构建期降级沿用 latest）时纠正默认档位，避免选中无效选项
      if (!v.liveAvailable && dataVersion.value === 'live') setDataVersion('latest')
    })
    .catch(() => {
      // manifest 缺失时切换器只有档位名，不阻断站点
    })
})

function onDocMousedown(e: MouseEvent) {
  if (verOpen.value && !verWrap.value?.contains(e.target as Node)) verOpen.value = false
}
function onDocKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && verOpen.value) verOpen.value = false
}
onMounted(() => {
  document.addEventListener('mousedown', onDocMousedown)
  document.addEventListener('keydown', onDocKeydown)
})
onUnmounted(() => {
  document.removeEventListener('mousedown', onDocMousedown)
  document.removeEventListener('keydown', onDocKeydown)
})

function pickVersion(v: 'live' | 'latest') {
  setDataVersion(v)
  verOpen.value = false
}
</script>

<style scoped>
/* ---------- masthead ---------- */

.masthead {
  position: sticky;
  top: 0;
  z-index: var(--z-nav);
  background: color-mix(in srgb, var(--bg-0) 88%, transparent);
  backdrop-filter: blur(10px);
  border-bottom: var(--rule);
}

.masthead-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  height: 62px;
}

.brand {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  line-height: 1.15;
}

.brand-logo {
  flex: none;
  /* 黑色线稿反色为纸白，契合纸墨配色（同首页 hero 处理） */
  filter: invert(1) opacity(0.9);
}

.brand-text {
  display: flex;
  flex-direction: column;
}

.brand-mark {
  font-size: 14px;
  letter-spacing: 0.14em;
  color: var(--ink-0);
}

.brand-sub {
  font-size: 10px;
  letter-spacing: 0.32em;
  color: var(--ink-2);
  margin-top: 2px;
}

.nav {
  display: flex;
  align-items: center;
  gap: 4px;
}

.nav-item {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 2px;
  color: var(--ink-1);
  transition: color var(--t-fast) var(--ease),
    background var(--t-fast) var(--ease);
}

.nav-item .no {
  font-size: 10px;
  color: var(--ink-3);
  transition: color var(--t-fast) var(--ease);
}

.nav-item .label {
  font-size: 14px;
  letter-spacing: 0.06em;
}

.nav-item:hover {
  color: var(--ink-0);
  background: var(--bg-1);
}

.nav-item.active {
  color: var(--ink-0);
}

.nav-item.active .no {
  color: var(--amber);
}

.nav-item.active::after {
  content: '';
  align-self: flex-end;
  width: 100%;
  height: 1px;
  background: var(--amber);
  margin-left: -100%;
}

/* ---------- data version switch（全局） ---------- */

.ver-wrap {
  position: relative;
}

.ver-trigger {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 6px 10px;
  font-size: 11px;
  letter-spacing: 0.16em;
  color: var(--ink-2);
  border: 1px solid var(--line-1);
  border-radius: 2px;
  background: transparent;
  transition: color var(--t-fast) var(--ease),
    border-color var(--t-fast) var(--ease);
}

.ver-trigger:hover {
  color: var(--ink-0);
  border-color: var(--line-2);
}

.ver-trigger.open {
  color: var(--ink-0);
  border-color: var(--amber);
}

.ver-tag {
  font-size: 9px;
  letter-spacing: 0.22em;
  color: var(--ink-3);
}

.ver-cur {
  color: var(--ink-0);
}

.ver-caret {
  font-size: 9px;
  color: var(--amber);
  transition: transform var(--t-fast) var(--ease);
}

.ver-trigger.open .ver-caret {
  transform: rotate(180deg);
}

.ver-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 268px;
  padding: 4px;
  background: var(--bg-0);
  border: 1px solid var(--line-1);
  border-radius: 2px;
  z-index: var(--z-nav);
}

.ver-panel-title {
  padding: 8px 10px 6px;
  font-size: 9px;
  letter-spacing: 0.26em;
  color: var(--ink-3);
}

.ver-opt {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  padding: 9px 10px;
  text-align: left;
  border-radius: 2px;
  color: var(--ink-1);
  background: transparent;
  transition: background var(--t-fast) var(--ease),
    color var(--t-fast) var(--ease);
}

.ver-opt:hover {
  background: var(--bg-1);
  color: var(--ink-0);
}

.ver-opt.selected {
  background: var(--bg-1);
  color: var(--ink-0);
}

.ver-opt-name {
  font-size: 12px;
  letter-spacing: 0.14em;
}

.ver-opt-num {
  font-size: 11px;
  letter-spacing: 0.04em;
  color: var(--ink-3);
}

.ver-opt.selected .ver-opt-num {
  color: var(--amber);
}

.ver-opt-desc {
  font-size: 11px;
  color: var(--ink-2);
  letter-spacing: 0.04em;
}

.ver-opt.selected .ver-opt-desc {
  color: var(--ink-1);
}

/* ---------- mobile menu (Q3a) ---------- */

.menu-toggle {
  display: none;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  letter-spacing: 0.18em;
  color: var(--ink-2);
  padding: 6px 10px;
  border: 1px solid var(--line-1);
  border-radius: 2px;
  transition: color var(--t-fast) var(--ease),
    border-color var(--t-fast) var(--ease);
}

.menu-toggle:hover {
  color: var(--ink-0);
  border-color: var(--line-2);
}

.menu-toggle.open {
  color: var(--amber-hi);
  border-color: var(--amber);
}

.burger {
  display: inline-flex;
  flex-direction: column;
  gap: 3px;
}

.burger i {
  display: block;
  width: 14px;
  height: 1px;
  background: currentColor;
  transition: transform var(--t-fast) var(--ease), opacity var(--t-fast) var(--ease);
}

.menu-toggle.open .burger i:nth-child(1) {
  transform: translateY(4px) rotate(45deg);
}

.menu-toggle.open .burger i:nth-child(2) {
  opacity: 0;
}

.menu-toggle.open .burger i:nth-child(3) {
  transform: translateY(-4px) rotate(-45deg);
}

.mobile-nav {
  display: none;
  border-top: var(--rule);
  background: var(--bg-0);
  padding: 8px var(--pad-page) 14px;
  flex-direction: column;
}

.mobile-item {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 12px 2px;
  border-bottom: 1px solid var(--line-0);
  color: var(--ink-1);
  transition: color var(--t-fast) var(--ease);
}

.mobile-item .no {
  font-size: 11px;
  color: var(--ink-3);
}

.mobile-item .label {
  font-size: 15px;
  letter-spacing: 0.06em;
}

.mobile-item:hover,
.mobile-item.active {
  color: var(--ink-0);
}

.mobile-item.active .no {
  color: var(--amber);
}

/* ---------- mobile data version（MENU 底部） ---------- */

.mobile-ver {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--line-0);
}

.mobile-ver-label {
  font-size: 9px;
  letter-spacing: 0.26em;
  color: var(--ink-3);
  margin-bottom: 10px;
}

.mobile-ver-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.mobile-ver-opt {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  padding: 10px 12px;
  text-align: left;
  border: 1px solid var(--line-1);
  border-radius: 2px;
  color: var(--ink-2);
  background: transparent;
  transition: color var(--t-fast) var(--ease),
    border-color var(--t-fast) var(--ease),
    background var(--t-fast) var(--ease);
}

.mobile-ver-opt:hover {
  color: var(--ink-0);
}

.mobile-ver-opt.active {
  color: var(--ink-0);
  border-color: var(--amber);
  background: var(--bg-1);
}

.mv-name {
  font-size: 12px;
  letter-spacing: 0.16em;
}

.mv-num {
  font-size: 10px;
  letter-spacing: 0.04em;
  color: var(--ink-3);
}

.mobile-ver-opt.active .mv-num {
  color: var(--amber);
}

/* ---------- responsive ---------- */

@media (max-width: 720px) {
  .masthead-inner {
    height: 62px;
    flex-direction: row;
    gap: 12px;
    padding-block: 0;
  }

  .menu-toggle {
    display: inline-flex;
  }

  .nav {
    display: none;
  }

  .ver-wrap {
    display: none;
  }

  .mobile-nav {
    display: flex;
  }
}
</style>