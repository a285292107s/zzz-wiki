/* ============================================================
 * router/views.ts — 类目视图懒加载映射（纯模块，零副作用）
 *
 * router/index.ts 用它生成路由；useDetailPrefetch 复用同一批懒加载函数——
 * 预取与正式导航拿到同一个 import() promise，chunk 缓存天然归一。
 * 独立成模块的原因：index.ts 有 createRouter 副作用，预取层引用它会
 * 把完整 router 拖进组件测试的 mock 面（styleguide-colors 曾因此破裂）。
 * ============================================================ */

/** 类目视图懒加载映射：catalog 条目路径 → [名录页, 详情页]。
 *  路径/名称/标题由 CATALOG 派生（单一事实源），此处只登记组件文件。 */
export const catalogViews: Record<string, [() => Promise<unknown>, () => Promise<unknown>]> = {
  '/agents': [() => import('@/views/AgentsView.vue'), () => import('@/views/AgentDetailView.vue')],
  '/w-engines': [() => import('@/views/WEnginesView.vue'), () => import('@/views/WEngineDetailView.vue')],
  '/bangboos': [() => import('@/views/BangboosView.vue'), () => import('@/views/BangbooDetailView.vue')],
  '/disks': [() => import('@/views/DisksView.vue'), () => import('@/views/DiskDetailView.vue')],
}
