/* ============================================================
 * gameMarkup — 绝区零游戏标记文本的单一语法分析器。
 *
 * 数据源描述文本内嵌的标记曾由 rich.ts（HTML 化）与 text.ts（剥标记）
 * 各写一套正则，语法规则双份维护必然漂移。现统一：两个消费端都从
 * 本模块的 tokenizeGameText() 取同一条词法流，只保留各自的「策略」：
 *   - richDesc（渲染）：COLOR(hex)→彩色 span、ICONMAP→键位小图标、
 *     TERM→术语锚点、CAL(level)→等级代入数值
 *   - stripRichText（剥离）：全部还原为纯文本（换行保留；{Skill}/{CAL}
 *     维持锁定现状原样透传，见各端注释）
 * 词法（与数据实测形态一致）：
 *   <color=#RRGGBB[AA]> / <color='x'|«x»> … </color>   颜色（#KEYWORD 形态视为无色值）
 *   <IconMap:Icon_XXX>                内联键位图标
 *   <Term:N> … </Term>                术语引用
 *   <br>/<BR>/<br/>                   换行
 *   {CAL:expr,scale,decimals}         等级代入数值占位
 *   {Skill:N, Prop:P}                 详细倍率引用
 *   {LAYOUT_KEY#label}（KEY=A-Z）     输入方案变体；含数字的键（PS5）刻意不识别——
 *                                     既有锁定行为：剥离时原样保留（tests/text P0 注释）
 * 其余任何 <…> 与 {…} 不构成标记，留在 text 段交由各策略兜底。
 * ============================================================ */

export type MarkupToken =
  | { kind: 'color-open'; code: string }
  | { kind: 'color-close' }
  | { kind: 'iconmap'; name: string }
  | { kind: 'term-open'; id: string }
  | { kind: 'term-close' }
  | { kind: 'br' }
  | { kind: 'cal'; body: string }
  | { kind: 'skill-ref'; skillId: string; propId: string }
  | { kind: 'layout'; key: string; label: string }
  | { kind: 'text'; value: string }

/** 词法流元素：token + 原文切片（raw 供策略端还原未消费内容） */
export interface Lexeme {
  tok: MarkupToken
  /** 该片段在原文中的字面文本 */
  raw: string
}

// 粘性正则：exec(text) 从 lastIndex 精确锚定扫描位
const COLOR_HEX = /<color=#([0-9a-fA-F]{6,8})>/y
const COLOR_KW = /<color=#([0-9a-zA-Z_]+)>/y
const COLOR_QUOTED = /<color\s*=\s*(?:'[^']*'|"[^"]*")>/iy
const COLOR_CLOSE = /<\/color\s*>/iy
const ICONMAP = /<IconMap:(Icon_\w+)>/y
const TERM_OPEN = /<Term:(\d+)>/y
const TERM_CLOSE = /<\/Term\s*>/iy
const BR = /<br\s*\/?>/iy
const CAL = /\{CAL:([^{}]*)\}/y
const SKILL_REF = /\{Skill:(\d+),\s*Prop:(\d+)\}/y
/** 仅纯大写字母键；带数字的键刻意不匹配（锁定行为见文件头注释） */
const LAYOUT = /\{LAYOUT_([A-Z_]+)#([^}]*)\}/y

function lex<T extends MarkupToken>(re: RegExp, text: string, i: number, make: (m: RegExpExecArray) => T): Lexeme | null {
  re.lastIndex = i
  const m = re.exec(text)
  return m ? { tok: make(m), raw: m[0] } : null
}

/** 扫描位置 i 处的一次标签尝试（'<'+开头） */
function tagAt(text: string, i: number): Lexeme | null {
  return (
    lex(COLOR_HEX, text, i, (m) => ({ kind: 'color-open', code: m[1] ?? '' })) ??
    lex(COLOR_KW, text, i, (m) => ({ kind: 'color-open', code: m[1] ?? '' })) ??
    lex(COLOR_QUOTED, text, i, () => ({ kind: 'color-open', code: '' })) ??
    lex(ICONMAP, text, i, (m) => ({ kind: 'iconmap', name: m[1] ?? '' })) ??
    lex(TERM_OPEN, text, i, (m) => ({ kind: 'term-open', id: m[1] ?? '' })) ??
    lex(COLOR_CLOSE, text, i, () => ({ kind: 'color-close' })) ??
    lex(TERM_CLOSE, text, i, () => ({ kind: 'term-close' })) ??
    lex(BR, text, i, () => ({ kind: 'br' }))
  )
}

/** 扫描位置 i 处的一次花括号占位尝试（'{'+开头） */
function braceAt(text: string, i: number): Lexeme | null {
  return (
    lex(CAL, text, i, (m) => ({ kind: 'cal', body: m[1] ?? '' })) ??
    lex(SKILL_REF, text, i, (m) => ({ kind: 'skill-ref', skillId: m[1] ?? '', propId: m[2] ?? '' })) ??
    lex(LAYOUT, text, i, (m) => ({ kind: 'layout', key: m[1] ?? '', label: m[2] ?? '' }))
  )
}

/** 把原始文本切成词法流（线性扫描；未知序列并入相邻 text 段） */
export function tokenizeGameText(input: string): Lexeme[] {
  const out: Lexeme[] = []
  let plain = ''
  const flush = () => {
    if (plain) {
      out.push({ tok: { kind: 'text', value: plain }, raw: plain })
      plain = ''
    }
  }
  let i = 0
  while (i < input.length) {
    const ch = input[i]
    if (ch === '<' || ch === '{') {
      const l = ch === '<' ? tagAt(input, i) : braceAt(input, i)
      if (l) {
        flush()
        out.push(l)
        i += l.raw.length
        continue
      }
    }
    plain += ch
    i++
  }
  flush()
  return out
}
