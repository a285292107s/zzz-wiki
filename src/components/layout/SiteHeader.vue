<template>
  <!-- 全站站头：显式 banner landmark（Vue 根挂载于 #app，隐式 banner 不生效）。
       整条作为一个编排区块参与「整页退场 / 逐条入场」（见 utils/viewTransition/chrome） -->
  <header ref="mastheadEl" class="masthead" role="banner" data-vt-hold>
    <div class="wrap masthead-inner">
      <!-- 品牌回首页。@click 收起菜单：品牌在面板之外，收起的三条路径（watch 路由、
           面板内委托、Esc）都盖不住它——同页点它时路径不变、watch 不触发，
           菜单会赖着把内容推开（与「点当前页自己那条」同源）。 -->
      <RouterLink to="/" class="brand" @click="menuOpen = false">
        <!-- 品牌符号：黑色线稿反色为纸白；文字已由 brand-mark 提供，纯装饰 -->
        <img class="brand-logo" src="/logo.png" alt="" width="24" height="26" aria-hidden="true" />
        <span class="brand-text">
          <span class="brand-mark">{{ t.header.brandName }}</span>
          <span class="brand-sub mono">NEW ERIDU · DATA TERMINAL</span>
        </span>
      </RouterLink>

      <!-- 主排导航：只在能**单行放下**的宽度出现（见样式 1000 断点的空间账）。
           放不下时整排收进 ☰ 菜单，菜单列同一份 NAV_ENTRIES，两处不会漂移。 -->
      <nav class="nav" :aria-label="t.header.mainNav">
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

      <div class="masthead-tools">
        <!-- 可访问名从内容派生（「检索」）＝视觉可见文本，故不给 aria-label：
             ⓐ 满足 WCAG 2.5.3 Label in Name，ⓑ 避开 axe label-content-name-mismatch
             （该规则只在名字来自 aria-label 时校验，且以视觉文本为基准）。
             放大镜字形由 CSS 生成内容提供，不进文本节点。 -->
        <button type="button" class="search-toggle mono" @click="openSearch()">
          <span class="st-word">{{ t.header.search }}</span>
          <kbd class="st-kbd">Ctrl K</kbd>
        </button>

        <!-- 窄屏导航切换钮（disclosure：非模态，故焦点不圈定、不改 Tab 序）。
             名字固定为「菜单」——开合状态交给 aria-expanded 表达，
             按钮名不随状态变（名字随状态变会让读屏听起来像两个不同的按钮）。 -->
        <button
          ref="menuToggleEl"
          type="button"
          class="menu-toggle mono"
          :class="{ open: menuOpen }"
          :aria-expanded="menuOpen"
          aria-controls="site-menu"
          @click="menuOpen = !menuOpen"
        >
          <span class="burger" aria-hidden="true">
            <i /><i /><i />
          </span>
          <span class="menu-word">{{ t.header.menu }}</span>
        </button>
      </div>
    </div>

    <!-- 窄屏导航面板：与主排导航同一份清单，逐条细线行（无卡片、无浮层投影）。
         推开式而非浮层——站头是 sticky 的，展开即把内容下移，层级不需要再叠一层遮罩。
         @click 做的是**事件委托**（不是给每条链接挂一份）：面板内只有链接，
         点中任一条即收起。光靠 watch(route.fullPath) 不够——点「当前页自己」那条时
         路径没变、watch 不触发，菜单会赖着不收。 -->
    <nav
      id="site-menu"
      v-show="menuOpen"
      class="site-menu"
      :aria-label="t.header.siteNav"
      @click="onMenuPanelClick"
    >
      <RouterLink
        v-for="item in nav"
        :key="item.to"
        :to="item.to"
        class="menu-item"
        :class="{ active: isActive(item.to) }"
        :aria-current="isActive(item.to) ? 'true' : undefined"
      >
        <span class="no mono">{{ item.no }}</span>
        <span class="label">{{ item.label }}</span>
      </RouterLink>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { NAV_ENTRIES } from '@/domain/catalog'
import { pickText } from '@/domain/lang'
import { useQuickSearch } from '@/composables/useQuickSearch'
import { useMediaQuery } from '@/composables/useMediaQuery'
import { useUiText } from '@/composables/useUiText'
import { useLocale } from '@/composables/useLocale'

