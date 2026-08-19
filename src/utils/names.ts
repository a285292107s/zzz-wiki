/* ============================================================
 * 本地化名称回退 — 唯一实现（DESIGN.md P0：合并 api.locName / text.pickName）。
 * 名录条目携带四语字段（zh/en/ja/ko）+ 代号（code/codename），
 * 按 zh → en → ja → ko → code → codename 顺序取第一个非空字符串。
 * 纯函数，可单测。
 * ============================================================ */

const NAME_FALLBACK_ORDER = ['zh', 'en', 'ja', 'ko', 'code', 'codename'] as const

/** 取条目的本地化显示名；全部缺失时返回 '—'。 */
export function pickName(
  item: Record<string, unknown> | null | undefined,
): string {
  if (!item) return '—'
  for (const key of NAME_FALLBACK_ORDER) {
    const v = item[key]
    if (typeof v === 'string' && v.length) return v
  }
  return '—'
}
