<script setup lang="ts">
import { RouterView } from 'vue-router'
import SiteHeader from '@/components/layout/SiteHeader.vue'
import SiteFooter from '@/components/layout/SiteFooter.vue'
import TermTip from '@/components/detail/TermTip.vue'
import { ErrorBoundary } from '@/components'
</script>

<template>
  <div class="shell">
    <!-- 键盘跳转链接：首个 Tab 即达正文，免于逐个穿过站头导航；获焦前视觉隐藏 -->
    <a class="skip-link mono" href="#main">跳至档案正文</a>

    <!-- 站头：导航 / 移动端菜单（SiteHeader） -->
    <SiteHeader />

    <!-- 主内容区：ErrorBoundary 包裹视图，渲染异常时捕获并显示友好回退，避免白屏 -->
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
    <SiteFooter />
  </div>

  <!-- 术语悬停浮层：全局委托监听，读本地名词表 -->
  <TermTip />
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
</style>