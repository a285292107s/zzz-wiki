/* ============================================================
 * useCatalogList — 列表筛选/搜索/计数（DESIGN.md §6.1）。
 * 把 AgentsView 手写的 filtered 计算逻辑通用化；各列表页只需
 * 声明是否启用属性/职业筛选与名称函数。
 * ============================================================ */

import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { pickName } from '@/utils/names'
import type { AttrCode, SpecCode } from '@/domain/enums'

export type AttrFilter = 'all' | AttrCode
export type ProfFilter = 'all' | SpecCode

export interface CatalogListOptions<T> {
  /** 条目源：Ref 或返回数组的函数（函数会被 computed 包装） */
  items: Ref<T[]> | (() => T[])
  /** 搜索名称函数（默认 pickName：zh→en→ja→ko→code→codename） */
  name?: (item: T) => string
  /** 启用属性筛选（默认 false；代理人列表用） */
  withAttrs?: boolean
  /** 启用职业筛选（默认 false） */
  withProfs?: boolean
  /** 是否支持空查询返回全部（默认 true） */
  skipEmptyQuery?: boolean
}

export function useCatalogList<T extends Record<string, unknown>>(
  opts: CatalogListOptions<T>,
) {
  const items: Ref<T[]> =
    typeof opts.items === 'function' ? computed(opts.items) : opts.items

  const attrFilter = ref<AttrFilter>('all')
  const profFilter = ref<ProfFilter>('all')
  const query = ref('')
  const nameOf = opts.name ?? ((x: T) => pickName(x))

  const withAttrs = opts.withAttrs ?? false
  const withProfs = opts.withProfs ?? false
  const skipEmptyQuery = opts.skipEmptyQuery ?? true

  const filtered = computed<T[]>(() => {
    let list = items.value
    if (withAttrs && attrFilter.value !== 'all') {
      list = list.filter((i) => i.element === attrFilter.value)
    }
    if (withProfs && profFilter.value !== 'all') {
      list = list.filter((i) => i.type === profFilter.value)
    }
    const q = query.value.trim().toLowerCase()
    if (q || !skipEmptyQuery) {
      list = list.filter((i) => nameOf(i).toLowerCase().includes(q))
    }
    return list
  })

  const count = computed(() => filtered.value.length)

  return { attrFilter, profFilter, query, filtered, count, nameOf }
}

export type { ComputedRef }
