import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  /* 深链：前进/后退还原，hash 锚点平滑直达（元素未就绪时由视图层兜底滚动）
     注意：Vue Router 的 { el } 滚动走 getBoundingClientRect 手动计算，CSS
     scroll-margin-top 不会生效；必须在此手动算避让偏移（站头/吸顶横条），
     偏移值读取 CSS 变量 --anchor-offset（base.css 单一来源，含断点）。 */
  scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) {
      const id = to.hash.slice(1)
      const el = document.getElementById(id)
      if (el) {
        // v-reveal 初始 translateY(14px) + 480ms transition 会污染 getBoundingClientRect；
        // 改用 offsetTop 链求文档流绝对位置（transform/transition 不影响），
        // 避免滚动后目标漂移。偏移读取 CSS 变量 --anchor-offset（base.css 单一来源）。
        let y = 0
        let node: HTMLElement | null = el
        while (node && node !== document.body && node !== document.documentElement) {
          y += node.offsetTop
          node = node.offsetParent as HTMLElement | null
        }
        const offset =
          parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--anchor-offset')) || 76
        return { top: y - offset, behavior: 'smooth' }
      }
    }
    return { top: 0 }
  },
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
      meta: { title: '首页' },
    },
    {
      path: '/agents',
      name: 'agents',
      component: () => import('@/views/AgentsView.vue'),
      meta: { title: '代理人' },
    },
    {
      path: '/agents/:id',
      name: 'agent-detail',
      component: () => import('@/views/AgentDetailView.vue'),
      props: true,
      meta: { title: '代理人详情' },
    },
    {
      path: '/w-engines',
      name: 'w-engines',
      component: () => import('@/views/WEnginesView.vue'),
      meta: { title: '音擎' },
    },
    {
      path: '/w-engines/:id',
      name: 'w-engine-detail',
      component: () => import('@/views/WEngineDetailView.vue'),
      props: true,
      meta: { title: '音擎详情' },
    },
    {
      path: '/bangboos',
      name: 'bangboos',
      component: () => import('@/views/BangboosView.vue'),
      meta: { title: '邦布' },
    },
    {
      path: '/bangboos/:id',
      name: 'bangboo-detail',
      component: () => import('@/views/BangbooDetailView.vue'),
      props: true,
      meta: { title: '邦布详情' },
    },
    {
      path: '/disks',
      name: 'disks',
      component: () => import('@/views/DisksView.vue'),
      meta: { title: '驱动盘' },
    },
    {
      path: '/disks/:id',
      name: 'disk-detail',
      component: () => import('@/views/DiskDetailView.vue'),
      props: true,
      meta: { title: '驱动盘详情' },
    },
    {
      path: '/style',
      name: 'style-guide',
      component: () => import('@/views/StyleGuideView.vue'),
      meta: { title: '设计系统' },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
      meta: { title: '404' },
    },
  ],
})
