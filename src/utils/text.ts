/* ============================================================
 * Rich-text cleanup — 游戏标记文本 → 纯文本（供 white-space: pre-line）。
 *
 * 语法分析统一在 ./gameMarkup（tokenizeGameText 单一事实源）；
 * 本文件只承载「剥离策略」：
 *   全部标记还原为纯文本；<br>/<BR> → 换行。
 * 锁定现状（tests/text P0 注释）：
 *   - 含数字键的 LAYOUT（如 {LAYOUT_PS5#O}）不识别 → 原样保留；
 *   - 孤立 {Skill:…}/{CAL:…} 占位历史上即原样透传（无对应清洗规则），
 *     经 raw 还原继续透传，保持既有字节级行为；是否改为清除属开放问题。
 * ============================================================ */

import { tokenizeGameText } from './gameMarkup'

export function stripRichText(input: string | undefined | null): string {
  if (!input) return ''
  const lexemes = tokenizeGameText(input)
  let s = ''

  for (let i = 0; i < lexemes.length; i++) {
    const { tok, raw } = lexemes[i] ?? {}
    switch (tok?.kind) {
      case 'text': {
        // 未识别的标签（<script> 等）：剥壳留文，兜底与旧实现一致
        s += tok.value.replace(/<[^>]*>/g, '')
        break
      }
      case 'br':
        s += '\n'
        break
      case 'layout': {
        // 控制器+回退成对 → 只留回退文案；孤立变体 → 删除（含 FALLBACK 单独出现时）
        const next = lexemes[i + 1]?.tok
        if (tok.key === 'CONSOLECONTROLLER' && next?.kind === 'layout' && next.key === 'FALLBACK') {
          s += next.label
          i++
        }
        break
      }
      case 'cal':
      case 'skill-ref':
        s += raw // 锁定现状：历史上无对应规则，原样透传（见文件头注释）
        break
      default:
        break // color / iconmap / term：去标记、保内文（内文在其后 text 段中自然衔接）
    }
  }

  return s.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').trim()
}
