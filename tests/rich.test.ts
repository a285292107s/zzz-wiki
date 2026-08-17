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

  // 回退方案（用户确认，DESIGN.md §12 发现1 关联）：技能图标回 dbc0c72 CDN 官方图形态。
  // 捕获组保留完整资产名（Icon_ 前缀），避免请求丢前缀的 404 URL。
  it('converts <IconMap> marks to inline CDN key images (full asset name)', () => {
    const out = richDesc('攻击键 <IconMap:Icon_Normal>')
    expect(out).toContain('<img class="rich-key"')
    expect(out).toContain('/Icon_Normal.webp')
    expect(out).not.toContain('/Normal.webp')
    expect(out).toContain('alt=""')
    expect(out).toContain('loading="lazy"')
  })

  it('uses full asset name for unknown <IconMap> assets too', () => {
    const out = richDesc('摇杆 <IconMap:Icon_JoyStick>')
    expect(out).toContain('/Icon_JoyStick.webp')
  })

  it('converts 6-digit color values', () => {
    expect(richDesc('<color=#00ff00>绿</color>')).toContain('color:#00ff00')
  })

  it('does not double-escape attribute-safe text', () => {
    expect(richDesc('ATK +10%')).toBe('ATK +10%')
  })
})