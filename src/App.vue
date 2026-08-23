<script setup lang="ts">
import { RouterView } from 'vue-router'
import { dataVersion } from '@/data/api'
import { useVersionSync } from '@/composables/useVersionSync'
import SiteHeader from '@/components/layout/SiteHeader.vue'
import SiteFooter from '@/components/layout/SiteFooter.vue'
import TermTip from '@/components/detail/TermTip.vue'
import { ErrorBoundary } from '@/components'

// 数据版本与 URL 双向同步：?ver=live|latest 可分享直达，站内导航后自动补回参数
useVersionSync()
</script>

<template>
  <div class="shell">
    <!-- 站头：导航 / 数据版本切换 / 移动端菜单（SiteHeader） -->
    <SiteHeader />

    <!-- 主内容区：key=dataVersion 切换数据版本后整个视图重挂，所有列表/详情按新版本重新加载 -->
    <!-- ErrorBoundary 包裹视图：渲染异常时捕获并显示友好回退，避免白屏 -->
    <main class="main">
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <ErrorBoundary :key="dataVersion">
            <component :is="Component" />
          </ErrorBoundary>
        </Transition>
      </RouterView>
    </main>

    <!-- 站尾（SiteFooter） -->
    <SiteFooter />
  </div>

  <!-- 术语悬停浮层：全局委托监听，随 dataVersion 读本地名词表 -->
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