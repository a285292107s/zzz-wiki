/* ============================================================
 * 详情页区块通用类型与纯函数 — 单一定义（DESIGN.md P2）。
 * AgentDetailView / WEngineDetailView 共用的行结构、网格项、
 * 技能槽位常量与字典→行转换。无 Vue 依赖，可单测。
 * ============================================================ */

/** 序号行（影画/精炼/技能描述共用） */
export interface DetailRow {
  no: number
  name?: string
  desc?: string
}

/** 技能详细倍率的单个数值条目（param.skillId 下的主值/成长/格式） */
export interface SkillParamEntry {
  main: number
  growth: number
  format?: string
}

/** 技能详细倍率的单个数值条目（param 数组中的一项）：公式模板 + 所需数值表 */
export interface SkillDetail {
  name: string
  formula: string
  /** 数值表：单层 {skillId: entry}（角色）或双层 {skillId: {propId: entry}}（邦布），与 evaluateSkillFormula 兼容 */
  props: Record<string, SkillParamEntry | Record<string, SkillParamEntry>>
  /** 由公式首个引用技能解析出的展示格式（如 '%'） */
  format?: string
  /** 静态文本条目（邦布：token 无 {Skill:} 引用），各级原文按序；存在时优先于公式求值 */
  values?: string[]
}

/**
 * 技能展示组：对应一个招式（如「普通攻击：狡兔连打」）。
 * 组 = 招式标题 + 说明文字(富文本) + 可选数值条目。
 * 说明文字与数值在 JSON 中分处「简单描述块」与「详细倍率块」，按 name 合并、按出现顺序排列。
 */
export interface SkillGroup {
  /** 招式名 */
  name: string
  /** 招式说明文字（富文本）；或是随所选等级变化的文本函数（邦布技能描述按级取）；纯数值组无文字时为 undefined */
  desc?: string | ((level: number) => string)
  /** 该招式下的数值条目；纯文本招式无数值时为 undefined */
  entries?: SkillDetail[]
}

/** 技能行（键位、中文名、有序展示组） */
export interface SkillRow {
  key: string
  zh: string
  keyEn: string
  groups?: SkillGroup[]
  /** 该技能是否存在数值条目（决定是否显示等级滑块） */
  hasNumbers: boolean
}

/** 技能等级范围：绝区零技能 1–12 级（成长公式 main + growth*(lv-1)） */
export const SKILL_LEVEL_MIN = 1
export const SKILL_LEVEL_MAX = 12
export const SKILL_LEVEL_DEFAULT = SKILL_LEVEL_MAX

/** KeyValueGrid 数值项 */
export interface StatItem {
  /** 标签（生命值/攻击力…） */
  label: string
  /** 显示值（已格式化） */
  value: string
  /** 可选角标（主属性/副属性） */
  tag?: string
}

/** 皮肤行（含缩略图资源名） */
export interface SkinRow {
  id: string
  name: string
  desc: string
  img: string
}

/** 将按键排序的字典（影画/精炼）转为 DetailRow[] */
export function dictToRows(
  dict: Record<string, unknown> | undefined | null,
): DetailRow[] {
  if (!dict) return []
  return Object.entries(dict)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([k, v]) => {
      const o = (v ?? {}) as { name?: string; desc?: string }
      return { no: Number(k), name: o.name, desc: o.desc }
    })
}

/* ---------- 技能槽位（角色详情） ---------- */

export const SKILL_ORDER = ['basic', 'dodge', 'special', 'chain', 'assist', 'core'] as const
export type SkillSlotKey = (typeof SKILL_ORDER)[number]


export const SKILL_ZH: Record<SkillSlotKey, string> = {
  basic: '普通攻击',
  dodge: '闪避',
  special: '特殊技',
  chain: '连携技',
  assist: '支援技',
  core: '核心技',
}

/** 技能键位纹章：排印几何符号 + 等宽键名（无图片依赖，与档案风格同构） */
export const SKILL_KEYS: Record<SkillSlotKey, { glyph: string; en: string }> = {
  basic: { glyph: '□', en: 'NORMAL' },
  dodge: { glyph: '◇', en: 'DODGE' },
  special: { glyph: '△', en: 'SPECIAL' },
  chain: { glyph: '✕', en: 'CHAIN' },
  assist: { glyph: '○', en: 'ASSIST' },
  core: { glyph: '◒', en: 'CORE' },
}

const SKILL_REF_RE = /\{Skill:(\d+),\s*Prop:\d+\}/

/** 转置分组用：同时捕获 Skill ID 与 Prop（Prop 为指标维度键） */
const SKILL_REF_FULL_RE = /\{Skill:(\d+),\s*Prop:(\d+)\}/

/** 详细倍率块内单个条目（含公式与数值表） */
type DetailParam = {
  name?: string
  desc?: string
  param?: Record<string, SkillParamEntry | undefined>
}

/**
 * description 数组里技能以「成对」出现：简单描述块（含真实 desc 文本）与详细/倍率块
 * （同名，含 param 数据、desc 为 {Skill:…} 占位符）。此函数把二者按 name 合并为有序
 * SkillGroup[]：说明文字取自同名简单块，数值取自详细块；纯文本招式只保留说明。
 */