// 导航由 catalog.ts 派生（DESIGN.md §5.3 单一事实源）：数据类目 + 进主导航的图文板块
// （nav:false 的板块——如数据说明——只在首页目录与页脚出现，站头保持内容聚焦）。
// 窄屏（≤999）不列主排导航，☰ 菜单接管；两处共用这一份清单。检索面板不列导航。
const { t } = useUiText()
const { lang } = useLocale()
const route = useRoute()
const nav = computed(() =>
  NAV_ENTRIES.map((e) => ({ no: e.no, to: e.to, label: pickText(e.label, lang.value) })),
)

const isActive = (to: string) =>
  route.path === to || (to !== '/' && route.path.startsWith(to))

/* ---------- 窄屏导航面板（≤999） ---------- */

const menuOpen = ref(false)
const menuToggleEl = ref<HTMLButtonElement | null>(null)
const mastheadEl = ref<HTMLElement | null>(null)

/** 菜单只在 ≤999 存在（同一断点，见样式）。手机转横屏 / 拖宽窗口越过断点后，
 *  面板已随 CSS 隐藏，但展开态会留在 ref 里——转回手机就是「一进来菜单已经开着，
 *  且切换钮读作 expanded」。这里跟着断点收起，状态与可见性始终一致。
 *  （模块内不重复写断点数字：查询串与样式里的 999 是同一条，改则两处一起改。） */
const menuBreakpoint = useMediaQuery('(max-width: 999px)')
watch(menuBreakpoint, (narrow) => {
  if (!narrow) menuOpen.value = false
})

// 全局快速检索（Ctrl/⌘+K；按钮唤起）
// 名录页唤起时把该页已输入的搜索词带入面板（?q= 参数）——同一目标换更强的工具继续找
const { phase: searchPhase, toggle: toggleSearch } = useQuickSearch()
function openSearch() {
  const q = typeof route.query.q === 'string' ? route.query.q : undefined
  toggleSearch(q)
}

/** 检索面板一开就收起菜单。
 *  ⚠ 必须挂在这里、而不是塞进 openSearch()：唤起面板有**两条**路径——站头检索钮走
 *  openSearch，而全局 Ctrl/⌘+K 由 App.vue 直接调 toggle（绕过本组件）。只在
 *  openSearch 里收，Ctrl+K 那条就会留下「菜单开着 + 模态面板盖在上面」：
 *  菜单留在可访问树里、Esc 又会被本组件的文档级监听抢走并把焦点拽出对话框。 */
watch(
  () => searchPhase.value === 'closed',
  (closed) => {
    if (!closed) menuOpen.value = false
  },
)

/** 路由一换就收起：浏览器前进后退、别处触发的跳转、以及点击条目导致的跳转都覆盖。
 *  ⚠ 但它盖不住「点当前页自己那条」——路径没变，watch 不触发（实测菜单会赖着不收），
 *  那一半由面板上的 click 委托兜住（onMenuPanelClick）。 */
watch(() => route.fullPath, () => {
  menuOpen.value = false
})

/** 点面板里的**链接**即收起（事件委托，不必逐条挂）。
 *  与上面的 watch 互补：正常跳转两者都会命中，同页跳转只有这里能命中。
 *  只认 `closest('a')`：点面板的留白（内边距）不该顺手关掉菜单——那是误触，不是选择。
 *  键盘回车激活链接时浏览器同样会派发 click，故键盘路径一并覆盖。 */
function onMenuPanelClick(e: MouseEvent): void {
  if ((e.target as Element | null)?.closest('a')) menuOpen.value = false
}

/** 点站头之外收起：面板是推开式，不收起会一直占着版面。
 *  判定用「是否落在站头内」而不是「是否点在切换钮上」——后者会让点按钮时
 *  pointerdown 先关、click 再开，等于按了没反应。 */
function onDocPointerDown(e: PointerEvent): void {
  if (!menuOpen.value) return
  const t = e.target as Node | null
  if (t && mastheadEl.value?.contains(t)) return
  menuOpen.value = false
}

/** Esc 关闭（不拦在输入法组合中：那时 Esc 是「取消候选」，不该顺手关掉菜单） */
function onDocKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape' || !menuOpen.value || e.isComposing) return
  menuOpen.value = false
  menuToggleEl.value?.focus()
}

