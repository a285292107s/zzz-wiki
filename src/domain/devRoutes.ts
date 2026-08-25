/* ============================================================
 * 开发环境专属页面 — 唯一事实源（同 catalog.ts 的「单一事实源」哲学）。
 * 仅开发环境可见/可用的工具页（设计系统、图库校准）统一在此登记：
 * 路由注册、页脚入口、生产环境锁定全部由此派生，不再允许手写第二份 dev-only 清单。
 *
 * ⚠ 本模块是「元数据」：**不含**任何 dev 视图的懒加载组件（component），
 *   dev 视图的 `() => import(...)` 只放在路由的 DEV 分支（见 router/index.ts）。
 *   否则页脚共享本表会把 dev 视图的 chunk 拖进生产包，违背「零打包」。
 * 纯数据模块：不依赖 Vue / api（避免循环依赖）。
 * ============================================================ */

/** 仅在开发环境为 true：生产构建下 Vite 会把 import.meta.env.DEV 编译为 false。 */
export const IS_DEV = import.meta.env.DEV

export interface DevRoute {
  /** 路由 name（同时作为路由 DEV 分支中视图映射的 key） */
  name: string
  /** 路由路径 */
  path: string
  /** 页面标题（页头/document title 用） */
  title: string
  /** 页脚入口文案（可选；不填则该页不进页脚） */
  footerLabel?: string
}

/** 开发环境专属页面元数据清单（新增页面先在此登记；再在 router DEV 分支补一个视图映射）。 */
export const DEV_ROUTES: readonly DevRoute[] = [
  {
    name: 'style-guide',
    path: '/style',
    title: '设计系统',
    footerLabel: 'DESIGN SYSTEM',
  },
  {
    name: 'calibrate',
    path: '/calibrate',
    title: '图库校准',
    footerLabel: 'CALIBRATE',
  },
]

/** 页脚展示的 dev 入口（有 footerLabel 的），SiteFooter 据此渲染。 */
export const DEV_FOOTER_ROUTES: readonly DevRoute[] = DEV_ROUTES.filter((r) => r.footerLabel)
