import { describe, expect, it } from 'vitest'
import { stripRichText } from '../src/utils/text'

describe('stripRichText', () => {
  it('returns empty string for null/undefined/empty', () => {
    expect(stripRichText(null)).toBe('')
    expect(stripRichText(undefined)).toBe('')
    expect(stripRichText('')).toBe('')
  })

  it('keeps plain text unchanged', () => {
    expect(stripRichText('普通文本')).toBe('普通文本')
  })

  it('keeps inner text of <color> marks and drops tags', () => {
    expect(stripRichText('伤害提升 <color=#FFD700>15%</color>')).toBe('伤害提升 15%')
  })

  it('drops <IconMap> marks', () => {
    expect(stripRichText('按 <IconMap:Icon_Normal> 释放')).toBe('按  释放')
  })

  it('keeps only LAYOUT_FALLBACK content', () => {
    expect(stripRichText('{LAYOUT_CONSOLECONTROLLER#X}{LAYOUT_FALLBACK#普攻键}')).toBe('普攻键')
  })

  it('drops other pure-letter LAYOUT_ marks', () => {
    expect(stripRichText('{LAYOUT_MOBILE#T}冲刺')).toBe('冲刺')
  })

  // 已知现状：正则 LAYOUT_[A-Z]+# 无法跨越数字（如 PS5 中的 5），
  // 带数字的 LAYOUT_ 标记不会被清洗 —— P0 锁定现状，修复列为开放问题。
  it('keeps LAYOUT_ marks containing digits (current behavior)', () => {
    expect(stripRichText('{LAYOUT_PS5#O}冲刺')).toBe('{LAYOUT_PS5#O}冲刺')
  })

  it('converts <br> to newline', () => {
    expect(stripRichText('第一行<BR>第二行')).toBe('第一行\n第二行')
  })

  it('strips any remaining raw tags (safety net)', () => {
    expect(stripRichText('文本<script>alert(1)</script>结尾')).toBe('文本alert(1)结尾')
  })

  // 日文数据的**名字**字段带注音标记（`<ruby=よみ>漢字</ruby>`，实测 377 处，zh/en/ko 为 0）。
  // 说明文字一直走富文本工具，但组名/被动名/影画名是**裸插值**渲染的，曾把 <ruby=…> 原样印到页面上
  // （AGENTS §3 富文本铁律）。这些用例锁住「剥离后只剩可读文本」，防渲染层再退回裸插值。
  it('keeps only the base text of <ruby=…> (ja furigana)', () => {
    expect(stripRichText('回避：<ruby=むゆうほ>夢遊歩</ruby>')).toBe('回避：夢遊歩')
  })

  it('handles <ruby=…> embedded mid-name (ja mindscape)', () => {
    expect(stripRichText('<ruby=ちょうぜつ>鳥絶</ruby>技巧')).toBe('鳥絶技巧')
  })

  it('handles several <ruby=…> in one name', () => {
    expect(stripRichText('特殊スキル：寒風・<ruby=ついさい>追砕</ruby>')).toBe('特殊スキル：寒風・追砕')
  })

  it('normalizes carriage returns and trailing whitespace', () => {
    expect(stripRichText('  a\r\nb\t\n  ')).toBe('a\nb')
  })
})
