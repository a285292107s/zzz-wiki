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

  it('renders build-resolved Term tags as hoverable anchors keeping the inner color span', () => {
    // 构建期 resolveTerms 产出 <Term:N><color=#…>[名]</color>；richDesc 包锚点并保留内嵌色。
    // 锚点不带 href：TermTip 悬停/聚焦即可弹浮层，点击不产生无目标跳转/URL 噪音。
    expect(richDesc('当蕾米埃尔身上储存有<Term:1000033><color=#FFFFFF>[虚曜]</color></Term>时')).toBe(
      '当蕾米埃尔身上储存有<a class="rich-term" data-term-id="1000033" tabindex="0"><span style="color:#FFFFFF">[虚曜]</span></a>时',
    )
  })

  it('keeps the color a Term tag was wrapped in at build time', () => {
    // 源站 <color=#FFFFFF><Term:1000010></Term></color> → 构建期扁平化为 <Term:1000010><color…>[名]</color>
    expect(richDesc('<Term:1000010><color=#FFFFFF>[随行礼帽]</color></Term>会自动攻击')).toBe(
      '<a class="rich-term" data-term-id="1000010" tabindex="0"><span style="color:#FFFFFF">[随行礼帽]</span></a>会自动攻击',
    )
  })

  it('does not leak raw Term markup when the name is missing (stripped at build)', () => {
    const out = richDesc('a<Term:9999999></Term>b')
    expect(out).not.toContain('<Term')
    expect(out).toContain('a')
    expect(out).toContain('b')
  })

  it('does not leak unknown <...> or {...} markup as raw text', () => {
    const out = richDesc('a <b>c</b> d {Skill:1, Prop:2}')
    expect(out).not.toContain('<b>')
    expect(out).not.toContain('{Skill')
    expect(out).toContain('a')
  })

  it('resolves {CAL:…} tokens against the given skill level inside kept color spans', () => {
    const out = richDesc(
      '蕾米埃尔会使全队角色造成的伤害提升<color=#2BAD00>{CAL:0+AvatarSkillLevel(1)*1.5,1,2}%</color>，持续60秒',
      12,
    )
    expect(out).toContain('伤害提升<span style="color:#2BAD00">18%</span>，持续60秒')
    expect(out).not.toContain('{CAL')
  })

  it('substitutes a lower skill level into {CAL:…} tokens', () => {
    const out = richDesc('伤害提升<color=#2BAD00>{CAL:0+AvatarSkillLevel(1)*1.5,1,2}%</color>', 1)
    expect(out).toContain('伤害提升<span style="color:#2BAD00">1.5%</span>')
  })

  it('strips {CAL:…} tokens when no level context is given (no raw leak)', () => {
    const out = richDesc('伤害提升{CAL:0+AvatarSkillLevel(1)*1.5,1,2}%')
    expect(out).not.toContain('{CAL')
    expect(out).toContain('伤害提升')
  })
})