/* ============================================================
 * useCompareBench — 对照台内容（模块级单例 + localStorage 持久化）
 *
 * 语义约定（先写清楚，免得用起来才发现歧义）：
 *   · **只允许同类目对照**：跨类目字段不同，硬凑会得到一堆「—」。故从另一个类目
 *     加入条目时**清空并重开**一桌（而不是拒绝——拒绝会让用户困惑「为什么加不进去」）
 *   · **上限 3 条**（MAX_COMPARE）：再多就失去并排可比的意义，窄屏尤其
 *   · 重复加入同一条目 = 无操作（不报错、不重复占位）
 *   · 持久化到 localStorage：跨页面、跨会话保留（与「最近访问」同一层考虑）
 *   · 损坏的存档一律丢弃（不因坏数据让站点崩）
 * ============================================================ */

import { computed, ref } from 'vue'
import { MAX_COMPARE } from '@/domain/compare'

const STORAGE_KEY = 'zzz-wiki:compare'

interface BenchState {
  catPath: string
  ids: number[]
}

function load(): BenchState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as BenchState
    if (!parsed || typeof parsed.catPath !== 'string' || !Array.isArray(parsed.ids)) return null
    const ids = parsed.ids.filter((n) => Number.isFinite(Number(n))).map(Number).slice(0, MAX_COMPARE)
    if (!ids.length) return null
    return { catPath: parsed.catPath, ids }
  } catch {
    return null // 存档损坏 → 当作空桌
  }
}

/** 模块级单例：全站共用一桌（顶栏提示与对照页读同一份状态） */
const bench = ref<BenchState | null>(load())

function persist(): void {
  try {
    if (!bench.value) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(bench.value))
  } catch {
    /* 隐私模式等写入失败：内存态照常工作，仅不持久化 */
  }
}

export type AddResult = 'added' | 'exists' | 'full' | 'replaced'

export function useCompareBench() {
  const ids = computed(() => bench.value?.ids ?? [])
  const catPath = computed(() => bench.value?.catPath ?? null)
  const count = computed(() => ids.value.length)
  const isFull = computed(() => count.value >= MAX_COMPARE)
  const isEmpty = computed(() => count.value === 0)

  /** 加入对照：同类目追加（去重、限流）；跨类目重开一桌 */
  function add(cat: string, id: number): AddResult {
    const cur = bench.value
    if (cur && cur.catPath !== cat) {
      bench.value = { catPath: cat, ids: [id] }
      persist()
      return 'replaced'
    }
    if (!cur) {
      bench.value = { catPath: cat, ids: [id] }
      persist()
      return 'added'
    }
    if (cur.ids.includes(id)) return 'exists'
    if (cur.ids.length >= MAX_COMPARE) return 'full'
    bench.value = { catPath: cur.catPath, ids: [...cur.ids, id] }
    persist()
    return 'added'
  }

  function remove(id: number): void {
    const cur = bench.value
    if (!cur) return
    const next = cur.ids.filter((x) => x !== id)
    bench.value = next.length ? { catPath: cur.catPath, ids: next } : null
    persist()
  }

  function clear(): void {
    bench.value = null
    persist()
  }

  const has = (id: number) => ids.value.includes(id)

  return { ids, catPath, count, isFull, isEmpty, add, remove, clear, has }
}

/** 测试/调试用：重置内存态（不写存储） */
export function __resetCompareBench(): void {
  bench.value = null
}
