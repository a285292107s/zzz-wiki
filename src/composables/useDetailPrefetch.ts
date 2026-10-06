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
import { catalogViews } from '@/router/views'

/** 已预热过的视图 key（chunk 级去重；JSON 预取由 api 缓存天然幂等，无需记录） */
const warmed = new Set<string>()

/** 悬停驻留门槛：扫过列表（快速掠过多行）不发射预取，停留即意图。
 *  InstantClick/quicklink 同款模式；90ms 对真实悬停意图无感。 */
const PREFETCH_DWELL_MS = 90

let dwellTimer: number | undefined
let dwellKey: string | undefined

function warmViews(entry: CatalogEntry): void {
  const pair = catalogViews[entry.path]
  if (!pair || warmed.has(entry.path)) return
  warmed.add(entry.path)
  void pair[1]().catch(() => warmed.delete(entry.path))
}

/** 预热名录页（名录 chunk + 名录 JSON）。目录行/导航类入口用。
 *  名录 JSON 每类目只有一个文件，无风暴问题，立即发射。 */
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

/** 悬停驻留版详情预取：pointerenter 用。驻留满门槛才发射，快速扫过自动作废。 */
export function armPrefetchDetail(entry: CatalogEntry, id: number | string): void {
  const key = `${entry.path}/${id}`
  if (dwellKey === key) return // 同一目标计时中
  clearTimeout(dwellTimer)
  dwellKey = key
  dwellTimer = window.setTimeout(() => {
    dwellTimer = undefined
    dwellKey = undefined
    prefetchDetail(entry, id)
  }, PREFETCH_DWELL_MS)
}

/** 立即版详情预取：pointerdown（触屏 / 快速点击者）用，绕过驻留门槛。
 *  重复调用由 api 层 promise 缓存归一，无二次网络。 */
export function prefetchDetail(entry: CatalogEntry, id: number | string): void {
  warmViews(entry)
  // 详情 JSON：进入 api 层 promise 缓存；失败时缓存自动清除（api.ts getJson），可重试
  void detailFor(entry, id).catch(() => {
    /* 预取失败静默：正式导航仍会重新拉取 */
  })
}
