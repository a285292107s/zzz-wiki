<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router'

const route = useRoute()

const nav = [
  { no: '01', label: '代理人', to: '/agents' },
  { no: '02', label: '音擎', to: '/w-engines' },
  { no: '03', label: '邦布', to: '/bangboos' },
  { no: '04', label: '驱动盘', to: '/disks' },
]

const isActive = (to: string) =>
  route.path === to || (to !== '/' && route.path.startsWith(to))
</script>

<template>
  <div class="shell">
    <header class="masthead">
      <div class="wrap masthead-inner">
        <RouterLink to="/" class="brand">
          <span class="brand-mark mono">HOLLOW://ARCHIVE</span>
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
      </div>
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
        <p class="mono">HOLLOW://ARCHIVE · v0.1</p>
        <p>
          数据源 <a href="https://git.mero.moe/dimbreath/ZenlessData" target="_blank" rel="noopener">Dimbreath ZenlessData</a>
          · 非官方项目 · 与米哈游 / HoYoverse 无关
        </p>
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

.foot a:hover {
  color: var(--amber-hi);
  border-color: var(--amber);
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
    height: auto;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    padding-block: 14px;
  }

  .nav {
    width: 100%;
    overflow-x: auto;
    padding-bottom: 4px;
  }

  .foot-inner {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>