/* ============================================================
 * useCatalogSort — 列表列头排序（DESIGN.md §6.1 列表一致化）。
 * 输入已筛选的列表，返回排序后的数组与排序状态；由视图把
 * sortKey/sortDir 双向绑定到 CatalogTable 的表格头。
 * 纯展示排序，配合列配置（CatalogColumn.sortKey）使用。
 *
 * **排序深链（2026-10）**：`syncRoute: true` 时排序同步到 `?sort=<键>&dir=<asc|desc>`
 * ——「按稀有度降序的代理人名录」同样是可分享视图，与筛选/搜索（useCatalogList
 * 的 syncRoute）同属「URL = 视图」。
 *   - 初始化校验：键须在 columns 中、方向须为 asc/desc，否则回退默认
 *   - **非法参数就地清理**（链接不该声称一个并不生效的排序）
 *   - 回到默认（键与方向均为默认）时移除参数，默认链接保持干净
 *   - 变更经 router.replace（不增长历史）；依赖 scrollBehavior 同路由不滚动
 * ============================================================ */

import { computed, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

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
  /** 排序状态与 URL 查询参数双向同步（?sort=&dir=） */
  syncRoute?: boolean
}

export function useCatalogSort<T>(
  items: MaybeRefOrGetter<T[]>,
  columns: MaybeRefOrGetter<SortColumn<T>[]>,
  options: CatalogSortOptions = {},
) {
  // 仅在需要同步时才注入路由：本 composable 也用于无路由环境（单测直接调用）
  const route = options.syncRoute ? useRoute() : null
  const router = options.syncRoute ? useRouter() : null
  const defaultKey = options.defaultKey ?? null
  const defaultDir = options.defaultDir ?? 'asc'

  /** 初始化：从 URL 读排序（键须在 columns 中、方向须合法），并报告参数是否非法 */
  function fromQuery(): { key: string | null; dir: SortDir; dirty: boolean } {
    if (!options.syncRoute || !route) return { key: defaultKey, dir: defaultDir, dirty: false }
    const rawKey = route.query.sort
    const rawDir = route.query.dir
    const validKey =
      typeof rawKey === 'string' && toValue(columns).some((c) => c.key === rawKey) ? rawKey : null
    const dirty =
      (rawKey !== undefined && validKey === null) ||
      (rawDir !== undefined && rawDir !== 'asc' && rawDir !== 'desc')
    const dir: SortDir = rawDir === 'desc' ? 'desc' : 'asc'
    return { key: validKey ?? defaultKey, dir: validKey ? dir : defaultDir, dirty }
  }

  const initial = fromQuery()
  const sortKey = ref<string | null>(initial.key)
  const sortDir = ref<SortDir>(initial.dir)

  /** 是否处于默认排序（「复制此视图链接」的显隐依据之一） */
  const isDefault = computed(() => sortKey.value === defaultKey && sortDir.value === defaultDir)

  if (options.syncRoute && route && router) {
    if (initial.dirty) {
      const q = { ...route.query }
      delete q.sort
      delete q.dir
      void router.replace({ query: q })
    }

    watch([sortKey, sortDir], () => {
      const q = { ...route.query }
      if (isDefault.value) {
        if (q.sort === undefined && q.dir === undefined) return
        delete q.sort
        delete q.dir
      } else {
        if (String(q.sort) === String(sortKey.value) && String(q.dir) === sortDir.value) return
        if (sortKey.value) q.sort = sortKey.value
        q.dir = sortDir.value
      }
      void router.replace({ query: q })
    })
  }

  /** 点击列头：新键→升序；同键升序→降序；同键降序→**回到默认**（档案自然序）。
   *  第三态是必要的：默认键（如 id）没有表头，纯两态循环永远回不到默认顺序
   *  ——「排了序就回不去」是真实缺口（2026-10 补）。 */
  function toggle(key: string) {
    if (sortKey.value !== key) {
      sortKey.value = key
      sortDir.value = 'asc'
    } else if (sortDir.value === 'asc') {
      sortDir.value = 'desc'
    } else {
      sortKey.value = defaultKey
      sortDir.value = defaultDir
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

  return { sortKey, sortDir, sorted, toggle, dirFor, isDefault }
}

export type { Ref }
