<template>
  <!-- 全站站头：显式 banner landmark（Vue 根挂载于 #app，隐式 banner 不生效） -->
  <header class="masthead" role="banner">
    <div class="wrap masthead-inner">
      <RouterLink to="/" class="brand">
        <!-- 品牌符号：黑色线稿反色为纸白；文字已由 brand-mark 提供，纯装饰 -->
        <img class="brand-logo" src="/logo.png" alt="" width="24" height="26" aria-hidden="true" />
        <span class="brand-text">
          <span class="brand-mark">新艾利都数据终端</span>
          <span class="brand-sub mono">NEW ERIDU · DATA TERMINAL</span>
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
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { CATALOG, GUIDE_ENTRY } from '@/domain/catalog'

// 导航由 catalog.ts 派生（DESIGN.md §5.3 单一事实源）：数据类目 + 图文板块入口
const route = useRoute()
const nav = [
  ...CATALOG.map((c) => ({ no: c.no, label: c.label, to: c.path })),
  { no: GUIDE_ENTRY.no, label: GUIDE_ENTRY.label, to: GUIDE_ENTRY.path },
]

const isActive = (to: string) =>
  route.path === to || (to !== '/' && route.path.startsWith(to))

// 移动端菜单
const menuOpen = ref(false)
function closeMenu() {
  menuOpen.value = false
}
</script>

<style scoped>
/* ---------- masthead ---------- */

.masthead {
  position: sticky;
  top: 0;
  z-index: var(--z-nav);
  /* 不透明白底：去掉 backdrop-filter，避免首帧在 hero 大图上做昂贵合成分层，
     显著降低冷载首帧 LCP 成本；纸墨质感不变 */
  background: var(--bg-0);
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
  font-size: var(--fs-body);
  letter-spacing: 0.22em;
  color: var(--ink-0);
}

.brand-sub {
  font-size: var(--fs-badge);
  letter-spacing: 0.22em;
  color: var(--ink-2);
  margin-top: 3px;
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
  font-size: var(--fs-nano);
  color: var(--ink-3);
  transition: color var(--t-fast) var(--ease);
}

.nav-item .label {
  font-size: var(--fs-md);
  letter-spacing: 0.06em;
}

.nav-item:hover {
  color: var(--ink-0);
  background: var(--bg-3);
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

/* ---------- mobile menu (Q3a) ---------- */

.menu-toggle {
  display: none;
  align-items: center;
  gap: 8px;
  font-size: var(--fs-micro);
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
  font-size: var(--fs-micro);
  color: var(--ink-3);
}

.mobile-item .label {
  font-size: var(--fs-body);
  letter-spacing: 0.06em;
}

.mobile-item:hover,
.mobile-item.active {
  color: var(--ink-0);
}

.mobile-item.active .no {
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

  .mobile-nav {
    display: flex;
  }
}
</style>