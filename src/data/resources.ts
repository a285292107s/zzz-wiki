/* ============================================================
 * 资源访问 — 类别表驱动（DESIGN.md §6.1）。
 * 视图不直接接触 api.kind 字符串，按 catalog 条目取列表/详情；
 * 新增类别时只写 catalog.ts 一处。
 * ============================================================ */

import { type CatalogEntry } from '@/domain/catalog'
import { api, type DataKind, type Lang } from './api'

/** 按类目取名录（泛型 T 由调用方声明） */
export function listFor<T extends Record<string, unknown>>(entry: CatalogEntry): Promise<T[]> {
  return api.list<T>(entry.listFile as DataKind)
}

/** 按类目取详情（id + 可选语言，默认 zh） */
export function detailFor<T>(
  entry: CatalogEntry,
  id: number | string,
  lang?: Lang,
): Promise<T> {
  return api.detail(entry.detailDir as DataKind, id, lang)
}