/* ============================================================
 * useCatalogSort — 列表列头排序（DESIGN.md §6.1 列表一致化）。
 * 输入已筛选的列表，返回排序后的数组与排序状态；由视图把
 * sortKey/sortDir 双向绑定到 CatalogTable 的表格头。
 * 纯展示排序，配合列配置（CatalogColumn.sortKey）使用。
 * ============================================================ */

import { computed, ref, toValue, type MaybeRefOrGetter, type Ref } from 'vue'

export type SortDir = 'asc' | 'desc'

export interface SortColumn<T> {
  /** 排序键；列头据此显示排序态与切换 */
  key: string
  /** 取值函数：返回可比较的 number/string/null */
  value: (item: T) => number | string | null | undefined
}

export interface CatalogSortOptions {
  /** 列表的默认排序键（需在 columns 中存在）；缺省为 null（不排序，保持原始顺序） */
  defaultKey?: string
  /** 默认排序方向；缺省 'asc' */
  defaultDir?: SortDir
}

export function useCatalogSort<T>(
  items: MaybeRefOrGetter<T[]>,
  columns: MaybeRefOrGetter<SortColumn<T>[]>,
  options: CatalogSortOptions = {},
) {
  const sortKey = ref<string | null>(options.defaultKey ?? null)
  const sortDir = ref<SortDir>(options.defaultDir ?? 'asc')

  /** 点击列头：同键翻转方向，否则切键并默认升序 */
  function toggle(key: string) {
    if (sortKey.value === key) {
      sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortKey.value = key
      sortDir.value = 'asc'
    }
  }

  const sorted = computed<T[]>(() => {
    const list = toValue(items)
    const key = sortKey.value
    if (!key) return list
    const cols = toValue(columns)
    const col = cols.find((c) => c.key === key)
    if (!col) return list
    const dir = sortDir.value === 'asc' ? 1 : -1
    return [...list].sort((a, b) => {
      const va = col.value(a)
      const vb = col.value(b)
      const na = typeof va === 'number' ? va : null
      const nb = typeof vb === 'number' ? vb : null
      if (na != null && nb != null) return (na - nb) * dir
      return String(va ?? '').localeCompare(String(vb ?? ''), 'zh-Hans-CN') * dir
    })
  })

  /** 供 CatalogTable 显示当前列排序方向 */
  function dirFor(key: string): SortDir | null {
    return sortKey.value === key ? sortDir.value : null
  }

  return { sortKey, sortDir, sorted, toggle, dirFor }
}

export type { Ref }