onMounted(() => {
  document.addEventListener('keydown', onDocKeydown)
  document.addEventListener('pointerdown', onDocPointerDown)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onDocKeydown)
  document.removeEventListener('pointerdown', onDocPointerDown)
})
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
  /* 站名同样不许断词（「新エリー都データターミ / ナル」实测）；见文末断点空间账 */
  white-space: nowrap;
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

/* ---------- 工具钮组（检索 + 窄屏菜单） ---------- */

.masthead-tools {
  display: inline-flex;
  align-items: center;
  /* 两钮成组：6px 让它们读成一排工具，与品牌之间仍由行距（12/24px）分开 */
  gap: 6px;
}

/* ---------- 检索钮（⌘K） ---------- */

.search-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
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

.search-toggle:focus-visible {
  outline: 1px solid var(--amber);
  outline-offset: 2px;
}

/* ---------- 菜单钮（≤999 才出现） ---------- */

.menu-toggle {
  display: none;
  align-items: center;
  justify-content: center;
  /* 与检索钮同高（视觉等高才读成一排工具）；宽度由内边距定，命中区 34×39 远超 2.5.8 的 24 */
  min-height: 39px;
  padding: 6px 9px;
  border: 1px solid var(--line-1);
  border-radius: 2px;
  background: none;
  color: var(--ink-2);
  cursor: pointer;
  transition: color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease);
}

@media (hover: hover) {
  .menu-toggle:hover {
    color: var(--ink-0);
    border-color: var(--line-2);
  }
}

/* 展开态：琥珀描边 + 下方一条下刻线（与全站「当前项」同一套语法） */
.menu-toggle.open {
  color: var(--ink-0);
  border-color: var(--amber);
}

.menu-toggle:focus-visible {
  outline: 1px solid var(--amber);
  outline-offset: 2px;
}

/* 三横线字形：纯装饰（aria-hidden），开合只改形态不改名字 */
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
  /* 标签是**不可断的单元**：换行会把「代理人」拆成「代理 / 人」、「Drive Discs」拆成
     「Drive / Discs」，读起来像两行两个词（实测截图）。宽度不够时该整排收进 ☰ 菜单，
     而不是就地折行——断点与空间账见文末。 */
  white-space: nowrap;
}

/* 非中文的导航/站名**字距与内边距按拉丁文（韩文）排版还原**：
   0.22em / 0.06em 的字距是给「新艾利都数据终端」这类 CJK 短标设计的（中文方块字天然
   等宽，加字距才有档案标本的疏朗感）；但同一套字距压到拉丁文上是**纯浪费**——
   en "Combat Formulas" / "W-Engines"、ko "드라이브 디스크" 每个字母之间都被撑开，
   于是断点边界附近整排导航会折成两行、站名折成三行（实测）。这里只改字距与内边距，
   不动字号，故视觉层级不变；中文档保持原样（`:not(:lang(zh))` 依赖 useLocale
   写入的 `<html lang>`，单一事实源是 src/domain/langs.json）。 */
html:not(:lang(zh)) .nav-item .label,
html:not(:lang(zh)) .nav-item .no {
  letter-spacing: 0;
}

html:not(:lang(zh)) .nav {
  gap: 2px;
}

html:not(:lang(zh)) .nav-item {
  gap: 6px;
  padding: 8px 8px;
}

