/* ============================================================
 * skillFormula — 技能公式求值引擎（自 sections.ts 拆出，单一职责）。
 *
 * 三件事：① {Skill:ID, Prop:P} 占位公式的递归下降解析求值；
 *         ② {CAL:expr,scale,decimals} 内嵌占位的解析与等级代入；
 *         ③ 数值展示格式化。
 * 纯函数、无 Vue/IO 依赖，可独立单测；sections.ts 原样再导出保持 API 兼容。
 * ============================================================ */

/** 技能详细倍率的单个数值条目（param.skillId 下的主值/成长/格式） */
export interface SkillParamEntry {
  main: number
  growth: number
  format?: string
}

/* ---------- {Skill:…} 公式求值 ---------- */

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

/** 与 { 相配的 } 下标（嵌套感知；找不到回退串尾） */
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

/* ---------- {CAL:…} 内嵌公式占位（技能描述/数值条目中的等级代入数值） ---------- */

/** {CAL:expr,scale,decimals} 解析结果：expr 为算术式（可含 AvatarSkillLevel(n) 等级引用）；
 *  scale=展示倍率（1 或 100：小数形式 ×100 转百分比）；decimals=保留小数位（展示时去尾零）。
 *  单位（%/点/秒）是占位之外的普通文案，不在占位内 */
export interface CalToken {
  expr: string
  scale: number
  decimals: number
}

const CAL_TOKEN_RE = /\{CAL:([^{}]*)\}/
const CAL_TOKEN_GLOBAL_RE = /\{CAL:[^{}]*\}/g

/** 解析单个 {CAL:…} 占位；非 CAL 公式返回 undefined。
 *  例："{CAL:0+AvatarSkillLevel(1)*1.5,1,2}%" → expr="0+AvatarSkillLevel(1)*1.5"、scale=1、decimals=2 */
export function parseCalToken(formula: string): CalToken | undefined {
  const m = formula.match(CAL_TOKEN_RE)
  if (!m) return undefined
  const [expr = '', scaleRaw = '1', decimalsRaw = '1'] = m[1].split(',')
  return {
    expr: expr.trim(),
    scale: Number(scaleRaw) || 1,
    decimals: Number(decimalsRaw) || 1,
  }
}

/** 计算 {CAL:…} 占位在指定技能等级下的数值展示：AvatarSkillLevel(n) 代入该级 →
 *  求值 ×scale → 按 decimals 保留（去尾零）。不含占位外的单位（% 等为普通文案）。
 *  例（12 级）："{CAL:0+AvatarSkillLevel(1)*1.5,1,2}" → "18" */
export function calTokenValue(cal: CalToken, level: number): string {
  const expr = cal.expr.replace(/AvatarSkillLevel\(\d+\)/g, String(level))
  const raw = evaluateSkillFormula(expr, {}, level) * cal.scale
  let s = raw.toFixed(cal.decimals)
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '')
  return s
}

/** 全量替换文本中的全部 {CAL:…} 占位为等级代入数值；
 *  占位外的单位/缀词为普通文案，原样保留。 */
export function replaceCalTokens(formula: string, level: number): string {
  return formula.replace(CAL_TOKEN_GLOBAL_RE, (tok) => {
    const cal = parseCalToken(tok)
    return cal ? calTokenValue(cal, level) : ''
  })
}