function buildSkillGroups(
  descriptions?: Array<{ name?: string; desc?: string; param?: unknown }>,
): SkillGroup[] | undefined {
  if (!descriptions) return undefined
  /** 简单描述块的 name→desc 映射（说明文字源） */
  const descBy = new Map<string, string>()
  for (const block of descriptions) {
    if (block.param == null && typeof block.name === 'string' && typeof block.desc === 'string') {
      descBy.set(block.name, block.desc)
    }
  }
  /** 按 name 合并、保持首次出现顺序 */
  const groups: SkillGroup[] = []
  const indexBy = new Map<string, number>()
  for (const block of descriptions) {
    if (Array.isArray(block.param) && block.param.length) {
      // 详细倍率块：追加数值条目
      const entries: SkillDetail[] = []
      for (const p of block.param as DetailParam[]) {
        if (!p || typeof p.desc !== 'string') continue
        const props = (p.param ?? {}) as Record<string, SkillParamEntry>
        const firstId = p.desc.match(SKILL_REF_RE)?.[1]
        entries.push({
          name: p.name ?? block?.name ?? '',
          formula: p.desc,
          props,
          format: firstId ? props[firstId]?.format : undefined,
        })
      }
      if (!entries.length) continue
      const gname = block?.name ?? ''
      let gi = indexBy.get(gname)
      if (gi == null) {
        gi = groups.length
        indexBy.set(gname, gi)
        groups.push({ name: gname, desc: descBy.get(gname) })
      }
      const entryArr = groups[gi].entries ?? (groups[gi].entries = [])
      entryArr.push(...entries)
    } else if (block.param == null && typeof block?.name === 'string' && typeof block?.desc === 'string') {
      // 简单描述块：保留说明文字（若已被数值组占用则补上 desc）
      const gname = block.name
      const gi = indexBy.get(gname)
      if (gi != null) {
        if (groups[gi].desc == null) groups[gi].desc = block.desc
      } else {
        indexBy.set(gname, groups.length)
        groups.push({ name: gname, desc: block.desc })
      }
    }
  }
  return groups.length ? groups : undefined
}

/** 从角色详情的 skill 字典构建有序 SkillRow[]（按游戏 UI 顺序） */
export function buildSkillRows(
  skill: Record<string, unknown> | undefined | null,
): SkillRow[] {
  if (!skill) return []
  return SKILL_ORDER.filter((k) => skill[k] != null).map((k) => {
    const desc = (skill[k] as
      | { description?: Array<{ name?: string; desc?: string; param?: unknown }> }
      | undefined)?.description
    const groups = buildSkillGroups(desc)
    return {
      key: k,
      zh: SKILL_ZH[k] ?? k,
      keyEn: SKILL_KEYS[k]?.en ?? k.toUpperCase(),
      groups,
      hasNumbers: !!groups?.some((g) => g.entries?.length),
    }
  })
}

/* ---------- 技能详细倍率计算 ---------- */

/** 计算某个 skillId+Prop 在指定等级下的原始数值（未按 % 换算） */
export function skillParamValue(
  entry: SkillParamEntry | undefined,
  level: number,
): number {
  if (!entry) return 0
  return entry.main + entry.growth * (level - 1)
}

/**
 * 解析并求值详细倍率公式（含等级代入）。
 * 语法：整数、{Skill:ID, Prop:P} 数值占位、{…} 分组、()、+ - * /。
 * props：{skillId: entry} 单层（角色）或 {skillId: {propId: entry}} 双层（邦布）。
 * 例："{Skill:1031001, Prop:1001} + {{Skill:1031002, Prop:1001}/3}*3"
 */
export function evaluateSkillFormula(
  formula: string,
  props: Record<string, SkillParamEntry | Record<string, SkillParamEntry>>,
  level: number,
): number {
  let i = 0
  const text = formula

  function skipWs() {
    while (i < text.length && /\s/.test(text[i])) i++
  }
  function parseExpr(): number {
    let v = parseTerm()
    for (;;) {
      skipWs()
      const c = text[i]
      if (c === '+') { i++; v += parseTerm() }
      else if (c === '-') { i++; v -= parseTerm() }
      else return v
    }
  }
  function parseTerm(): number {
    let v = parseFactor()
    for (;;) {
      skipWs()
      const c = text[i]
      if (c === '*') { i++; v *= parseFactor() }
      else if (c === '/') { i++; v /= parseFactor() }
      else return v
    }
  }
  function parseFactor(): number {
    skipWs()
    const c = text[i]
    if (c === '{') {
      const end = findClose(text, i)
      const inner = text.slice(i + 1, end).trim()
      i = end + 1
      const ref = inner.match(/^Skill:(\d+),\s*Prop:(\d+)$/)
      if (ref) {
        // props 支持两层：{skillId: entry}（角色）或 {skillId: {propId: entry}}（邦布）
        const p = props[ref[1]] as SkillParamEntry | Record<string, SkillParamEntry> | undefined
        const entry =
          p != null && typeof p === 'object' && 'main' in (p as object)
            ? (p as SkillParamEntry)
            : (p as Record<string, SkillParamEntry> | undefined)?.[ref[2]]
        return skillParamValue(entry, level)
      }
      return evaluateSkillFormula(inner, props, level)
    }
    if (c === '(') {
      i++
      const v = parseExpr()
      skipWs()
      if (text[i] === ')') i++
      return v
    }
    if (c === '-') {
      i++
      return -parseFactor()
    }
    const m = text.slice(i).match(/^[0-9]+(\.[0-9]+)?/)
    if (!m) return 0
    i += m[0].length
    return Number(m[0])
  }
  return parseExpr()
}

function findClose(text: string, open: number): number {
  let depth = 0
  for (let j = open; j < text.length; j++) {
    if (text[j] === '{') depth++
    else if (text[j] === '}') {
      depth--
      if (depth === 0) return j
    }
  }
  return text.length
}

