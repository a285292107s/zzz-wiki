import { describe, expect, it } from 'vitest'
import {
  BANGBOO_SKILL_ORDER,
  buildBangbooSkills,
  SKILL_KEYS,
  SKILL_ORDER,
  SKILL_ZH,
  buildSkillRows,
  buildSkinRows,
  dictToRows,
  evaluateSkillFormula,
  formatSkillScalar,
  skillDetailValue,
  skillParamValue,
  SKILL_LEVEL_DEFAULT,
  type SkillParamEntry,
} from '../src/domain/sections'

describe('dictToRows', () => {
  it('returns [] for null/undefined', () => {
    expect(dictToRows(null)).toEqual([])
    expect(dictToRows(undefined)).toEqual([])
  })

  it('sorts by numeric key and maps name/desc', () => {
    const rows = dictToRows({
      '2': { name: '影画2', desc: 'd2' },
      '1': { name: '影画1', desc: 'd1' },
    })
    expect(rows.map((r) => r.no)).toEqual([1, 2])
    expect(rows[0]).toMatchObject({ no: 1, name: '影画1', desc: 'd1' })
  })

  it('tolerates entries without name/desc', () => {
    const rows = dictToRows({ '1': { other: true } })
    expect(rows[0]).toMatchObject({ no: 1 })
    expect(rows[0].name).toBeUndefined()
  })
})

describe('skill helpers', () => {
  it('SKILL_ORDER covers the six core slots in game UI order', () => {
    expect(SKILL_ORDER).toEqual(['basic', 'dodge', 'special', 'chain', 'assist', 'core'])
    expect(SKILL_ZH.basic).toBe('普通攻击')
    expect(SKILL_KEYS.core.en).toBe('CORE')
  })

  it('buildSkillRows filters missing slots and keeps order', () => {
    const rows = buildSkillRows({
      special: { description: [{ name: 'X' }] },
      basic: { description: [{ name: 'Y' }] },
    })
    expect(rows.map((r) => r.key)).toEqual(['basic', 'special'])
  })

  it('buildSkillRows returns [] for empty input', () => {
    expect(buildSkillRows(undefined)).toEqual([])
    expect(buildSkillRows({})).toEqual([])
  })

  it('buildSkillRows merges simple descriptions into groups, skipping empty-param blocks', () => {
    const rows = buildSkillRows({
      basic: {
        description: [
          { name: '普通攻击：狡兔连打', desc: '点按发动攻击。', potential: [] },
          { name: '普通攻击：为所欲为', desc: '上弹强化普攻。', potential: [] },
          { name: '普通攻击：狡兔连打', desc: '{Skill:1031001, Prop:1001}', param: [] },
          { name: '普通攻击：为所欲为', desc: '{Skill:1031002, Prop:1001}', param: [] },
        ],
      },
    })
    expect(rows).toHaveLength(1)
    const row = rows[0]
    expect(row.hasNumbers).toBe(false)
    expect(row.groups).toEqual([
      { name: '普通攻击：狡兔连打', desc: '点按发动攻击。' },
      { name: '普通攻击：为所欲为', desc: '上弹强化普攻。' },
    ])
  })

  it('buildSkillRows returns no groups when only empty-param blocks exist', () => {
    const rows = buildSkillRows({
      special: { description: [{ name: '特殊技：X', desc: '{Skill:1}', param: [] }] },
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].groups).toBeUndefined()
    expect(rows[0].hasNumbers).toBe(false)
  })
})

describe('skill detail rows', () => {
  it('buildSkillRows merges descriptions and numbers into named groups', () => {
    const rows = buildSkillRows({
      basic: {
        description: [
          { name: '普攻', desc: '点按。', potential: [] },
          {
            name: '普攻',
            param: [
              {
                name: '一段伤害倍率',
                desc: '{Skill:1031001, Prop:1001}',
                param: { '1031001': { main: 3890, growth: 360, format: '%' } },
              },
            ],
            potential: [],
          },
          {
            name: '强攻',
            param: [
              {
                name: '蓄力伤害倍率',
                desc: '{Skill:1031009, Prop:1001}',
                param: { '1031009': { main: 5000, growth: 100, format: '%' } },
              },
            ],
            potential: [],
          },
        ],
      },
    })
    expect(rows).toHaveLength(1)
    const row = rows[0]
    expect(row.hasNumbers).toBe(true)
    expect(row.groups).toHaveLength(2)
    // 普攻组：简单描述与数值合并
    expect(row.groups?.[0]).toMatchObject({ name: '普攻', desc: '点按。' })
    expect(row.groups?.[0].entries).toHaveLength(1)
    expect(row.groups?.[0].entries[0]).toMatchObject({ name: '一段伤害倍率', format: '%' })
    // 无数值对应的强攻组 desc 为空
    expect(row.groups?.[1]).toMatchObject({ name: '强攻', desc: undefined })
    expect(row.groups?.[1].entries).toHaveLength(1)
  })
})

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

  it('defaults to highest level', () => {
    expect(SKILL_LEVEL_DEFAULT).toBe(12)
  })
})

describe('buildSkinRows', () => {
  it('sorts by skin id and provides defaults', () => {
    const rows = buildSkinRows({
      '2': { name: '乙' },
      '1': { desc: '甲之描述' },
    })
    expect(rows.map((r) => r.id)).toEqual(['1', '2'])
    expect(rows[0]).toMatchObject({ id: '1', name: '', desc: '甲之描述', img: '' })
  })

  it('returns [] for empty input', () => {
    expect(buildSkinRows(null)).toEqual([])
  })
})

describe('buildBangbooSkills', () => {
  it('keeps a/b/c order and collapses levels to name + base desc', () => {
    const rows = buildBangbooSkills({
      c: { level: { '1': { name: '冰暴回旋', desc: 'dc' } } },
      a: {
        level: {
          '1': { name: '冰刀舞', desc: 'da1' },
          '2': { name: '冰刀舞', desc: 'da2' },
        },
      },
    })
    expect(rows.map((r) => r.key)).toEqual(['a', 'c'])
    expect(rows[0]).toMatchObject({ key: 'a', zh: '主动技', names: ['冰刀舞'], desc: 'da1' })
    expect(rows[1].zh).toBe('邦布连携技')
  })

  it('returns [] for empty/missing input', () => {
    expect(buildBangbooSkills(null)).toEqual([])
    expect(buildBangbooSkills({})).toEqual([])
  })

  it('BANGBOO_SKILL_ORDER is a/b/c', () => {
    expect(BANGBOO_SKILL_ORDER).toEqual(['a', 'b', 'c'])
  })
})
