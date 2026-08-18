import { describe, expect, it } from 'vitest'
import { richDesc } from '../src/utils/rich'

describe('richDesc', () => {
  it('keeps LAYOUT_FALLBACK content from the console/fallback pair', () => {
    expect(richDesc('拖曳{LAYOUT_CONSOLECONTROLLER#操作杆}{LAYOUT_FALLBACK#摇杆}发动闪避后')).toBe(
      '拖曳摇杆发动闪避后',
    )
  })

  it('keeps the label of a standalone LAYOUT_ variant', () => {
    expect(richDesc('{LAYOUT_MOBILE#点按}释放')).toBe('点按释放')
  })

  it('wraps hex-colored text in a span', () => {
    expect(richDesc('造成<color=#F0D12B>物理伤害</color>。')).toContain(
      '<span style="color:#F0D12B">物理伤害</span>',
    )
  })

  it('strips non-hex color keywords and keeps inner text', () => {
    expect(richDesc('<color=#POSITIVE_WITH_GREYITE>+15%</color>')).toBe('+15%')
  })

  it('turns IconMap into an inline key image', () => {
    expect(richDesc('点按 <IconMap:Icon_Normal> 发动')).toContain('<img')
  })

  it('attaches data-cdn to IconMap img for global error fallback', () => {
    const out = richDesc('点按 <IconMap:Icon_Special> 发动：')
    // 本地缺失时仍带 CDN 候选，供 main.ts 的全局 error 捕获降级
    expect(out).toContain('data-cdn="https://static.nanoka.cc/assets/zzz/Icon_Special.webp"')
    expect(out).toMatch(/<img class="rich-key" src="\/data\/img\/skill\/Icon_Special\.webp"/)
  })

  it('strips empty Term tags', () => {
    expect(richDesc('<Term:1000024></Term>测试')).toBe('测试')
  })

  it('does not leak unknown <...> or {...} markup as raw text', () => {
    const out = richDesc('a <b>c</b> d {Skill:1, Prop:2}')
    expect(out).not.toContain('<b>')
    expect(out).not.toContain('{Skill')
    expect(out).toContain('a')
  })
})