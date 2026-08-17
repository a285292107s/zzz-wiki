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

  // 修复后（DESIGN.md §12 发现1）：本地 SVG 字形优先，零外部请求；
  // 未知名资产回退 CDN 且保留完整资产名（Icon_ 前缀）。
  it('converts known <IconMap> marks to local inline SVG glyphs (zero external requests)', () => {
    const out = richDesc('攻击键 <IconMap:Icon_Normal>')
    expect(out).toContain('<span class="rich-key">')
    expect(out).toContain('<svg')
    expect(out).toContain('aria-label="Icon_Normal"')
    expect(out).not.toContain('<img')
  })

  it('falls back to CDN image for unknown <IconMap> assets (full asset name kept)', () => {
    const out = richDesc('摇杆 <IconMap:Icon_JoyStick>')
    expect(out).toContain('<img class="rich-key"')
    expect(out).toContain('/Icon_JoyStick.webp')
    expect(out).not.toContain('/JoyStick.webp')
  })

  it('converts 6-digit color values', () => {
    expect(richDesc('<color=#00ff00>绿</color>')).toContain('color:#00ff00')
  })

  it('does not double-escape attribute-safe text', () => {
    expect(richDesc('ATK +10%')).toBe('ATK +10%')
  })
})
