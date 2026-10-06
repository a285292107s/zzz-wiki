/* ============================================================
 * domain/search.ts — 全局快速检索索引（纯函数，可单测）
 *
 * 索引源 = 四类目名录（agent/weapon/bangboo/disk 统一为档案条目）：
 *   - 匹配面：名称（四语合并）+ 档案编号（Id）+ 阵营名（agent）
 *   - 排序：类目序（catalog no）→ Id 升序，与名录页排序语义一致
 *
 * 检索语义：
 *   - 大小写不敏感、全半角无关（全角数字/字母归一）
 *   - 空查询 = 快速入口（返回全部，由 UI 分组陈列）
 *   - 多词 AND：词序无关，每词必须命中同一档案
 * ============================================================ */

export interface SearchEntry {
  /** 详情路由（'/{base}/{id}'） */
  to: string
  /** 类目路径（'/agents' …），UI 分组与徽标用 */
  catPath: string
  /** 档案编号（Id 展示，如 '014'） */
  no: string
  /** 主名（pickName 结果） */
  label: string
  /** 四语合并串（小写，检索用） */
  hay: string
  /** 图标候选 */
  srcs: string[]
}

/** 全半角归一：全角数字/字母/符号 → 半角小写 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeQuery(q: string): string {
  return normalize(q)
}

export function buildSearchIndex(
  groups: Array<{
    catPath: string
    rows: Array<Record<string, unknown>>
    iconSrcs: (row: Record<string, unknown>) => string[]
  }>,
): SearchEntry[] {
  const out: SearchEntry[] = []
  for (const g of groups) {
    for (const row of g.rows) {
      const id = Number(row.Id)
      if (!Number.isFinite(id)) continue
      const label =
        (row.zh as string) || (row.en as string) || (row.ja as string) || (row.ko as string) || (row.code as string) || (row.codename as string) || String(id)
      const hay = normalize([row.zh, row.en, row.ja, row.ko, row.code, row.codename, String(id)].filter(Boolean).join(' '))
      out.push({
        to: `${g.catPath}/${id}`,
        catPath: g.catPath,
        no: String(id).padStart(3, '0'),
        label,
        hay,
        srcs: g.iconSrcs(row),
      })
    }
  }
  return out
}

/** 多词 AND 检索：词序无关；命中返回条目，否则过滤掉 */
export function searchEntries(entries: SearchEntry[], query: string): SearchEntry[] {
  const q = normalizeQuery(query)
  if (!q) return entries
  const words = q.split(' ').filter(Boolean)
  return entries.filter((e) => words.every((w) => e.hay.includes(w)))
}
