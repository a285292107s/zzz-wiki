<template>
  <!-- 全站站头：显式 banner landmark（Vue 根挂载于 #app，隐式 banner 不生效）。
       整条作为一个编排区块参与「整页退场 / 逐条入场」（见 utils/viewTransition/chrome） -->
  <header class="masthead" role="banner" data-vt-hold>
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
    </div>
  </header>
</template>

<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { NAV_ENTRIES } from '@/domain/catalog'
import { useQuickSearch } from '@/composables/useQuickSearch'

// 导航由 catalog.ts 派生（DESIGN.md §5.3 单一事实源）：数据类目 + 进主导航的图文板块
// （nav:false 的板块——如数据说明——只在首页目录与页脚出现，站头保持内容聚焦）。
// 窄屏不列这排导航（见样式里的 720px 断点）：检索面板空态的「直达」区列同一份 NAV_ENTRIES，
// 即窄屏的导航入口——两处共用同一份清单，不会漂移
const route = useRoute()
const nav = NAV_ENTRIES

const isActive = (to: string) =>
  route.path === to || (to !== '/' && route.path.startsWith(to))

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

/* 站名即首页链接：悬停把主标题转到琥珀高亮（与全站链接语言一致），
   否则鼠标用户不会意识到它是可点的 */
@media (hover: hover) {
  .brand:hover .brand-mark {
    color: var(--amber-hi);
  }
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

/* 悬停反馈：transition 早已声明却一直没有 hover 规则（半成品状态）——
   交互态完整性审计按元素逐条实测发现的（2026-10） */
@media (hover: hover) {
  .search-toggle:hover {
    color: var(--ink-0);
    border-color: var(--line-2);
  }
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

/* 图标形态：文字「检索」改为视觉隐藏（而非 display:none——那会把按钮文本从可访问树里摘掉，
   按钮将无可访问名，axe button-name critical；视觉隐藏则名字保持「检索」，读屏仍可识别）
   ＋ 去掉 CTRL K 键帽 ＋ 收紧内边距。两个档位用同一形态，都是横向真的放不下带字钮：
   721–1100 站头导航占着空间；≤359 见下方响应式段的实测 */
@media (min-width: 721px) and (max-width: 1100px), (max-width: 359px) {
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

/* ---------- responsive ---------- */

/* 720 是「站头导航让位给检索面板」的断点：此断点以下吸顶栏只剩品牌与检索钮，
   导航（NAV_ENTRIES）改由检索面板空态的「直达」区承载（断点须与 QuickSearch 的
   直达区规则同步——两处互相注明）。行距收到 --space-inline，把带字钮的位置让出来 */
@media (max-width: 720px) {
  .masthead-inner {
    gap: var(--space-inline);
  }

  .nav {
    display: none;
  }
}

/* 360–720：手机断点下检索钮取桌面形态（⌕ + 文字「检索」），只去掉 CTRL K 键帽——
   触屏按不到那个键，留着是给不存在的按键做广告。
   实测：品牌 219 + 带字钮 67 + 行距 12 = 298，360px 档内容宽 320 放得下；
   更窄的 320 档内容宽 280 放不下（带字钮会把品牌次行挤成两行、钮自身也折行），
   故 ≤359 仍走上面的图标形态 */
@media (min-width: 360px) and (max-width: 720px) {
  .st-kbd {
    display: none;
  }
}
</style>