/** 按 format 输出展示字符串（% → 千分比/100；否则原值） */
export function formatSkillScalar(value: number, format?: string): string {
  if (format === '%') {
    let s = (value / 100).toFixed(1)
    if (s.endsWith('.0')) s = s.slice(0, -2)
    return `${s}%`
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

/** 详细行的最终展示值（代入所选等级后格式化） */
export function skillDetailValue(detail: SkillDetail, level: number): string {
  // 静态文本条目（邦布）：直接取该级原文，无公式求值
  if (detail.values?.length) {
    const L = Math.min(Math.max(level, 1), detail.values.length)
    return detail.values[L - 1] ?? '—'
  }
  return formatSkillScalar(evaluateSkillFormula(detail.formula, detail.props, level), detail.format)
}

/* ---------- 技能段×指标转置表 ---------- */

/** 段×指标转置表：行=共享 Skill 的段次，列=指标（Prop），值=该级展示串 */
export interface SkillMetricTable {
  /** 行标签列头（转置行标签为段名等，无统一列名时留空） */
  rowLabel: string
  /** 列（指标）：label + propId；仅收录全体招式共享的指标（矩阵保持稠密，无空位） */
  columns: Array<{ label: string; propId: number }>
  /** 行（段次）：label + 按 propId 索引的展示值 */
  rows: Array<{ label: string; values: Record<string, string> }>
  /** 组内不属共享矩阵的条目（静态文本如充能计数、或仅部分招式拥有的指标），独立成补充行 */
  extras?: SkillDetail[]
}

/** 条目名共享前缀（转置行标签/列头的切分依据）；无共享时为 '' */
function commonPrefix(names: string[]): string {
  let p = names[0] ?? ''
  for (const n of names.slice(1)) {
    let i = 0
    while (i < p.length && i < n.length && p[i] === n[i]) i++
    p = p.slice(0, i)
    if (!p) break
  }
  return p
}

/** 条目名共享后缀（从尾部向前比；用于区分重复行标签，如「一段（物理）」补「（物理）」） */
function commonSuffix(strs: string[]): string {
  if (!strs.length) return ''
  let s = strs[0] ?? ''
  for (const n of strs.slice(1)) {
    let i = 0
    while (i < s.length && i < n.length && s[s.length - 1 - i] === n[n.length - 1 - i]) i++
    s = s.slice(s.length - i)
    if (!s) break
  }
  return s
}

/** 公式引用的全部 Skill ID 集合（tiebreaker 配对依据） */
function formulaSkillIds(formula: string): Set<string> {
  const s = new Set<string>()
  const re = /\{Skill:(\d+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(formula))) s.add(m[1])
  return s
}

/**
 * 把技能组转置为「段×指标」表：行 = 名称共享同一主体前缀的招式（一段/二段/三段、
 * 对小体型/中体型/大体型敌人、回旋斩击/快速剪击…），列 = 指标（Prop，伤害倍率/失衡倍率…）。
 * 行分组按名称 LCP 配对（而非 Skill 引用，因「霜锋」等按体型拆分时公式共用一个 Skill）；
 * LCP 平局时用公式的 Skill 集合 Jaccard 相似度（交集/并集）最大者裁决（如
 * 「一段失衡倍率（物理）」归属 Skill 完全相同的「一段伤害倍率（物理）」行，而非「（以太）」行；
 * 「三段（协同）」行因多引用一个 Skill 而得分更低，得以与「三段」行区分）。
 * 行标签 = 该行条目名公共前缀，重复时补「去列标签后的公共后缀」（如 一段/一段（物理）/一段（以太））；
 * 列头 = 每行同名条目「去行主题后缀」的公共前缀（不要求全一致，容忍「（物理）」类行后缀）。
 * 矩阵只收「每行都有条目」的稠密指标列（≥2 列才构成真正的表），保证矩阵无空位；
 * 静态文本条目（无 Skill 引用，如「1点」充能计数）与仅部分招式拥有的指标归入 extras
 * 独立成补充行。无法构成合理矩阵时返回 null，由调用方退回原纵向列表。
 */
export function buildSkillMetricTable(
  group: SkillGroup,
  level: number,
): SkillMetricTable | null {
  const entries = group.entries ?? []
  if (!entries.length) return null

  // 拆解：含 Skill 引用的条目参与矩阵；静态文本条目直接归入补充行
  const refs: Array<{ detail: SkillDetail; propId: number }> = []
  for (const en of entries) {
    const m = en.formula.match(SKILL_REF_FULL_RE)
    if (m) refs.push({ detail: en, propId: Number(m[2]) })
  }
  if (!refs.length) return null

  /** 最长公共前缀长度 */
  const lcpLen = (a: string, b: string): number => {
    let n = 0
    while (n < a.length && n < b.length && a[n] === b[n]) n++
    return n
  }

  // 按指标（Prop）分列，列序 = 首现序
  const columns: Array<{ propId: number; items: SkillDetail[] }> = []
  const colIndex = new Map<number, number>()
  for (const r of refs) {
    let i = colIndex.get(r.propId)
    if (i == null) {
      i = columns.length
      colIndex.set(r.propId, i)
      columns.push({ propId: r.propId, items: [] })
    }
    columns[i].items.push(r.detail)
  }
  if (columns.length < 2) return null

  // 参考列 = 条目最多者（行数来源；并列取先出现）
  let refIdx = 0
  for (let i = 1; i < columns.length; i++) {
    if (columns[i].items.length > columns[refIdx].items.length) refIdx = i
  }
  const refCol = columns[refIdx]
  const refNames = refCol.items.map((d) => d.name ?? '')
  const refSkills = refCol.items.map((d) => formulaSkillIds(d.formula))

  // 行配对：非参考列条目分配到 LCP 最长的参考条目所在行；
  // LCP 平局时以公式 Skill 集合 Jaccard 相似度最大者裁决（交集为 0 或仍并列 → 无法配对）；
  // 无法配对者经下方 extras 收集归入补充行，不阻断矩阵
  const rowMap: Array<Map<number, SkillDetail>> = refCol.items.map(() => new Map())
  for (let c = 0; c < columns.length; c++) {
    if (c === refIdx) continue
    for (const en of columns[c].items) {
      const name = en.name ?? ''
      let bestLen = 0
      let ties: number[] = []
      for (let r = 0; r < refNames.length; r++) {
        const len = lcpLen(refNames[r], name)
        if (len > bestLen) { bestLen = len; ties = [r] }
        else if (len === bestLen && len > 0) ties.push(r)
      }
      if (bestLen === 0) continue
      let target = -1
      if (ties.length === 1) {
        target = ties[0]
      } else {
        // tiebreaker：与参考行公式的 Skill 集合 Jaccard 相似度最大者
        // （交集/并集；完全相等的集合得 1.0，部分共享的「（协同）」行得分更低，如
        //   {1511006} vs {1511006} = 1.0 vs {1511006,1511018} = 0.5）
        const es = formulaSkillIds(en.formula)
        const esArr = [...es]
        let bestSim = -1, bestRow = -1, tie2 = false
        for (const r of ties) {
          let ov = 0
          for (const id of esArr) if (refSkills[r].has(id)) ov++
          const union = new Set([...esArr, ...refSkills[r]]).size
          const sim = union ? ov / union : 0
          if (sim > bestSim) { bestSim = sim; bestRow = r; tie2 = false }
          else if (sim === bestSim && sim > 0) tie2 = true
        }
        if (bestRow < 0 || bestSim === 0 || tie2) continue
        target = bestRow
      }
      rowMap[target].set(columns[c].propId, en)
    }
  }

  // 稠密列 = 条目数与行数一致、且每行都配对上（参考列天然稠密）
  const complete: number[] = [refCol.propId]
  for (const col of columns) {
    if (col.propId === refCol.propId) continue
    if (col.items.length === refCol.items.length && rowMap.every((m) => m.has(col.propId))) {
      complete.push(col.propId)
    }
  }
  if (complete.length < 2) return null
  const completeSet = new Set(complete)

  // 行主题初值 = 该行稠密列条目名的公共前缀；任一为空则退回列表
  const subjects: string[] = []
  for (let r = 0; r < refCol.items.length; r++) {
    const names = [refCol.items[r].name ?? '']
    for (const [p, d] of rowMap[r]) {
      if (completeSet.has(p)) names.push(d.name ?? '')
    }
    const subject = commonPrefix(names)
    if (!subject) return null
    subjects.push(subject)
  }

  // 列标签 = 该列所有条目「去行主题后缀」的公共前缀（不要求全一致）；
  // 公共前缀若止于全角开括号「（」，说明吸入了行后缀的起始（如「一段伤害倍率（物理）」列
  // 无裸「伤害倍率」行夹住前缀），剔除该括号
  const colLabel = new Map<number, string>()
  for (const p of complete) {
    const pre: string[] = []
    for (let r = 0; r < refCol.items.length; r++) {
      const entry = p === refCol.propId ? refCol.items[r] : rowMap[r].get(p)!
      pre.push((entry.name ?? '').slice(subjects[r].length))
    }
    const raw = commonPrefix(pre)
    const label = raw.endsWith('（') ? raw.slice(0, -1) : raw
    if (!label) return null
    colLabel.set(p, label)
  }

  // 行标签 = 行主题 + 该行条目「去行主题、再去列标签」后的公共后缀（区分重复行）；
  // 补全后仍重复 → 无法构成可读矩阵，退回列表
  const rows: SkillMetricTable['rows'] = []
  for (let r = 0; r < refCol.items.length; r++) {
    const leftovers: string[] = []
    for (const p of complete) {
      const entry = p === refCol.propId ? refCol.items[r] : rowMap[r].get(p)!
      const s = (entry.name ?? '').slice(subjects[r].length)
      const label = colLabel.get(p)!
      leftovers.push(s.startsWith(label) ? s.slice(label.length) : s)
    }
    rows.push({ label: subjects[r] + commonSuffix(leftovers), values: {} })
  }
  if (new Set(rows.map((x) => x.label)).size < rows.length) return null

  // 填充矩阵值（代入所选等级）
  for (let r = 0; r < rows.length; r++) {
    for (const p of complete) {
      const entry = p === refCol.propId ? refCol.items[r] : rowMap[r].get(p)!
      rows[r].values[String(p)] = skillDetailValue(entry, level)
    }
  }

  // 补充行：静态文本条目 + 非稠密列（未配对/仅部分行拥有）的引用条目，按组内原序
  const extras: SkillDetail[] = []
  for (const en of entries) {
    const m = en.formula.match(SKILL_REF_FULL_RE)
    if (!m || !completeSet.has(Number(m[2]))) extras.push(en)
  }

  return {
    rowLabel: '',
    columns: complete.map((p) => ({ label: colLabel.get(p)!, propId: p })),
    rows,
    extras,
  }
}

/** 从皮肤字典构建有序 SkinRow[]（按皮肤 id 排序） */
export function buildSkinRows(
  skins: Record<string, unknown> | undefined | null,
): SkinRow[] {
  if (!skins) return []
  return Object.entries(skins)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([k, v]) => ({
      id: k,
      name: (v as { name?: string }).name ?? '',
      desc: (v as { desc?: string }).desc ?? '',
      img: (v as { image?: string }).image ?? '',
    }))
}

/* ---------- 邦布技能槽位（邦布详情页） ---------- */

export const BANGBOO_SKILL_ORDER = ['a', 'b', 'c'] as const
export type BangbooSkillKey = (typeof BANGBOO_SKILL_ORDER)[number]

export const BANGBOO_SKILL_ZH: Record<BangbooSkillKey, string> = {
  a: '主动技',
  b: '额外能力',
  c: '邦布连携技',
}

export interface BangbooSkillRow {
  key: BangbooSkillKey
  zh: string
  names: string[]
  /** 各级描述去重（不同级仅数值变化，取原文） */
  desc: string
  /** 各级原始描述（与等级一一对应，含富文本；随所选等级展示） */
  descs: string[]
  /** 技能等级上限（a/c=10、b=5；无 level 数据为 0） */
  levelCount: number
  /** 每级 param 按 | 分割的 token（与 stats 条目一一对应） */
  tokens: string[][]
  /** 数值条目（属性名 + 是否含 skill_prop 引用） */
  stats: BangbooSkillStat[]
  /** skill_prop 数值表（skillId → propId → entry），供引用条目随等级求值 */
  propMap: Record<string, Record<string, SkillParamEntry>>
}

/** 邦布技能数值条目（param 分割，与 property 列对齐） */
export interface BangbooSkillStat {
  /** 属性名（property 列缺失时按序号兜底） */
  name: string
  /** 是否含 {Skill:…} 引用（可随等级计算；否则为静态文本如 20秒） */
  referenced: boolean
}

/**
 * 从邦布详情的 skill + skill_prop 构建有序技能行（按 a/b/c 顺序）。
 * param 为每级独立的「|」分隔串：{Skill:ID, Prop:P} 引用（或嵌套公式）对应 skill_prop
 * 数值，其余为静态文本（如冷却时间/生命回复）。
 */
export function buildBangbooSkills(
  skill: Record<string, unknown> | undefined | null,
  skillProp?: unknown,
): BangbooSkillRow[] {
  if (!skill) return []
  const propMap = (skillProp ?? {}) as Record<string, Record<string, SkillParamEntry>>
  return BANGBOO_SKILL_ORDER.filter((k) => skill[k] != null).map((k) => {
    const levels = ((skill[k] as { level?: Record<string, unknown> })?.level ??
      {}) as Record<string, { name?: string; desc?: string; property?: string[]; param?: string }>
    const ordered = Object.keys(levels)
      .sort((a, b) => Number(a) - Number(b))
      .map((o) => levels[o])
      .filter(Boolean)
    const names = [...new Set(
      ordered.map((l) => l?.name ?? '').filter(Boolean),
    )]
    const tokens = ordered.map((l) => String(l?.param ?? '').split('|'))
    const tokenCount = Math.max(0, ...tokens.map((t) => t.length))
    const stats: BangbooSkillStat[] = []
    for (let i = 0; i < tokenCount; i++) {
      const prop = ordered[0]?.property?.[i]
      stats.push({
        name: prop && prop.trim() ? prop : `属性 ${i + 1}`,
        referenced: tokens.some((t) => t[i]?.includes('{Skill:')),
      })
    }
    return {
      key: k,
      zh: BANGBOO_SKILL_ZH[k] ?? k.toUpperCase(),
      names,
      desc: ordered[0]?.desc ?? '',
      descs: ordered.map((l) => l?.desc ?? ''),
      levelCount: ordered.length,
      tokens,
      stats,
      propMap,
    }
  })
}

/**
 * 邦布技能条目的展示值（代入所选等级）：
 * - {Skill:…} 引用/嵌套公式 → 经 skill_prop 求值并按 format 格式化
 * - 静态文本（20秒/8%生命值…）→ 取该等级原文
 */
export function bangbooSkillStatValue(
  row: BangbooSkillRow,
  index: number,
  level: number,
): string {
  const L = Math.min(Math.max(level, 1), Math.max(row.levelCount, 1))
  const token = row.tokens[L - 1]?.[index]
  if (!token) return '—'
  if (!token.includes('{Skill:')) return token
  const ref = token.match(/Skill:(\d+),\s*Prop:(\d+)/)
  const format = ref ? row.propMap[ref[1]]?.[ref[2]]?.format : undefined
  return formatSkillScalar(evaluateSkillFormula(token, row.propMap, L), format)
}

/* ============================================================
 * 核心技（passive）：核心被动 + 额外能力，随等级强化。
 * 数据源：角色详情的 passive.level 等级字典，每条记录含
 *   level（核心技等级，1-7）、name[2]（核心被动名 / 额外能力名）、
 *   desc[2]（对应描述，富文本）。
 * 结构：7 条 = 基础 7 级；14 条 = 两轮 1-7（第 2 轮为「强化」版：
 *   核心被动/额外能力效果更强，如猫又核心被动持续 6s→40s）。
 * ============================================================ */

/** 核心技单级记录 */
export interface CoreSkillLevel {
  /** 展示序号（1-based，按数据记录序） */
  no: number
  /** 核心技等级（数据 level 字段；两轮结构时 1-7 循环） */
  level: number
  /** 是否为「强化」版（两轮结构的第 2 轮起） */
  enhanced: boolean
  /** 核心被动名 */
  coreName: string
  /** 额外能力名 */
  extraName: string
  /** [核心被动 desc, 额外能力 desc]（原始富文本，展示层经 rich.ts 处理） */
  desc: [string, string]
}

/** 核心技聚合数据 */
export interface CoreSkill {
  /** 核心被动名（各级一致） */
  coreName: string
  /** 额外能力名（各级一致） */
  extraName: string
  /** 核心技等级数（去重后，7；两轮结构仍为 7） */
  levelCount: number
  /** 是否存在「强化」版（14 条结构时 true） */
  hasEnhance: boolean
  /** 各级记录（按序） */
  levels: CoreSkillLevel[]
}

/** 从 passive 字典构建核心技数据；无数据时返回 null */
export function buildCoreSkill(
  passive: Record<string, unknown> | undefined | null,
): CoreSkill | null {
  const level = (passive as { level?: Record<string, unknown> } | undefined)?.level
  if (!level) return null
  const records = Object.values(level)
    .map((v) => v as Record<string, unknown>)
    .filter((v) => Array.isArray(v?.name) && Array.isArray(v?.desc))
    .map((v) => ({
      level: Number(v?.level) || 0,
      coreName: String((v.name as string[])[0] ?? '核心被动'),
      extraName: String((v.name as string[])[1] ?? '额外能力'),
      desc: [(v.desc as string[])[0] ?? '', (v.desc as string[])[1] ?? ''] as [string, string],
    }))
  if (!records.length) return null
  // 两轮结构检测：level 字段去重后数量 < 记录数（如 7 < 14）→ 第 2 轮起为强化版
  const levelCount = new Set(records.map((r) => r.level)).size
  const hasEnhance = levelCount > 0 && levelCount < records.length
  return {
    coreName: records[0].coreName,
    extraName: records[0].extraName,
    levelCount,
    hasEnhance,
    levels: records.map((r, i) => ({
      no: i + 1,
      level: r.level,
      enhanced: hasEnhance && i >= levelCount,
      coreName: r.coreName,
      extraName: r.extraName,
      desc: r.desc,
    })),
  }
}

/* ============================================================
 * 核心技强化（extra_level）：核心技的独立强化条目。
 * 每档有解锁等级门槛（max_level: 15/25/35/45/55/60）与属性加成
 * （extra 字典：prop/name/format/value，value 为累计值）。
 * 与「潜能影画」（potential_detail，V2.5 激发潜能）是不同系统。
 * ============================================================ */

/** 核心技强化单条属性加成 */
export interface CoreEnhanceBonus {
  /** 属性名（如「暴击率」「基础攻击力」） */
  name: string
  /** 原始值（百分比字段为万分比，如 480 = 4.8%） */
  value: number
  /** hakushin 格式串（{0:0.#%} 等） */
  format?: string
  /** 格式化显示串（如「4.8%」「25」） */
  text: string
}

/** 核心技强化档位（A-F） */
export interface CoreEnhanceLevel {
  /** 档位编号（A-F） */
  no: string
  /** 解锁等级门槛（max_level） */
  unlockAt: number
  /** 该档属性加成（累计值，0 加成已过滤） */
  bonus: CoreEnhanceBonus[]
}

/** 按 hakushin format 串格式化强化值 */
export function formatCoreEnhance(value: number, format?: string): string {
  const f = format ?? '{0:0.#}'
  if (f.includes('%')) {
    return `${(value / 100).toFixed(1).replace(/\.0$/, '')}%`
  }
  if (f.includes('##')) return value.toFixed(2).replace(/\.?0+$/, '')
  if (f.includes('.#')) return value.toFixed(1).replace(/\.0$/, '')
  return String(Math.round(value))
}

/** 核心技强化档位编号（A-F，与游戏内核心技 A/B/C 等级口径一致） */
const ENHANCE_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']

/** 从 extra_level 字典构建核心技强化档位列表（按档序）；无数据时返回 [] */
export function buildCoreEnhance(
  extraDict: Record<string, unknown> | undefined | null,
): CoreEnhanceLevel[] {
  if (!extraDict) return []
  return Object.entries(extraDict)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([k, v]) => {
      const o = (v ?? {}) as Record<string, unknown>
      const bonus = Object.values((o.extra ?? {}) as Record<string, unknown>)
        .map((e) => {
          const p = (e ?? {}) as { name?: string; format?: string; value?: number }
          const value = Number(p.value) || 0
          return {
            name: String(p.name ?? ''),
            value,
            format: p.format,
            text: formatCoreEnhance(value, p.format),
          }
        })
        .filter((b) => b.value !== 0)
      return {
        no: ENHANCE_LABELS[Number(k) - 1] ?? String(k),
        unlockAt: Number(o.max_level) || 0,
        bonus,
      }
    })
    .filter((l) => l.unlockAt > 0)
}

