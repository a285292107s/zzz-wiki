import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  /* 深链：前进/后退还原，hash 锚点平滑直达（元素未就绪时由视图层兜底滚动） */
  scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) {
      const id = to.hash.slice(1)
      if (document.getElementById(id)) return { el: to.hash, top: 0, behavior: 'smooth' }
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