html:not(:lang(zh)) .brand-mark {
  letter-spacing: 0.1em;
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

/* ---------- 窄屏导航面板 ---------- */

.site-menu {
  display: flex;
  flex-direction: column;
  padding: 8px var(--pad-page) 14px;
  border-top: var(--rule);
  background: var(--bg-0);
}

.menu-item {
  display: flex;
  align-items: baseline;
  gap: var(--space-inline);
  /* 命中区 12+12+行高 ≈ 44px：触屏拇指档，远超 2.5.8 的 24 */
  padding: 12px 2px;
  border-bottom: 1px solid var(--line-0);
  color: var(--ink-1);
  transition: color var(--t-fast) var(--ease);
}

/* 末端收口只画一次：末项的下边线归站头自己那条（border-bottom），
   否则两条线相邻叠成 2px（同 QUALITY.md 的「叠线」判据） */
.menu-item:last-child {
  border-bottom: none;
}

.menu-item .no {
  font-size: var(--fs-micro);
  color: var(--ink-2); /* 同主排导航：编号是可见文本，需过 AA（ink-3 仅 2.28:1） */
}

.menu-item .label {
  font-size: var(--fs-body);
  letter-spacing: 0.06em;
}

@media (hover: hover) {
  .menu-item:hover {
    color: var(--ink-0);
  }
}

.menu-item.active {
  color: var(--ink-0);
}

.menu-item.active .no {
  color: var(--amber);
}

/* ---------- responsive ---------- */

/* 1000 是「主排导航收进 ☰」的断点。空间账（390 基准 · 360 安全下限，均为实测）：
     品牌 219 + 行距 12 + 工具组（检索 30 + 组内距 6 + 菜单 34 = 70）= 301
     390 档内容宽 350 → 余 49；360 档内容宽 320 → 余 19
     320 档内容宽 280 → 差 21，故 ≤359 隐去品牌英文副标题（见文末）

   ⚠ 这个数**必须按最长的那门语言算**，不能只算中文：原先是按 zh 的
     品牌 219 + 行距 24 + 导航 583 + 行距 24 + 检索 30 = 880（视口 ≥ 957 即够，取 980 留余量）。
     但导航与站名都要按语言切换文案（见上方 `html:not(:lang(zh))` 那组字距还原），
     四语实测的**一行放下所需最小视口**：zh 980、ko 980、ja 980、**en 1000**——
     en 的「New Eridu Data Terminal / W-Engines / Combat Formulas」最长。
     故断点取 1000（覆盖最长语言 + 留余量）；980–999 在 en 下会横向溢出（文档宽 994 > 视口）。

   ⚠ 更早的断点是 720，而 721–960 主排导航**根本放不下**：该区间「每个条目的标签文字」
   折成 2–4 行，导航容器高 62–108px（栏高只有 62），栏外可见溢出最多 23px
   （`.masthead` 是 `overflow: visible`，溢出文字压住页面内容）。逐档实测（标签文字行数
   / 容器高 / 栏外可见溢出）：720–740 → 4 行 / 108.4px / 23.2px；768–800 → 3 行 /
   85.3px / 11.6px；820–940 → 2 行 / 62.2px / 0.1px（贴边，视觉上仍算坏）；
   950 起 1 行 / 39.1px / 0。断点定得比导航实际需要的宽度低，现在与空间账对齐，
   这个区间改由 ☰ 接管。 */
@media (max-width: 999px) {
  .masthead-inner {
    gap: var(--space-inline);
  }

  .nav {
    display: none;
  }

  .menu-toggle {
    display: inline-flex;
  }

  /* 菜单钮取「☰」图标形态：文字「菜单」视觉隐藏（而非 display:none——那会把按钮文本
     从可访问树里摘掉，按钮将无可访问名，axe button-name critical）。见上面的空间账：
     带字形态 64px 会把 390 档的余量吃到 0、320 档直接挤压品牌。 */
  .menu-word {
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
}

/* ≥1000：主排导航接管，菜单与面板都不出现（display:none 同时移出可访问树，
   不留不可见焦点位）。v-show 的展开态不设 inline display，故这条规则始终生效。 */
@media (min-width: 1000px) {
  .site-menu {
    display: none;
  }
}

/* ≤1100：检索钮取图标形态（⌕ 单项）。两个档位都是横向真的放不下带字钮：
   1000–1100 主排导航占着空间；≤999 要让出菜单钮的位置（见上面的空间账）。
   文字「检索」视觉隐藏而非 display:none——后者会把按钮文本从可访问树里摘掉，
   按钮将无可访问名（axe button-name critical）；视觉隐藏则名字保持「检索」。
   CTRL K 键帽同去：触屏按不到那个键，留着是给不存在的按键做广告。 */
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
    padding: 6px 9px;
  }
}

/* ≤359：上面那笔账在 320 档差 21（内容宽 280 装不下 301），唯一的出路是把品牌变窄。
   英文副标题是纯装饰（中文站名已把话说尽），去掉后品牌 219→180，
   加上菜单钮仍余 18px，品牌不再折行。 */
@media (max-width: 359px) {
  .brand-sub {
    display: none;
  }
}
</style>