/* ============================================================
 * 潜能影画（potential_detail，V2.5「激发潜能」）：老角色加强系统。
 * 6 档（level_show_name 如「炽焰行歌 I」），档 I 为机制补强（无文字），
 * 档 II-VI 为数值补强（name 效果名 + desc 富文本）。
 * 与核心技强化（extra_level）是不同系统。
 * ============================================================ */

/** 潜能影画单档 */
export interface PotentialCinema {
  /** 档位号（I-VI，从 level_show_name 提取；无则用 id） */
  no: string
  /** 档位全名（如「炽焰行歌 I」） */
  label: string
  /** 效果名（如「潜能觉醒：绝焰」；档 I 通常为空） */
  name: string
  /** 效果描述（富文本；档 I 通常为空） */
  desc: string
}

const ROMAN_RE = /[IVXLCDM]+$/

/** 从 potential_detail 字典构建潜能影画档位列表（按档序）；无数据时返回 [] */
export function buildPotentialCinema(
  detail: Record<string, unknown> | undefined | null,
): PotentialCinema[] {
  if (!detail) return []
  return Object.entries(detail)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([k, v]) => {
      const o = (v ?? {}) as Record<string, unknown>
      const label = String(o.level_show_name ?? '')
      const m = label.match(ROMAN_RE)
      return {
        no: m?.[0] ?? String(k),
        label,
        name: String(o.name ?? ''),
        desc: String(o.desc ?? ''),
      }
    })
    .filter((p) => p.label || p.name || p.desc)
}

