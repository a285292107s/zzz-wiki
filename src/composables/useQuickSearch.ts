/* ============================================================
 * useQuickSearch — 全局快速检索状态机（Ctrl/⌘+K 命令面板）
 *
 * - 索引懒构建：首次唤起面板才拉四份名录 JSON（api 层缓存归一，
 *   名录页/首页已拉过的直接命中），构建一次模块级复用
 * - 状态机：closed → loading（索引构建中）→ open
 * - 检索走 domain/search 的纯函数（normalizeQuery / searchEntries）
 * ============================================================ */

import { computed, ref } from 'vue'
import { CATALOG, HIDDEN_ITEM_IDS } from '@/domain/catalog'
import { buildSearchIndex, normalizeQuery, searchEntries, type SearchEntry } from '@/domain/search'
import { iconSources } from '@/data/icons'
import { listFor } from '@/data/resources'

export type QuickSearchPhase = 'closed' | 'loading' | 'open'

const phase = ref<QuickSearchPhase>('closed')
const query = ref('')

/** 模块级单例：索引只构建一次（名录 JSON 体积 ~40KB gz 总量，首次唤起 ~100ms） */
let indexPromise: Promise<SearchEntry[]> | null = null
const index = ref<SearchEntry[]>([])

/** catalog.listFile → 图标类目（icons.ts 候选链的 category 参数） */
const CAT_TO_ICON: Record<string, Parameters<typeof iconSources>[1]> = {
  character: 'character',
  weapon: 'weapon',
  bangboo: 'bangboo',
  equipment: 'disc',
}

function buildIndex(): Promise<SearchEntry[]> {
  indexPromise ??= (async () => {
    const groups = await Promise.all(
      CATALOG.map(async (c) => {
        // 策展过滤与名录页同一份（HIDDEN_ITEM_IDS）：索引不收录名录中隐藏的条目
        const hidden = HIDDEN_ITEM_IDS.get(c.path)
        const all = (await listFor<Record<string, unknown>>(c)) as Record<string, unknown>[]
        return {
          catPath: c.path,
          rows: hidden ? all.filter((row) => !hidden.has(Number(row.Id))) : all,
          iconSrcs: (row: Record<string, unknown>) =>
            iconSources({ Id: Number(row.Id), icon: row.icon as string }, CAT_TO_ICON[c.listFile]),
        }
      }),
    )
    return buildSearchIndex(groups)
  })()
  return indexPromise
}

/** 面板开启入口：closed/loading → open；索引并行构建 */
export function useQuickSearch() {
  const loading = ref(false)

  function open(): void {
    if (phase.value !== 'closed') return
    phase.value = 'loading'
    loading.value = true
    void buildIndex()
      .then((idx) => {
        index.value = idx
        phase.value = 'open'
      })
      .catch(() => {
        // 索引失败退回关闭（面板无常开理由）；再次唤起重试
        phase.value = 'closed'
      })
      .finally(() => {
        loading.value = false
      })
  }

  function close(): void {
    phase.value = 'closed'
    query.value = ''
  }

  function toggle(): void {
    phase.value === 'closed' ? open() : close()
  }

  return { phase, query, loading, open, close, toggle }
}

/** 结果列表（面板组件用）：已过滤 + 高亮词 */
export function useQuickSearchResults() {
  const results = computed(() => searchEntries(index.value, query.value))
  const normQuery = computed(() => normalizeQuery(query.value))
  return { results, normQuery }
}

/** 供组件判定面板可见性（Teleport 到 body 的全局层） */
export function isQuickSearchVisible(): boolean {
  return phase.value !== 'closed'
}

/* ---------- 最近访问档案 ---------- */

const RECENT_KEY = 'zzz-wiki:recent-items'
const RECENT_MAX = 6

interface RecentItem {
  to: string
  label: string
  catNo: string
}

function loadRecent(): RecentItem[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    const arr = raw ? (JSON.parse(raw) as RecentItem[]) : []
    return Array.isArray(arr) ? arr.filter((x) => x && typeof x.to === 'string' && typeof x.label === 'string') : []
  } catch {
    return []
  }
}

const recent = ref<RecentItem[]>(loadRecent())

/** 记录一次档案访问（去重置顶、上限裁剪、持久化）。面板空查询时先陈列历史。 */
export function recordRecentVisit(catNo: string, to: string, label: string): void {
  if (!to || !label) return
  recent.value = [{ to, label, catNo }, ...recent.value.filter((x) => x.to !== to)].slice(0, RECENT_MAX)
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.value))
  } catch {
    /* 隐私模式等不可写场景静默 */
  }
}

/** 面板组件用：最近访问列表（只读） */
export function useRecentItems() {
  return recent
}
