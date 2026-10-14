/* ============================================================
 * useQuickSearch — 全局快速检索状态机（Ctrl/⌘+K 命令面板）
 *
 * - 索引懒构建：首次唤起面板才拉四份名录 JSON（api 层缓存归一，
 *   名录页/首页已拉过的直接命中），构建一次模块级复用
 * - 状态机：closed → loading（索引构建中）→ open
 * - 检索走 domain/search 的纯函数（normalizeQuery / searchEntries）
 * ============================================================ */

import { computed, ref, type ComputedRef } from 'vue'
import { CATALOG, HIDDEN_ITEM_IDS } from '@/domain/catalog'
import { DEFAULT_LANG, LANGS, type Lang } from '@/domain/lang'
import { buildSearchIndex, searchEntries, type SearchEntry } from '@/domain/search'
import { iconSources } from '@/data/icons'
import { listFor } from '@/data/resources'
import { useLocale } from './useLocale'

export type QuickSearchPhase = 'closed' | 'loading' | 'open'

/** 当前展示语言（模块级单例，与组件里读到的是同一份）。最近访问的标签按语言记账要用它。 */
const { lang } = useLocale()

const phase = ref<QuickSearchPhase>('closed')
const query = ref('')

/** 模块级单例：**按语言各构建一次**（名录 JSON 体积 ~40KB gz 总量，首次唤起 ~100ms）。
 *  匹配面（hay）四语合并、与语言无关，随语言变的只有展示名 label，
 *  故切语言后重开的索引只改 label——名录与详情走 api 层缓存，重建近乎零成本。 */
const indexPromises = new Map<Lang, Promise<SearchEntry[]>>()
const index = ref<SearchEntry[]>([])

/** catalog.listFile → 图标类目（icons.ts 候选链的 category 参数） */
const CAT_TO_ICON: Record<string, Parameters<typeof iconSources>[1]> = {
  character: 'character',
  weapon: 'weapon',
  bangboo: 'bangboo',
  equipment: 'disc',
}

/** 已派生名录用小图的类目（`{cat}/thumb/`）——检索面板行图标同样只用小尺寸展示 */
const THUMB_CATS = new Set(['weapon', 'bangboo'])

function buildIndex(lang: Lang): Promise<SearchEntry[]> {
  let p = indexPromises.get(lang)
  if (!p) {
    p = (async () => {
      const groups = await Promise.all(
        CATALOG.map(async (c) => {
          // 策展过滤与名录页同一份（HIDDEN_ITEM_IDS）：索引不收录名录中隐藏的条目
          const hidden = HIDDEN_ITEM_IDS.get(c.path)
          const all = (await listFor<Record<string, unknown>>(c, lang)) as Record<string, unknown>[]
          return {
            catPath: c.path,
            rows: hidden ? all.filter((row) => !hidden.has(Number(row.Id))) : all,
            // 小图标类目走 thumb 变体（仅当该目录确有派生图；其余不传，避免 404 候选）
            iconSrcs: (row: Record<string, unknown>) =>
              iconSources(
                { Id: Number(row.Id), icon: row.icon as string },
                CAT_TO_ICON[c.listFile],
                THUMB_CATS.has(c.listFile) ? 'thumb' : undefined,
              ),
          }
        }),
      )
      return buildSearchIndex(groups, lang)
    })()
    // 失败不缓存失败态：调用方 catch 后清掉，下次唤起重试
    p.catch(() => indexPromises.delete(lang))
    indexPromises.set(lang, p)
  }
  return p
}

/** 面板开启入口：closed/loading → open；索引并行构建。
 *  seed：唤起时预填的检索词（名录页把已输入的搜索词带进来——
 *  用户心智：同一目标换更强的工具继续找）。 */