/* ============================================================
 * 角色基础属性随等级成长（DESIGN.md P2：纯函数、无 Vue 依赖、可单测）。
 * 模型（已用游戏内 Lv.1/10/20/30/40/50/60 锚点验证）：
 *   属性(L) = floor( 1 级基础 + 该段累计突破加成 + growth/10000 × (L-1) )
 *   突破段取自 level 字典（hakushin ascension）。
 *   注意：核心技强化（extra_level）/ 潜能影画（potential_detail）均为独立
 *   养成系统，不随等级自动并入基础面板。
 * ============================================================ */

/** 角色等级范围（绝区零 1–60 级） */
export const CHAR_LEVEL_MIN = 1
export const CHAR_LEVEL_MAX = 60
export const CHAR_LEVEL_DEFAULT = CHAR_LEVEL_MAX

/** 突破段信息：level 字典中的一段（如 {1..6}） */
export interface CharBreakSegment {
  /** 突破段号（1-6，对应第几次突破后的段） */
  phase: number
  /** 段内等级下限（不含；段 1 为 0） */
  min: number
  /** 段内等级上限（含） */
  max: number
  /** 至该段为止的累计突破加成（生命值） */
  hp: number
  /** 至该段为止的累计突破加成（攻击力） */
  attack: number
  /** 至该段为止的累计突破加成（防御力） */
  defence: number
}

