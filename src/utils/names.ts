/* ============================================================
 * 本地化名称回退 — 唯一实现（DESIGN.md P0：合并 api.locName / text.pickName）。
 * 名录条目携带四语字段（zh/en/ja/ko）+ 代号（code/codename）。
 *
 * 多语言（2026-10）：回退**从当前语言起**，再到其余语言（按 domain/lang 的 LANGS 次序），
 * 最后才落到语言无关的代号。故：
 *   - 缺当前语言译文时，借另一种语言的名字**总好过显示代号或空**
 *   - 语言无关的 `code` / `codename` 永远排在所有语言之后（它们是标识符，不是译名）
 * pickName(item) 不传语言时等价于默认语言（zh），与历史行为逐字一致。
 *
 * 纯函数，可单测。
 * ============================================================ */

import { DEFAULT_LANG, LANGS, type Lang } from '@/domain/lang'

/** 语言无关的兜底字段（标识符，不是译名） */
const IDENTIFIER_FALLBACK = ['code', 'codename'] as const

/** 回退序按语言缓存：名录排序会比较上万次，避免每次调用都重建数组 */
const ORDER_CACHE = new Map<Lang, readonly string[]>()

function orderFor(lang: Lang): readonly string[] {
  let order = ORDER_CACHE.get(lang)
  if (!order) {
    order = [lang, ...LANGS.filter((l) => l !== lang), ...IDENTIFIER_FALLBACK]
    ORDER_CACHE.set(lang, order)
  }
  return order
}

/** 取条目的本地化显示名；全部缺失时返回 '—'。 */
export function pickName(
  item: Record<string, unknown> | null | undefined,
  lang: Lang = DEFAULT_LANG,
): string {
  if (!item) return '—'
  for (const key of orderFor(lang)) {
    const name = fieldName(item[key])
    if (name) return name
  }
  return '—'
}

/**
 * 字段值 → 名字字符串。两种形态都收：
 *   - 名字字符串（角色/音擎/邦布名录的 zh/en/ja/ko）
 *   - `{ name, … }` 子对象（驱动盘名录的 zh/en/ja/ko，契约见 domain/schema 的 LocaleInfoSchema）
 * 故「取名」这件事只有本函数一处实现——检索索引的名称面也用它。
 */
export function fieldName(value: unknown): string {
  if (typeof value === 'string') return value
  if (value !== null && typeof value === 'object') {
    const name = (value as Record<string, unknown>).name
    if (typeof name === 'string') return name
  }
  return ''
}

/**
 * 取条目的本地化**子对象**（驱动盘名录的 desc2 / desc4 这类字段只在这里）；
 * 缺失时返回 null。回退序与 pickName 同一份（当前语言 → 其余语言）。
 */
export function pickLocaleInfo<T extends Record<string, unknown>>(
  item: Record<string, unknown> | null | undefined,
  lang: Lang = DEFAULT_LANG,
): T | null {
  if (!item) return null
  for (const key of orderFor(lang)) {
    const v = item[key]
    if (v !== null && typeof v === 'object') return v as T
  }
  return null
}