export function useQuickSearch() {
  const loading = ref(false)
  // 面板里的展示名取当前语言；唤起时按当前语言建索引（见 buildIndex）。
  // `lang` 用模块级那一份（第 21 行），此处不再解构一次——两处同名会让读者以为有两个语言源。

  function open(seed?: string): void {
    if (phase.value !== 'closed') return
    if (seed?.trim()) query.value = seed.trim()
    phase.value = 'loading'
    loading.value = true
    void buildIndex(lang.value)
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

  function toggle(seed?: string): void {
    phase.value === 'closed' ? open(seed) : close()
  }

  return { phase, query, loading, open, close, toggle }
}

/** 结果列表（面板组件用）：已过滤 + 高亮词 */
/** 结果上限：检索面向四语+编号，宽查询（如「布」命中 42 邦布）仍可完整陈列；
 *  上限只拦「泛查询淹没」——超出时行首提示精确化建议（结果态脚注）。 */
const RESULTS_MAX = 60

export function useQuickSearchResults() {
  const all = computed(() => searchEntries(index.value, query.value))
  const results = computed(() => all.value.slice(0, RESULTS_MAX))
  const overflow = computed(() => all.value.length - results.value.length)
  return { results, overflow }
}

/* ---------- 最近访问档案 ---------- */

const RECENT_KEY = 'zzz-wiki:recent-items'
const RECENT_MAX = 6

/**
 * 一条最近访问。
 *
 * `labels` 是**逐语言**的记录（不是单串）：名字是随语言解析出来的，若只存访问当时那一种，
 * 读者切换展示语言后这条会一直显示旧语言的名字（且写进 localStorage，刷新也不消失）。
 * 故按语言分别记，渲染时取当前语言；都没有时退回任一已记语言，再退回路由尾号。
 *
 * 兼容旧存档：早期只有 `label: string`。loadRecent 把它折算成 `labels` 后即写回新结构。
 */
interface RecentItem {
  to: string
  catNo: string
  labels: Partial<Record<Lang, string>>
  /** 旧存档字段（仅读取兼容用，不再写出） */
  label?: string
}

/** 把任意存档形态折算成带 `labels` 的记录；非法条目返回 null。 */
function normalizeRecent(x: unknown): RecentItem | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  if (typeof o.to !== 'string') return null
  const labels: Partial<Record<Lang, string>> = {}
  if (o.labels && typeof o.labels === 'object') {
    for (const l of LANGS) {
      const v = (o.labels as Record<string, unknown>)[l]
      if (typeof v === 'string' && v) labels[l] = v
    }
  }
  if (typeof o.label === 'string' && o.label) {
    // 旧存档不知道是哪一语言；记为默认语言，切到别的语言时按下面的回退序兜住
    labels[DEFAULT_LANG] ??= o.label
  }
  return { to: o.to, catNo: String(o.catNo ?? ''), labels }
}

function loadRecent(): RecentItem[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    const arr = raw ? (JSON.parse(raw) as unknown[]) : []
    return Array.isArray(arr) ? arr.map(normalizeRecent).filter((x): x is RecentItem => x !== null) : []
  } catch {
    return []
  }
}

const recent = ref<RecentItem[]>(loadRecent())

/** 记录一次档案访问（去重置顶、上限裁剪、持久化）。面板空查询时先陈列历史。 */
export function recordRecentVisit(catNo: string, to: string, label: string): void {
  if (!to || !label) return
  const prev = recent.value.find((x) => x.to === to)
  // 同一档案重复访问：保留已记的其他语言名，只补/更新当前语言那一条
  const labels: Partial<Record<Lang, string>> = { ...prev?.labels, [lang.value]: label }
  recent.value = [{ to, catNo, labels }, ...recent.value.filter((x) => x.to !== to)].slice(0, RECENT_MAX)
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.value))
  } catch {
    /* 隐私模式等不可写场景静默 */
  }
}

/** 面板组件用：最近访问列表。`label` 按**当前语言**解析，随语言切换自动变。
 *
 *  名字**以当前语言的检索索引为准**（索引本身就是按语言构建、条目齐全的单一事实源）：
 *  只存「访问当时那一语言」的名字是不够的——读者切到 en 后，一条只在 zh 访问过的档案
 *  仍然只有中文名可显示。故先回索引重查（同一 `to`），索引里没有才退回逐语言存档值，
 *  最后退回路由尾号。索引在面板 open() 前已 await 建好，此处读到的是当前语言那份。 */
export function useRecentItems(): ComputedRef<Array<{ to: string; catNo: string; label: string }>> {
  return computed(() => {
    const byRoute = new Map(index.value.map((e) => [e.to, e.label]))
    return recent.value.map((r) => ({
      to: r.to,
      catNo: r.catNo,
      label:
        byRoute.get(r.to) ??
        r.labels[lang.value] ??
        LANGS.map((l) => r.labels[l]).find((v): v is string => Boolean(v)) ??
        r.to.split('/').pop() ??
        '',
    }))
  })
}