/** 从 level 字典解析出按段号排序的突破段（升序） */
export function parseCharBreaks(
  levelDict: Record<string, unknown> | undefined | null,
): CharBreakSegment[] {
  if (!levelDict) return []
  return Object.entries(levelDict)
    .filter(([, v]) => v && typeof v === 'object')
    .map(([, v]) => {
      const o = v as Record<string, unknown>
      return {
        min: Number(o.level_min) || 0,
        max: Number(o.level_max) || 0,
        hp: Number(o.hp_max) || 0,
        attack: Number(o.attack) || 0,
        defence: Number(o.defence) || 0,
      }
    })
    .sort((a, b) => a.min - b.min)
    .map((s, i) => ({ ...s, phase: i + 1 }))
}

/** 指定等级所属的突破段；无数据时返回 null */
export function charBreakSegment(
  levelDict: Record<string, unknown> | undefined | null,
  lv: number,
): CharBreakSegment | null {
  const segs = parseCharBreaks(levelDict)
  // 段判定：(min, max]（段 1 的 min=0），lv=60 落最后一段
  return segs.find((s) => lv > s.min && lv <= s.max) ?? null
}

/** 单属性成长：floor(基础 + 突破加成 + growth/10000 × (L-1))；L 钳制 ≥ 1（防越界负成长） */
export function statAtLevel(
  base: number,
  growth: number,
  breakBonus: number,
  lv: number,
): number {
  const L = Math.max(1, lv)
  return Math.floor(base + breakBonus + (growth / 10000) * (L - 1))
}

