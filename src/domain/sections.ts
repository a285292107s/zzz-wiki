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
  props: Record<string, SkillParamEntry>
  /** 由公式首个引用技能解析出的展示格式（如 '%'） */
  format?: string
}

/**
 * 技能展示组：对应一个招式（如「普通攻击：狡兔连打」）。
 * 组 = 招式标题 + 说明文字(富文本) + 可选数值条目。
 * 说明文字与数值在 JSON 中分处「简单描述块」与「详细倍率块」，按 name 合并、按出现顺序排列。
 */
export interface SkillGroup {
  /** 招式名 */
  name: string
  /** 招式说明文字（富文本）；纯数值组无文字时为 undefined */
  desc?: string
  /** 该招式下的数值条目；纯文本招式无数值时为 undefined */
  entries?: SkillDetail[]
}

/** 技能行（键位、中文名、有序展示组） */
export interface SkillRow {
  key: SkillSlotKey
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
 * 例："{Skill:1031001, Prop:1001} + {{Skill:1031002, Prop:1001}/3}*3"
 */
export function evaluateSkillFormula(
  formula: string,
  props: Record<string, SkillParamEntry>,
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
      if (ref) return skillParamValue(props[ref[1]], level)
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
  return formatSkillScalar(evaluateSkillFormula(detail.formula, detail.props, level), detail.format)
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
}

/** 从邦布详情的 skill 字典构建有序技能行（按 a/b/c 顺序） */
export function buildBangbooSkills(
  skill: Record<string, unknown> | undefined | null,
): BangbooSkillRow[] {
  if (!skill) return []
  return BANGBOO_SKILL_ORDER.filter((k) => skill[k] != null).map((k) => {
    const levels = ((skill[k] as { level?: Record<string, unknown> })?.level ??
      {}) as Record<string, { name?: string; desc?: string }>
    const first = levels[Object.keys(levels)[0]]
    const names = [...new Set(
      Object.values(levels).map((l) => l?.name ?? '').filter(Boolean),
    )]
    return {
      key: k,
      zh: BANGBOO_SKILL_ZH[k] ?? k.toUpperCase(),
      names,
      desc: first?.desc ?? '',
    }
  })
}
