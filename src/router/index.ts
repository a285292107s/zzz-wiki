import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { CATALOG } from '@/domain/catalog'
import { DEV_ROUTES } from '@/domain/devRoutes'
import { resolveAnchorOffset } from '@/composables/anchorOffset'

/** 类目中文名（页面标题文案由 catalog 单一事实源派生；详情页拼接「详情」） */
const catTitle = (path: string, suffix = '') => {
  const c = CATALOG.find((x) => x.path === path)
  return `${c?.label ?? path}${suffix}`
}

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
        // 避免滚动后目标漂移。偏移取横条实际高度（anchorOffset，含 wrap 多行）
        let y = 0
        let node: HTMLElement | null = el
        while (node && node !== document.body && node !== document.documentElement) {
          y += node.offsetTop
          node = node.offsetParent as HTMLElement | null
        }
        return { top: y - resolveAnchorOffset(), behavior: 'smooth' }
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
      meta: { title: catTitle('/agents') },
    },
    {
      path: '/agents/:id',
      name: 'agent-detail',
      component: () => import('@/views/AgentDetailView.vue'),
      props: true,
      meta: { title: catTitle('/agents', '详情') },
    },
    {
      path: '/w-engines',
      name: 'w-engines',
      component: () => import('@/views/WEnginesView.vue'),
      meta: { title: catTitle('/w-engines') },
    },
    {
      path: '/w-engines/:id',
      name: 'w-engine-detail',
      component: () => import('@/views/WEngineDetailView.vue'),
      props: true,
      meta: { title: catTitle('/w-engines', '详情') },
    },
    {
      path: '/bangboos',
      name: 'bangboos',
      component: () => import('@/views/BangboosView.vue'),
      meta: { title: catTitle('/bangboos') },
    },
    {
      path: '/bangboos/:id',
      name: 'bangboo-detail',
      component: () => import('@/views/BangbooDetailView.vue'),
      props: true,
      meta: { title: catTitle('/bangboos', '详情') },
    },
    {
      path: '/disks',
      name: 'disks',
      component: () => import('@/views/DisksView.vue'),
      meta: { title: catTitle('/disks') },
    },
    {
      path: '/disks/:id',
      name: 'disk-detail',
      component: () => import('@/views/DiskDetailView.vue'),
      props: true,
      meta: { title: catTitle('/disks', '详情') },
    },
    {
      path: '/formulas',
      name: 'formulas',
      component: () => import('@/views/FormulasView.vue'),
      meta: { title: '战斗公式' },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
      meta: { title: '404' },
    },
  ],
})

/* 开发环境专属页面：仅在开发环境注册（构建级排除）。
   生产构建下 import.meta.env.DEV 被编译为 false，整块连同 dev 视图的懒加载 chunk 一并被摇树移除，
   这些路由在 prod 根本不存在——直接访问会落到 404，运行时零打包、无任何可触达入口。
   dev 视图的懒加载只放这里（不放 devRoutes.ts，避免页脚共享元数据时把 chunk 拖进生产包）。
   新增 dev 页：devRoutes.ts 的 DEV_ROUTES 登记元数据 + 此处 views 补一条视图映射。 */
if (import.meta.env.DEV) {
  /** key 与 DEV_ROUTES 的 name 对齐。 */
  const views: Record<string, () => Promise<unknown>> = {
    'style-guide': () => import('@/views/StyleGuideView.vue'),
    calibrate: () => import('@/views/CalibrateView.vue'),
  }
  for (const r of DEV_ROUTES) {
    const view = views[r.name]
    if (!view) {
      console.warn(`[dev] 缺少 dev 路由视图：${r.name}`)
      continue
    }
    router.addRoute({
      path: r.path,
      name: r.name,
      component: view as RouteRecordRaw['component'],
      meta: { title: r.title },
    } as RouteRecordRaw)
  }
}