/* ---------- 完整面板（KeyValueGrid 数据源） ---------- */

/** 面板字段访问器：stats 字典取数值（非数字视为缺） */
type StatCell = number | string | unknown[]
function cell(s: Record<string, StatCell> | undefined, key: string): number | null {
  const v = s?.[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** 百分比展示：万分比数值 /100 保留 2 位（与旧 STAT_DEFS 一致） */
function pct(v: number): string {
  return `${(v / 100).toFixed(2)}%`
}

/**
 * 角色在指定等级下的基础面板（含突破加成；潜能为独立系统，不并入本表）。
 * 输出与 KeyValueGrid 直接兼容的 StatItem[]；stats 缺失时返回 []。
 */
export function characterStatsAtLevel(
  stats: Record<string, StatCell> | undefined,
  levelDict: Record<string, unknown> | undefined | null,
  lv: number,
): StatItem[] {
  if (!stats) return []
  const seg = charBreakSegment(levelDict, lv)
  const segHp = seg?.hp ?? 0
  const segAtk = seg?.attack ?? 0
  const segDef = seg?.defence ?? 0
  const rows: Array<[string, string | null]> = [
    ['生命值', numStr(cell(stats, 'hp_max'), cell(stats, 'hp_growth'), segHp, lv)],
    ['攻击力', numStr(cell(stats, 'attack'), cell(stats, 'attack_growth'), segAtk, lv)],
    ['防御力', numStr(cell(stats, 'defence'), cell(stats, 'defence_growth'), segDef, lv)],
    ['冲击力', cell(stats, 'break_stun') != null ? String(cell(stats, 'break_stun')) : null],
    ['暴击率', pctOrNull(cell(stats, 'crit'))],
    ['暴击伤害', pctOrNull(cell(stats, 'crit_damage'))],
    ['穿透率', pctOrNull(cell(stats, 'pen_rate'))],
    ['异常掌控', cell(stats, 'element_mystery') != null ? String(cell(stats, 'element_mystery')) : null],
    ['异常精通', cell(stats, 'element_abnormal_power') != null ? String(cell(stats, 'element_abnormal_power')) : null],
    ['能量回复', cell(stats, 'sp_recover') != null ? String(cell(stats, 'sp_recover')) : null],
  ]
  return rows
    .filter((r): r is [string, string] => r[1] != null)
    .map(([label, value]) => ({ label, value }))
}

/** 成长属性的面板值（整数） */
function numStr(
  base: number | null,
  growth: number | null,
  bonus: number,
  lv: number,
): string | null {
  if (base == null) return null
  return String(statAtLevel(base, growth ?? 0, bonus, lv))
}

/** 百分比属性的面板值 */
function pctOrNull(v: number | null): string | null {
  if (v == null) return null
  return pct(v)
}

/* ---------- 音擎基础属性（等级滑条） ---------- */

/** 音擎等级范围（1-60，10 级一突破） */
export const W_ENGINE_LEVEL_MIN = 1
export const W_ENGINE_LEVEL_MAX = 60
export const W_ENGINE_LEVEL_DEFAULT = W_ENGINE_LEVEL_MAX

/**
 * 音擎主属性（基础攻击力）成长曲线，已突破口径（10/20/30/40/50 显示突破后）：
 * - Lv.1 = base，Lv.60 = max；M = max − base
 * - 段 1（Lv.1→Lv.10）走 11.25% M（9 步），随后每 10 级段走 11.25% M，
 *   每次突破瞬间 +6.5% M；与 BWIKI 详细面板断点吻合（±1 取整误差）。
 */
export function wEngineMainAt(lv: number, base: number, max: number): number {
  if (lv >= W_ENGINE_LEVEL_MAX) return max
  if (lv <= W_ENGINE_LEVEL_MIN) return base
  const M = max - base
  if (M <= 0) return base
  const seg = Math.floor(lv / 10) // 0..5（突破后段起点：Lv.10k = base + 17.75% M × k）
  if (seg === 0) {
    return Math.floor(base + M * 0.1125 * ((lv - 1) / 9))
  }
  return Math.floor(base + M * (0.1775 * seg + 0.01125 * (lv - 10 * seg)))
}

/**
 * 音擎副属性随等级成长：每 10 级突破 ×1.3（1 → 1.3 → 1.6 → 1.9 → 2.2 → 2.5 封顶）。
 * base 为万分比整数（如 960 = 9.6%），返回同量纲。
 */
export function wEngineRandAt(lv: number, base: number): number {
  const seg = Math.min(Math.floor(lv / 10), 5)
  return Math.round(base * (1 + 0.3 * seg))
}

/** 音擎当前等级的突破次数（0-5；Lv.10k 视为已突破） */
export function wEngineBreakCount(lv: number): number {
  return Math.min(Math.max(Math.floor(lv / 10), 0), 5)
}

/**
 * 音擎在指定等级下的基础属性（主属性 + 副属性），输出与 KeyValueGrid 兼容。
 * 缺满级值（atk_max 未注入）时回退 Lv.1 静态值；% 格式按万分比 /100 显示。
 */
export function wEnginePropsAtLevel(
  lv: number,
  base: { name?: string; value?: number } | undefined | null,
  rand: { name?: string; value?: number; format?: string } | undefined | null,
  max: number | undefined,
): StatItem[] {
  const items: StatItem[] = []
  const mainName = base?.name
  const randName = rand?.name
  if (mainName && base?.value != null) {
    const v = max != null ? wEngineMainAt(lv, base.value, max) : base.value
    items.push({ label: mainName, value: String(v), tag: '主属性' })
  }
  if (randName && rand?.value != null) {
    const v = wEngineRandAt(lv, rand.value)
    const fmt = rand.format ?? ''
    items.push({
      label: randName,
      value: fmt.includes('%') ? `${(v / 100).toFixed(2)}%` : String(v),
      tag: '副属性',
    })
  }
  return items
}

/* ---------- 邦布基础属性（等级滑条） ---------- */

/** 邦布等级范围（1-60，10 级一突破，与角色/音擎一致） */
export const BANGBOO_LEVEL_MIN = 1
export const BANGBOO_LEVEL_MAX = 60
export const BANGBOO_LEVEL_DEFAULT = BANGBOO_LEVEL_MAX

/** 邦布当前等级的突破次数（0-5；Lv.10k 视为已突破） */
export function bangbooBreakCount(lv: number): number {
  return Math.min(Math.max(Math.floor(lv / 10), 0), 5)
}

/**
 * 邦布在指定等级下的面板（已突破口径，与角色/音擎一致）：
 * - 生命/攻击/防御：floor(基础 + 段累计突破加成 + 成长/10000 × (L-1))，段判定按突破后
 * - 暴击率/暴击伤害：Lv.1 基础 + 当前段 extra（万分数），突破时随段提升
 * - 冲击力/异常掌控/能量回复：不随等级变化
 * 输出与 KeyValueGrid 兼容；stats 缺失时返回 []。
 */
export function bangbooStatsAtLevel(
  stats: Record<string, StatCell> | undefined,
  levelDict: Record<string, unknown> | undefined | null,
  lv: number,
): StatItem[] {
  if (!stats) return []
  const L = Math.min(Math.max(lv, BANGBOO_LEVEL_MIN), BANGBOO_LEVEL_MAX)
  const segs = parseCharBreaks(levelDict)
  // 已突破口径段号：Lv.10k 落入其突破后的段（10→段2 … 50→段6），无数据按段1
  const seg = segs[Math.min(Math.floor(L / 10) + 1, Math.max(segs.length, 1)) - 1]
  const segHp = seg?.hp ?? 0
  const segAtk = seg?.attack ?? 0
  const segDef = seg?.defence ?? 0

  // 段 extra（暴击率/暴击伤害追加）：entries 按段号排序，取当前口径段
  const entries = Object.entries(levelDict ?? {})
    .filter(([, v]) => v && typeof v === 'object')
    .sort((a, b) => Number(a[0]) - Number(b[0]))
  const segIdx = Math.min(Math.floor(L / 10) + 1, Math.max(entries.length, 1)) - 1
  const extra = (entries[segIdx]?.[1] as { extra?: Record<string, { value?: number }> } | undefined)
    ?.extra ?? {}
  const extraCrit = typeof extra['20101']?.value === 'number' ? (extra['20101'] as { value: number }).value : 0
  const extraCritDmg = typeof extra['21101']?.value === 'number' ? (extra['21101'] as { value: number }).value : 0

  const hp = cell(stats, 'hp_max')
  const atk = cell(stats, 'attack')
  const def = cell(stats, 'defence')
  const grow = (key: string) => cell(stats, key) ?? 0
  const num = (v: number) => String(v)
  const pct2 = (v: number) => `${(v / 100).toFixed(2)}%`

  const rows: Array<[string, string | null]> = [
    ['生命值', hp != null ? num(statAtLevel(hp, grow('hpupgrade'), segHp, L)) : null],
    ['攻击力', atk != null ? num(statAtLevel(atk, grow('attack_upgrade'), segAtk, L)) : null],
    ['防御力', def != null ? num(statAtLevel(def, grow('def_upgrade'), segDef, L)) : null],
    ['冲击力', cell(stats, 'break_stun') != null ? num(cell(stats, 'break_stun')!) : null],
    ['暴击率', cell(stats, 'crit') != null ? pct2(cell(stats, 'crit')! + extraCrit) : null],
    ['暴击伤害', cell(stats, 'crit_dmg') != null ? pct2(cell(stats, 'crit_dmg')! + extraCritDmg) : null],
    ['异常掌控', cell(stats, 'element_abnormal_power') != null ? num(cell(stats, 'element_abnormal_power')!) : null],
    ['能量回复', cell(stats, 'endurance') != null ? num(cell(stats, 'endurance')!) : null],
  ]
  return rows
    .filter((r): r is [string, string] => r[1] != null)
    .map(([label, value]) => ({ label, value }))
}
