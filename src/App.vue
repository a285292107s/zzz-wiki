<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterView, useRouter } from 'vue-router'
import SiteHeader from '@/components/layout/SiteHeader.vue'
import SiteFooter from '@/components/layout/SiteFooter.vue'
import TermTip from '@/components/detail/TermTip.vue'
import QuickSearch from '@/components/QuickSearch.vue'
import { ErrorBoundary } from '@/components'
import { useQuickSearch } from '@/composables/useQuickSearch'
import { VT_ROOT_CLASS, useViewTransition } from '@/utils/viewTransition'

/* 站尾延迟到初始导航就绪后渲染：懒路由 chunk 到位前 footer 先落地、内容到达再下坠，
   是名录页 CLS 的主要来源（实测 0.061→目标 0）。isReady 后不再变化，无后续位移。 */
const router = useRouter()
const ready = ref(router.currentRoute.value.matched.length > 0)
router.isReady().then(() => {
  ready.value = true
})

/* 全局快速检索：Ctrl/⌘+K 唤起（终端式入口）。
   焦点在文本框内时**放行**——名录搜索框里按 Ctrl+K = 把当前词升级到全局检索
   （种子词优先取框内内容，其次 ?q=），这正是用户期待的升级路径。
   其余输入控件（contentEditable 等）仍让路。 */
const { toggle: toggleSearch } = useQuickSearch()

/* 共享元素过渡进行中：Vue 的页面过渡让位（见下方 .vt-active 覆盖）。 */
const { active: viewTransitionActive } = useViewTransition()
function onGlobalKeydown(e: KeyboardEvent): void {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    const el = e.target as HTMLElement | null
    const tag = el?.tagName.toLowerCase()
    if (el?.isContentEditable) return
    e.preventDefault()
    let q: string | undefined
    if (tag === 'input' || tag === 'textarea') {
      const v = (el as HTMLInputElement | HTMLTextAreaElement).value
      q = v?.trim() || undefined
    }
    if (!q) {
      const rq = router.currentRoute.value.query.q
      q = typeof rq === 'string' ? rq : undefined
    }
    toggleSearch(q)
  }
}
onMounted(() => document.addEventListener('keydown', onGlobalKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onGlobalKeydown))
</script>

<template>
  <div class="shell" :class="{ [VT_ROOT_CLASS]: viewTransitionActive }">
    <!-- 键盘跳转链接：首个 Tab 即达正文，免于逐个穿过站头导航；获焦前视觉隐藏 -->
    <a class="skip-link mono" href="#main">跳至档案正文</a>

    <!-- 站头：品牌 + 导航（窄屏隐去，改由检索面板直达区承载）+ 检索（SiteHeader） -->
    <SiteHeader />

    <!-- 主内容区：ErrorBoundary 包裹视图，渲染异常时捕获并显示友好回退，避免白屏。
         mode="out-in"（新视图等旧视图离场）只服务页面级过渡；共享元素过渡期间由
         .vt-active 停用（见 style 尾部），否则新视图的 DOM 更新会被压后、截图拍不到新画面 -->
    <main id="main" class="main" tabindex="-1">
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <ErrorBoundary>
            <component :is="Component" />
          </ErrorBoundary>
        </Transition>
      </RouterView>
    </main>

    <!-- 站尾（SiteFooter） -->
    <SiteFooter v-if="ready" />
  </div>

  <!-- 术语悬停浮层：全局委托监听，读本地名词表 -->
  <TermTip />

  <!-- 全局快速检索（Ctrl/⌘+K）：四类目统一档案索引 -->
  <QuickSearch />
</template>

<style scoped>
.shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.main {
  flex: 1;
  outline: none;
}

/* ---------- 跳转正文链接：获焦前藏于视口外，Tab 首格出现于站头左上 ---------- */

.skip-link {
  position: fixed;
  top: 10px;
  left: 10px;
  z-index: 300;
  padding: 8px 14px;
  background: var(--bg-0);
  border: 1px solid var(--amber);
  border-radius: 2px;
  color: var(--amber-hi);
  font-size: var(--fs-caption);
  letter-spacing: 0.12em;
  text-decoration: none;
  transform: translateY(-64px);
  opacity: 0;
  transition: transform var(--t-fast) var(--ease), opacity var(--t-fast) var(--ease);
}

.skip-link:focus-visible {
  transform: none;
  opacity: 1;
  outline-offset: 2px;
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

/* 共享元素过渡（View Transitions）进行中：页面过渡让位。
   浏览器要拍「新状态」的截图，而 mode="out-in" 会把新视图的 DOM 更新压后 260ms
   （再加上 .page-enter-from 的 opacity:0 一帧）——这样拍到的要么是旧画面、要么是全透明新页，
   共享元素必然空转。停用之后 DOM 立刻落定，飞行全程由 ::view-transition-* 负责
   （见 base.css 与 utils/viewTransition）。 */
.shell.vt-active .page-enter-active,
.shell.vt-active .page-leave-active,
.shell.vt-active .page-enter-from,
.shell.vt-active .page-leave-to {
  transition: none;
  opacity: 1;
  transform: none;
}
</style>
