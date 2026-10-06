/* ============================================================
 * domain/compare.ts — 对照台（把同类目条目并排比对）
 *
 * 为什么做这个：本站是数据档案，用户最常见的真实任务是「在两条档案之间做取舍」
 * （谁的攻击更高、属性是否克制、阵营是否同源）。列表页能排序、能筛选，但**不能并排看**。
 * 对照台是**档案原生**的交互——不加动效、不加装饰，只把数据摆到一起并把差异点出来。
 *
 * 分层：本模块是纯函数（不依赖 Vue / api），便于单测与复用。
 * 约束：**只允许同类目对照**（不同类目字段不同，硬凑会得到一堆「—」）。
 * ============================================================ */

import { ELEMENTS, HIT_TYPES, PROFESSIONS, RANK_TO_TIER } from '@/domain/enums'

/** 同时对照的上限：再多就失去「并排可比」的意义（窄屏尤其） */
export const MAX_COMPARE = 3

export interface CompareFieldSpec {
  /** 列表 JSON 里的字段名 */
  key: string
  label: string
}

/** 各类目的对照字段（键名来自名录 JSON；标签面向阅读） */
const FIELD_SPEC: Record<string, CompareFieldSpec[]> = {
  '/agents': [
    { key: 'rank', label: '稀有度' },
    { key: 'element', label: '属性' },
    { key: 'type', label: '职业' },
    { key: 'hit', label: '攻击方式' },
    { key: 'camp_name', label: '阵营' },
  ],
  '/w-engines': [
    { key: 'rank', label: '稀有度' },
    { key: 'type', label: '类型' },
    { key: 'atk', label: '攻击力' },
    { key: 'sub', label: '副词条' },
  ],
  '/bangboos': [
    { key: 'rank', label: '稀有度' },
    { key: 'codename', label: '代号' },
  ],
  '/disks': [
    { key: 'rank', label: '稀有度' },
  ],
}

export function compareFields(catPath: string): CompareFieldSpec[] {
  return FIELD_SPEC[catPath] ?? []
}

/** 枚举解码：数字码 → 中文名（未知码原样显示，便于发现数据异常） */
function decodeEnum(map: Record<number, { zh: string }>, v: unknown): string {
  const n = Number(v)
  if (!Number.isFinite(n)) return String(v ?? '')
  return map[n]?.zh ?? String(n)
}

/** 单字段取值：空值统一为 '—'（对照表里空位必须可见，不能留白） */
export function formatField(catPath: string, key: string, row: Record<string, unknown>): string {
  const v = row[key]
  if (v === undefined || v === null || v === '') return '—'
  // 稀有度：与名录页同一口径（rank 是内部等级 2/3/4，展示为 B/A/S）。
  // 对照表若直接显示 3/4，用户会把它读成「三档/四档」，与名录的 S/A 对不上。
  if (key === 'rank') {
    const tier = RANK_TO_TIER[Number(v)]
    return tier ?? String(v)
  }
  if (catPath === '/agents') {
    if (key === 'element') return decodeEnum(ELEMENTS, v)
    if (key === 'type') return decodeEnum(PROFESSIONS, v)
    if (key === 'hit') return decodeEnum(HIT_TYPES, v)
  }
  if (typeof v === 'object') {
    // 驱动盘 zh 为 { name } 形态（与检索域同一处理）
    const name = (v as Record<string, unknown>).name
    return typeof name === 'string' && name ? name : '—'
  }
  return String(v)
}

export interface CompareEntryInput {
  id: number
  /** 展示名（已由调用方按 pickName 规则取好） */
  label: string
  /** 档案编号（展示位次，如 '002'） */
  no: string
  /** 详情路由 */
  to: string
  /** 图标候选 */
  srcs: string[]
  /** 名录原始行 */
  data: Record<string, unknown>
}

export interface CompareRow {
  label: string
  /** 与 columns 等长 */
  cells: string[]
  /** 该行是否存在差异（全同则不高亮——把注意力留给真正的差别） */
  differs: boolean
}

export interface CompareModel {
  columns: Array<{ id: number; label: string; no: string; to: string; srcs: string[] }>
  rows: CompareRow[]
  /** 有差异的行数（页头摘要用） */
  diffCount: number
}

/** 构建对照模型：行 = 字段，列 = 条目；逐行判定是否有差异 */
export function buildComparison(catPath: string, entries: CompareEntryInput[]): CompareModel {
  const fields = compareFields(catPath)
  const columns = entries.map((e) => ({ id: e.id, label: e.label, no: e.no, to: e.to, srcs: e.srcs }))
  const rows: CompareRow[] = fields.map((f) => {
    const cells = entries.map((e) => formatField(catPath, f.key, e.data))
    // 差异判定用「归一后」比较：空白折叠 + 大小写无关，避免 'S ' 与 's' 被当成差异
    const norm = cells.map((c) => c.replace(/\s+/g, ' ').trim().toLowerCase())
    const differs = new Set(norm).size > 1
    return { label: f.label, cells, differs }
  })
  return { columns, rows, diffCount: rows.filter((r) => r.differs).length }
}
