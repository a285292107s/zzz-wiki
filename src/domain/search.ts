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

/** 字符串或 {name} 对象 → 名字字符串（equipment 的 zh 为对象形态） */
function takeName(v: unknown): string {
  if (typeof v === 'string') return v
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    if (typeof o.name === 'string') return o.name
  }
  return ''
}

/** 名称提取：回退序 zh → en → ja → ko → code → codename → Id（与 pickName 同序） */
function extractLabel(row: Record<string, unknown>): string {
  return (
    takeName(row.zh) ||
    takeName(row.en) ||
    takeName(row.ja) ||
    takeName(row.ko) ||
    (typeof row.code === 'string' ? row.code : '') ||
    (typeof row.codename === 'string' ? row.codename : '') ||
    String(row.Id ?? '')
  )
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
      const label = extractLabel(row)
      const hay = normalize(
        [row.zh, row.en, row.ja, row.ko, row.code, row.codename, String(id)].map(takeName).filter(Boolean).join(' '),
      )
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

/**
 * 关键词高亮：把 label 中与查询词命中的片段包上 <mark>（终端「命中标记」语义）。
 * 归一匹配（大小写/全半角）+ 原文定位：逐字符比对归一化投影，保证 CJK/全角不漏标。
 * 返回分段数组（hit 布尔标记），由视图渲染为文本/标记交替，不经 v-html（XSS 面 = 0）。
 */
export function highlightSegments(
  label: string,
  query: string,
): Array<{ text: string; hit: boolean }> {
  const words = normalizeQuery(query).split(' ').filter(Boolean)
  if (!words.length) return [{ text: label, hit: false }]

  // 归一化投影：norm[i] = 归一化后字符，map[i] = 原文下标（跳过空白折叠与全角差）
  const normChars: string[] = []
  const map: number[] = []
  for (let i = 0; i < label.length; i++) {
    const ch = label[i]
    let n = ch.toLowerCase()
    if (ch.charCodeAt(0) >= 0xff01 && ch.charCodeAt(0) <= 0xff5e) {
      n = String.fromCharCode(ch.charCodeAt(0) - 0xfee0).toLowerCase()
    }
    if (/\s/.test(n)) {
      // 连续空白折叠为一个空格
      if (normChars[normChars.length - 1] !== ' ') {
        normChars.push(' ')
        map.push(i)
      }
      continue
    }
    normChars.push(n)
    map.push(i)
  }
  const norm = normChars.join('')

  const hitAt = new Array<boolean>(label.length).fill(false)
  let matchedAll = true
  for (const w of words) {
    const at = norm.indexOf(w)
    if (at === -1) {
      matchedAll = false
      continue
    }
    for (let i = at; i < at + w.length; i++) hitAt[map[i]] = true
  }
  if (!matchedAll) return [{ text: label, hit: false }]

  const segs: Array<{ text: string; hit: boolean }> = []
  let buf = ''
  let cur = hitAt[0] ?? false
  for (let i = 0; i < label.length; i++) {
    if (hitAt[i] === cur) buf += label[i]
    else {
      segs.push({ text: buf, hit: cur })
      buf = label[i]
      cur = hitAt[i]
    }
  }
  if (buf) segs.push({ text: buf, hit: cur })
  return segs
}
