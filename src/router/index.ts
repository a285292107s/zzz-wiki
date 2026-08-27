import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { CATALOG } from '@/domain/catalog'
import { DEV_ROUTES } from '@/domain/devRoutes'
import { resolveAnchorOffset } from '@/composables/anchorOffset'

/** 类目视图懒加载映射：catalog 条目 → [名录页, 详情页]。
 *  路径/名称/标题全部由 CATALOG 派生（单一事实源），此处只登记组件文件。 */
const catalogViews: Record<string, [() => Promise<unknown>, () => Promise<unknown>]> = {
  '/agents': [() => import('@/views/AgentsView.vue'), () => import('@/views/AgentDetailView.vue')],
  '/w-engines': [() => import('@/views/WEnginesView.vue'), () => import('@/views/WEngineDetailView.vue')],
  '/bangboos': [() => import('@/views/BangboosView.vue'), () => import('@/views/BangbooDetailView.vue')],
  '/disks': [() => import('@/views/DisksView.vue'), () => import('@/views/DiskDetailView.vue')],
}

/** 由 catalog 条目生成「名录 + 详情」两条路由 */
function catalogRoutes(): RouteRecordRaw[] {
  return CATALOG.flatMap((c): RouteRecordRaw[] => {
    const pair = catalogViews[c.path]
    if (!pair) throw new Error(`[router] 缺少类目视图映射：${c.path}`)
    const name = c.path.slice(1) // 'agents' / 'w-engines' …
    // 单一断言点：懒加载函数返回 Promise<unknown>，vue-router 判别联合无法窄化，边界处集中收口
    return [
      {
        path: c.path,
        name,
        component: pair[0],
        meta: { title: c.label },
      },
      {
        path: `${c.path}/:id`,
        name: `${name}-detail`,
        component: pair[1],
        props: true,
        meta: { title: `${c.label}详情` },
      },
    ] as unknown as RouteRecordRaw[]
  })
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
        // 避免滚动后目标漂移。偏移取横条实际高度（anchorOffset，单行恒定）
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
    ...catalogRoutes(),
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
