import { describe, expect, it } from 'vitest'
import { richDesc } from '../src/utils/rich'

describe('richDesc', () => {
  it('returns empty string for empty input', () => {
    expect(richDesc('')).toBe('')
    expect(richDesc(undefined)).toBe('')
  })

  it('escapes raw HTML for safety', () => {
    expect(richDesc('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    )
  })

  it('converts <color> marks to colored spans', () => {
    expect(richDesc('<color=#FFD700>金</color>')).toBe(
      '<span style="color:#FFD700">金</span>',
    )
  })

  // 已知现状：捕获组取了 Icon_ 之后的字段，实际请求 Normal.webp 而非
  // Icon_Normal.webp —— P0 锁定现状，修复列为开放问题（DESIGN.md §12）。
  it('converts <IconMap> marks to inline key images (drops Icon_ prefix)', () => {
    const out = richDesc('攻击键 <IconMap:Icon_Normal>')
    expect(out).toContain('<img class="rich-key"')
    expect(out).toContain('/Normal.webp')
    expect(out).not.toContain('Icon_Normal.webp')
    expect(out).toContain('alt=""')
    expect(out).toContain('loading="lazy"')
  })

  it('converts 6-digit color values', () => {
    expect(richDesc('<color=#00ff00>绿</color>')).toContain('color:#00ff00')
  })

  it('does not double-escape attribute-safe text', () => {
    expect(richDesc('ATK +10%')).toBe('ATK +10%')
  })
})
