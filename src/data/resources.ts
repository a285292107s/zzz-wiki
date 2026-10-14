/* ============================================================
 * 资源访问 — 类别表驱动（DESIGN.md §6.1）。
 * 视图不直接接触 api.kind 字符串，按 catalog 条目取列表/详情；
 * 新增类别时只写 catalog.ts 一处。
 *
 * 多语言：两类取数都要传当前语言（名录与详情都是**按语言**落的数据面）。
 * 语言状态归 composables/useLocale，本层只做透传，不持有状态。
 * ============================================================ */

import { type CatalogEntry } from '@/domain/catalog'
import type { Lang } from '@/domain/lang'
import { api } from './api'

/** 按类目取名录（泛型 T 由调用方声明） */
export function listFor<T extends Record<string, unknown>>(
  entry: CatalogEntry,
  lang: Lang,
): Promise<T[]> {
  return api.list<T>(entry.listFile, lang)
}

/** 按类目取详情 */
export function detailFor<T>(
  entry: CatalogEntry,
  id: number | string,
  lang: Lang,
): Promise<T> {
  return api.detail(entry.detailDir, id, lang)
}
