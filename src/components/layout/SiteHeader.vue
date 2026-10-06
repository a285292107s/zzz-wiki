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
          :aria-current="isActive(item.to) ? 'true' : undefined"
        >
          <span class="no mono">{{ item.no }}</span>
          <span class="label">{{ item.label }}</span>
        </RouterLink>
      </nav>

      <!-- 可访问名从内容派生（「检索 Ctrl K」）＝视觉可见文本，故不给 aria-label：
           ⓐ 满足 WCAG 2.5.3 Label in Name，ⓑ 避开 axe label-content-name-mismatch
           （该规则只在名字来自 aria-label 时校验，且以视觉文本为基准）。
           放大镜字形由 CSS 生成内容提供，不进文本节点。 -->
      <button type="button" class="search-toggle mono" @click="openSearch()">
        <span class="st-word">检索</span>
        <kbd class="st-kbd">Ctrl K</kbd>
      </button>

      <button
        ref="menuToggleEl"
        type="button"
        class="menu-toggle mono"
        :class="{ open: menuOpen }"
        :aria-expanded="menuOpen"
        aria-controls="mobile-nav"
        :aria-label="(menuOpen ? 'CLOSE' : 'MENU') + ' · 切换导航菜单'"
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
        :aria-current="isActive(item.to) ? 'true' : undefined"
        @click="closeMenu"
      >
        <span class="no mono">{{ item.no }}</span>
        <span class="label">{{ item.label }}</span>
      </RouterLink>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { CATALOG, GUIDE_ENTRIES } from '@/domain/catalog'
import { useQuickSearch } from '@/composables/useQuickSearch'

// 导航由 catalog.ts 派生（DESIGN.md §5.3 单一事实源）：数据类目 + 进主导航的图文板块
// （nav:false 的板块——如数据说明——只在首页目录与页脚出现，站头保持内容聚焦）
const route = useRoute()
const nav = [
  ...CATALOG.map((c) => ({ no: c.no, label: c.label, to: c.path })),
  ...GUIDE_ENTRIES.filter((g) => g.nav).map((g) => ({ no: g.no, label: g.label, to: g.path })),
]

const isActive = (to: string) =>
  route.path === to || (to !== '/' && route.path.startsWith(to))

// 移动端菜单：路由切换关闭（closeMenu 由条目点击触发）+ Esc 关闭 + 焦点归还切换钮
const menuOpen = ref(false)
const menuToggleEl = ref<HTMLButtonElement | null>(null)
function closeMenu() {
  menuOpen.value = false
}
function onDocKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && menuOpen.value) {
    menuOpen.value = false
    menuToggleEl.value?.focus()
  }
}
onMounted(() => document.addEventListener('keydown', onDocKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onDocKeydown))

// 全局快速检索（Ctrl/⌘+K；按钮唤起）
// 名录页唤起时把该页已输入的搜索词带入面板（?q= 参数）——同一目标换更强的工具继续找
const { toggle: toggleSearch } = useQuickSearch()
function openSearch() {
  const q = typeof route.query.q === 'string' ? route.query.q : undefined
  toggleSearch(q)
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

/* ---------- 检索钮（⌘K） ---------- */

.search-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-left: 10px;
  padding: 6px 10px;
  border: 1px solid var(--line-1);
  border-radius: 2px;
  background: none;
  color: var(--ink-2);
  font-size: var(--fs-caption);
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease);
}

/* 放大镜字形：CSS 生成内容（不进文本节点，避免成为可访问名/可见文本的一部分） */
.search-toggle::before {
  content: '⌕';
  color: var(--amber);
  font-size: var(--fs-body);
}

.st-kbd {
  font-family: var(--mono);
  font-size: var(--fs-badge);
  letter-spacing: 0.1em;
  /* ink-2（4.87:1）而非 ink-3（2.28:1）：axe color-contrast 实测 9px 小字需 AA */
  color: var(--ink-2);
  border: 1px solid var(--line-0);
  border-radius: 2px;
  padding: 1px 5px;
}

/* 窄屏：仅留 ⌕ 图标钮。文字「检索」改为视觉隐藏而非 display:none——
   display:none 会把按钮文本从可访问树里摘掉，按钮将无可访问名（axe button-name critical）；
   视觉隐藏则名字保持「检索」，读屏仍可识别。键位提示窄屏无用，直接移除 */
@media (max-width: 1100px) {
  .st-word {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .st-kbd {
    display: none;
  }

  .search-toggle {
    margin-left: 2px;
    padding: 6px 9px;
  }
}

.search-toggle:focus-visible {
  outline: 1px solid var(--amber);
  outline-offset: 2px;
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
  /* ink-2（4.87:1）而非 ink-3（2.28:1）：编号在链接内是可见文本，需过 AA */
  color: var(--ink-2);
  transition: color var(--t-fast) var(--ease);
}

.nav-item .label {
  font-size: var(--fs-md);
  letter-spacing: 0.06em;
}

@media (hover: hover) {
  .nav-item:hover {
    color: var(--ink-0);
    background: var(--bg-3);
  }
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

@media (hover: hover) {
  .menu-toggle:hover {
    color: var(--ink-0);
    border-color: var(--line-2);
  }
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
  color: var(--ink-2); /* 同桌面导航：编号是可见文本，需过 AA（ink-3 仅 2.28:1） */
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