/* ============================================================
 * useCatalogList — 列表筛选/搜索/计数（DESIGN.md §6.1）。
 * 把 AgentsView 手写的 filtered 计算逻辑通用化；各列表页只需
 * 声明是否启用属性/职业筛选与名称函数。
 *
 * syncRoute（Q1a）：开启后筛选/搜索状态与 URL query 双向同步——
 *   - 刷新 / 复制链接 / 前进后退均可恢复筛选条件；
 *   - 状态变化时写回 query（router.replace），不产生历史记录噪声。
 * ============================================================ */

import { computed, ref, watch, watchEffect, type ComputedRef, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { pickName } from '@/utils/names'
import type { AttrCode, SpecCode } from '@/domain/enums'

export type AttrFilter = 'all' | AttrCode
export type ProfFilter = 'all' | SpecCode
export type CampFilter = 'all' | number

export interface CatalogListOptions<T> {
  /** 条目源：Ref 或返回数组的函数（函数会被 computed 包装） */
  items: Ref<T[]> | (() => T[])
  /** 搜索名称函数（默认 pickName：zh→en→ja→ko→code→codename） */
  name?: (item: T) => string
  /** 附加关键词字段（Q2b）：返回 [] 之外的可搜索文本，与名称合并匹配 */
  keywords?: (item: T) => string[]
  /** 启用属性筛选（默认 false；代理人列表用） */
  withAttrs?: boolean
  /** 启用职业筛选（默认 false） */
  withProfs?: boolean
  /** 启用阵营筛选（默认 false；阵营码为动态数据，见 withCamps） */
  withCamps?: boolean
  /** 是否支持空查询返回全部（默认 true） */
  skipEmptyQuery?: boolean
  /** 是否与 URL query 双向同步（默认 false；每页只应启用一次） */
  syncRoute?: boolean
  /** URL query 的键名（仅在 syncRoute 时生效），默认 q/attr/prof/camp */
  queryKeys?: { q?: string; attr?: string; prof?: string; camp?: string }
}

type Filter = 'all' | number

/** 合法属性/职业数值码（与 domain/enums 同源） */
const ATTR_CODES: readonly number[] = [200, 201, 202, 203, 204, 205, 300]
const SPEC_CODES: readonly number[] = [1, 2, 3, 4, 5, 6, 7]

function parseFilter(raw: string | null, allowed: readonly number[]): Filter {
  if (!raw || raw === 'all') return 'all'
  const n = Number(raw)
  return allowed.includes(n) ? n : 'all'
}

/** 阵营码是动态数据，无法预置白名单：仅接受正整数，非法回退到 all。 */
function parseCampFilter(raw: string | null): Filter {
  if (!raw || raw === 'all') return 'all'
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : 'all'
}

export function useCatalogList<T extends Record<string, unknown>>(
  opts: CatalogListOptions<T>,
) {
  const items: Ref<T[]> =
    typeof opts.items === 'function' ? computed(opts.items) : opts.items

  const attrFilter = ref<AttrFilter>('all')
  const profFilter = ref<ProfFilter>('all')
  const campFilter = ref<CampFilter>('all')
  const query = ref('')
  const nameOf = opts.name ?? ((x: T) => pickName(x))
  const keywordsOf = opts.keywords ?? (() => [])

  const withAttrs = opts.withAttrs ?? false
  const withProfs = opts.withProfs ?? false
  const withCamps = opts.withCamps ?? false
  const skipEmptyQuery = opts.skipEmptyQuery ?? true

  /* ---------- URL query 双向同步（Q1a） ---------- */

  if (opts.syncRoute) {
    const route = useRoute()
    const router = useRouter()
    const keys = {
      q: opts.queryKeys?.q ?? 'q',
      attr: opts.queryKeys?.attr ?? 'attr',
      prof: opts.queryKeys?.prof ?? 'prof',
      camp: opts.queryKeys?.camp ?? 'camp',
    }

    /** 正在从 URL 回写状态（抑制 refs→URL 的 echo） */
    let syncing = false

    // 状态变化 → 写回 query（replace，不压历史）
    watch(
      [query, attrFilter, profFilter, campFilter],
      ([q, attr, prof, camp]) => {
        if (syncing) return
        const next: Record<string, string> = {}
        if (q) next[keys.q] = q
        if (withAttrs && attr !== 'all') next[keys.attr] = String(attr)
        if (withProfs && prof !== 'all') next[keys.prof] = String(prof)
        if (withCamps && camp !== 'all') next[keys.camp] = String(camp)
        void router.replace({ query: next })
      },
      { flush: 'sync' },
    )

    // URL → 状态：初始读取 + 前进/后退/直接改地址时恢复
    watchEffect(() => {
      const q = String(route.query[keys.q] ?? '').trim()
      const a = withAttrs
        ? parseFilter(String(route.query[keys.attr] ?? ''), ATTR_CODES)
        : 'all'
      const p = withProfs
        ? parseFilter(String(route.query[keys.prof] ?? ''), SPEC_CODES)
        : 'all'
      const c = withCamps
        ? parseCampFilter(String(route.query[keys.camp] ?? ''))
        : 'all'
      syncing = true
      if (q !== query.value) query.value = q
      if (a !== attrFilter.value) attrFilter.value = a as AttrFilter
      if (p !== profFilter.value) profFilter.value = p as ProfFilter
      if (c !== campFilter.value) campFilter.value = c as CampFilter
      syncing = false
    })
  }

  /* ---------- 过滤 ---------- */

  const filtered = computed<T[]>(() => {
    let list = items.value
    if (withAttrs && attrFilter.value !== 'all') {
      list = list.filter((i) => i.element === attrFilter.value)
    }
    if (withProfs && profFilter.value !== 'all') {
      list = list.filter((i) => i.type === profFilter.value)
    }
    if (withCamps && campFilter.value !== 'all') {
      list = list.filter((i) => i.camp === campFilter.value)
    }
    const q = query.value.trim().toLowerCase()
    if (q || !skipEmptyQuery) {
      list = list.filter((i) => {
        if (nameOf(i).toLowerCase().includes(q)) return true
        return keywordsOf(i).some((k) => k.toLowerCase().includes(q))
      })
    }
    return list
  })

  const count = computed(() => filtered.value.length)

  return { attrFilter, profFilter, campFilter, query, filtered, count, nameOf }
}

export type { ComputedRef }
