/* ============================================================
 * useDetailPrefetch — 名录 → 详情 浏览回路的悬停预热
 *
 * 详情/名录页首开的两个串行成本：
 *   1) 视图 chunk（路由懒加载）
 *   2) 数据 JSON（名录 ~几十 KB / 详情 ~几十 KB）
 * 悬停/聚焦名录链接时把两者并行热身，点击后 chunk 与 JSON 均已就位
 * （api 层 promise 缓存 + Vite 模块缓存），页面近乎即时呈现。
 *
 * - chunk 复用 router 的 catalogViews 懒加载函数（单一事实源，导出共享）：
 *   预取与正式导航拿到的是同一个 import() promise，模块缓存天然归一。
 * - JSON 复用 api 层缓存（getJson 的 Map 缓存），热身后正式导航命中缓存，
 *   不产生第二次请求。
 * - 触发即忘（fire-and-forget）：失败静默——预取是优化不是功能，
 *   失败后点击详情走原有加载路径。
 * ============================================================ */

import type { CatalogEntry } from '@/domain/catalog'
import { detailFor, listFor } from '@/data/resources'
import { catalogViews } from '@/router'

/** 已预热过的视图 key（chunk 级去重；JSON 预取由 api 缓存天然幂等，无需记录） */
const warmed = new Set<string>()

function warmViews(entry: CatalogEntry): void {
  const pair = catalogViews[entry.path]
  if (!pair || warmed.has(entry.path)) return
  warmed.add(entry.path)
  void pair[1]().catch(() => warmed.delete(entry.path))
}

/** 预热名录页（名录 chunk + 名录 JSON）。目录行/导航类入口用。 */
export function prefetchList(entry: CatalogEntry): void {
  const pair = catalogViews[entry.path]
  if (pair && !warmed.has(entry.path)) {
    warmed.add(entry.path)
    void pair[0]().catch(() => warmed.delete(entry.path))
  }
  void listFor(entry).catch(() => {
    /* 预取失败静默 */
  })
}

/** 预热一个详情目标（chunk + 详情 JSON 并行，触发即忘）。 */
export function prefetchDetail(entry: CatalogEntry, id: number | string): void {
  warmViews(entry)
  // 详情 JSON：进入 api 层 promise 缓存；失败时缓存自动清除（api.ts getJson），可重试
  void detailFor(entry, id).catch(() => {
    /* 预取失败静默：正式导航仍会重新拉取 */
  })
}
