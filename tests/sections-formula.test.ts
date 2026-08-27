import { describe, expect, it } from 'vitest'
import {
  evaluateSkillFormula,
  formatSkillScalar,
  skillDetailValue,
  skillParamValue,
  calTokenValue,
  parseCalToken,
  type SkillParamEntry
} from '../src/domain/sections'

describe('skill formula evaluation', () => {
  const props: Record<string, SkillParamEntry> = {
    '1031001': { main: 3890, growth: 360, format: '%' },
    '1031002': { main: 2710, growth: 250, format: '%' },
  }

  it('evaluates a single {Skill,Prop} reference at level 1', () => {
    expect(skillParamValue(props['1031001'], 1)).toBe(3890)
  })

  it('grows by main + growth*(lv-1)', () => {
    expect(skillParamValue(props['1031001'], 12)).toBe(3890 + 360 * 11)
  })

  it('evaluates a nested grouped formula', () => {
    const v = evaluateSkillFormula(
      '{Skill:1031001, Prop:1001} + {{Skill:1031002, Prop:1001}/3}*3',
      props,
      1,
    )
    expect(v).toBeCloseTo(3890 + 2710)
  })

  it('formats percent as thousandth-percent / 100 with trimmed decimals', () => {
    expect(formatSkillScalar(3890, '%')).toBe('38.9%')
    expect(formatSkillScalar(6600, '%')).toBe('66%')
    expect(formatSkillScalar(7000, undefined)).toBe('7000')
  })

  it('skillDetailValue binds level for display', () => {
    const detail = { name: '一段伤害倍率', formula: '{Skill:1031001, Prop:1001}', props, format: '%' }
    expect(skillDetailValue(detail, 1)).toBe('38.9%')
    expect(skillDetailValue(detail, 12)).toBe('78.5%')
  })

  it('skillDetailValue prefers per-level static text values (bangboo tokens)', () => {
    const detail = {
      name: '冷却时间',
      formula: '',
      props: {},
      values: ['20秒', '18秒', '16秒'],
    }
    expect(skillDetailValue(detail, 1)).toBe('20秒')
    expect(skillDetailValue(detail, 2)).toBe('18秒')
    expect(skillDetailValue(detail, 5)).toBe('16秒') // 越界钳制到末级
  })

  it('parses {CAL:…} tokens into expr/scale/decimals (units live outside the token)', () => {
    expect(parseCalToken('{CAL:0+AvatarSkillLevel(1)*1.5,1,2}%')).toEqual({
      expr: '0+AvatarSkillLevel(1)*1.5',
      scale: 1,
      decimals: 2,
    })
    expect(parseCalToken('{CAL:0.08+AvatarSkillLevel(1)*0.01,100,2}%')).toMatchObject({
      expr: '0.08+AvatarSkillLevel(1)*0.01',
      scale: 100,
    })
    expect(parseCalToken('{Skill:1031001, Prop:1001}')).toBeUndefined()
  })

  it('calTokenValue substitutes the slot level into AvatarSkillLevel (value only)', () => {
    const cal = parseCalToken('{CAL:0+AvatarSkillLevel(1)*1.5,1,2}%')!
    expect(calTokenValue(cal, 1)).toBe('1.5')
    expect(calTokenValue(cal, 12)).toBe('18')
  })

  it('calTokenValue applies the ×100 scale to fraction-form exprs and trims decimals', () => {
    const cal = parseCalToken('{CAL:0.08+AvatarSkillLevel(1)*0.01,100,2}%')!
    expect(calTokenValue(cal, 1)).toBe('9')
    expect(calTokenValue(cal, 12)).toBe('20')
  })

  it('calTokenValue handles constant exprs', () => {
    const cal = parseCalToken('{CAL:16+AvatarSkillLevel(1)*2,1,2}秒')!
    expect(calTokenValue(cal, 1)).toBe('18')
    expect(calTokenValue(cal, 12)).toBe('40')
  })

  it('skillDetailValue resolves {CAL:…} formulas without a {Skill:} prop table', () => {
    const detail = { name: '伤害提升', formula: '{CAL:0+AvatarSkillLevel(1)*1.5,1,2}%', props: {}, format: undefined }
    expect(skillDetailValue(detail, 1)).toBe('1.5%')
    expect(skillDetailValue(detail, 12)).toBe('18%')
  })

  it('skillDetailValue resolves every {CAL:…} token in text-bearing entries (露西 加油！)', () => {
    const detail = {
      name: '攻击力提升',
      formula: '露西攻击力{CAL:13+AvatarSkillLevel(1)*0.8,1,2}%+{CAL:40+AvatarSkillLevel(1)*4,1,2}',
      props: {},
    }
    expect(skillDetailValue(detail, 1)).toBe('露西攻击力13.8%+44')
    expect(skillDetailValue(detail, 12)).toBe('露西攻击力22.6%+88')
    // 不向 DOM 泄漏原始标记（上一条目曾把第二个 {CAL:…} 原文带出）
    expect(skillDetailValue(detail, 12)).not.toContain('{CAL')
  })
})

