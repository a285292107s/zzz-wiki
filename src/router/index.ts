import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: () => ({ top: 0 }),
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
      path: '/disks',
      name: 'disks',
      component: () => import('@/views/DisksView.vue'),
      meta: { title: '驱动盘' },
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
