import { nextTick } from 'vue'
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { CATALOG } from '@/domain/catalog'
import { DEV_ROUTES } from '@/domain/devRoutes'
import { resolveAnchorOffset } from '@/composables/anchorOffset'
// 首页是着陆页：静态编入主包（其余路由保持懒加载）。懒 chunk 到位前 main 只有站头+页脚，
// 内容到达时整页弹入、页脚下坠（实测 CLS 0.031 的来源）；着陆页 +2.5KB gzip 换首帧稳定。
import HomeView from '@/views/HomeView.vue'
import { catalogViews } from './views'

/** 由 catalog 条目生成「名录 + 详情」两条路由（视图映射见 ./views.ts） */
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
  scrollBehavior(to, from, savedPosition) {
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
    // 同路由、仅查询参数变化（名录筛选/搜索词、等级等经 URL 同步的状态）**不滚动**：
    // 否则每次筛选都被拉回页顶（2026-10 实测：列表页滚到 1200px 点筛选 → scrollY 0）。
    // 返回 false 表示「本次导航不改动滚动位置」。
    if (to.path === from.path) return false
    return { top: 0 }
  },
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
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
      path: '/about',
      name: 'about',
      component: () => import('@/views/AboutView.vue'),
      meta: { title: '数据说明' },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
      meta: { title: '404' },
    },
  ],
})

/* ---------- 路由切换的焦点管理（SPA 无障碍） ----------
   单页应用切路由不会像整页刷新那样把焦点与读屏游标归零：不处理的话，用户点完链接后
   焦点仍停在旧页面的元素上，新内容既不获焦点也不被播报，下一次 Tab 还从旧位置继续。
   故每次导航后把焦点移到正文容器（main 有 tabindex="-1"）：
   - 初次进入不抢焦点（地址栏/页面默认焦点保持，from 为 START_LOCATION 时跳过）
   - preventScroll：滚动仍由 scrollBehavior 负责，二者不打架
   - hash 导航优先聚焦目标区块（区块带 tabindex="-1"，见 DetailSection），
     读屏随之播报该区块标题（aria-labelledby）
   程序化 focus 不触发 :focus-visible（Chrome 启发式），因此不出现「整块正文被描边」。 */
router.afterEach((to, from) => {
  if (from.matched.length === 0) return // 首次进入
  void nextTick(() => {
    const target = to.hash ? document.getElementById(to.hash.slice(1)) : null
    // hash 目标须可聚焦（区块/封面块均带 tabindex="-1"）；否则退回正文容器，
    // 保证焦点始终落在有意义的位置而不是留在旧页面
    const el = target?.hasAttribute('tabindex') ? target : document.getElementById('main')
    el?.focus({ preventScroll: true })
  })
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
