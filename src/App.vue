<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { CATALOG } from '@/domain/catalog'

const route = useRoute()

// 导航由 catalog.ts 派生（DESIGN.md §5.3 单一事实源）
const nav = CATALOG.map((c) => ({ no: c.no, label: c.label, to: c.path }))

const isActive = (to: string) =>
  route.path === to || (to !== '/' && route.path.startsWith(to))

// 移动端菜单（Q3a）
const menuOpen = ref(false)
function closeMenu() {
  menuOpen.value = false
}
</script>

<template>
  <div class="shell">
    <!-- 全站站头：显式 banner landmark（Vue 根挂载于 #app，隐式 banner 不生效） -->
    <header class="masthead" role="banner">
      <div class="wrap masthead-inner">
        <RouterLink to="/" class="brand">
          <span class="brand-mark mono">ROPEWEB://ARCHIVE</span>
          <span class="brand-sub">新艾利都数据终端</span>
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
      </nav>
    </header>

    <main class="main">
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>

    <footer class="foot">
      <div class="wrap foot-inner">
        <p class="mono">ROPEWEB://ARCHIVE · v0.1</p>
        <p>
          数据源 <a href="https://git.mero.moe/dimbreath/ZenlessData" target="_blank" rel="noopener">Dimbreath ZenlessData</a>
          · 非官方项目 · 与米哈游 / HoYoverse 无关
        </p>
        <RouterLink to="/style" class="style-link mono">DESIGN SYSTEM</RouterLink>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

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
  flex-direction: column;
  line-height: 1.15;
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

/* ---------- main ---------- */

.main {
  flex: 1;
}

/* ---------- footer ---------- */

.foot {
  border-top: var(--rule);
  margin-top: calc(var(--pad-section) * 1.2);
}

.foot-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-block: 26px;
  font-size: 12.5px;
  color: var(--ink-2);
}

.foot a {
  color: var(--ink-1);
  border-bottom: 1px solid var(--line-1);
  transition: color var(--t-fast) var(--ease);
}

.style-link {
  font-size: 11px;
  letter-spacing: 0.18em;
  color: var(--ink-2) !important;
  border: 1px solid var(--line-1) !important;
  padding: 4px 10px;
  border-radius: 2px;
}

.style-link:hover {
  color: var(--amber-hi) !important;
  border-color: var(--amber) !important;
}

.foot a:hover {
  color: var(--amber-hi);
  border-color: var(--amber);
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

/* ---------- page transition ---------- */

.page-enter-active,
.page-leave-active {
  transition: opacity var(--t-med) var(--ease),
    transform var(--t-med) var(--ease);
}

.page-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.page-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

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

  .mobile-nav {
    display: flex;
  }

  .foot-inner {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>