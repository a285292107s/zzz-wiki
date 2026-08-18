import { describe, expect, it } from 'vitest'
import {
  BANGBOO_SKILL_ORDER,
  buildBangbooSkills,
  SKILL_KEYS,
  SKILL_ORDER,
  SKILL_ZH,
  buildSkillRows,
  buildSkinRows,
  CHAR_LEVEL_DEFAULT,
  CHAR_LEVEL_MAX,
  CHAR_LEVEL_MIN,
  charBreakSegment,
  charExtraBonus,
  characterStatsAtLevel,
  dictToRows,
  evaluateSkillFormula,
  formatSkillScalar,
  skillDetailValue,
  skillParamValue,
  SKILL_LEVEL_DEFAULT,
  statAtLevel,
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

/* ---------- 角色等级属性（「11号」1041 真实数据，锚点对照游戏内面板） ---------- */

const lvl11 = {
  stats: {
    hp_max: 617,
    hp_growth: 837238,
    attack: 128,
    attack_growth: 77554,
    defence: 49,
    defence_growth: 66882,
    break_stun: 93,
    crit: 500,
    crit_damage: 5000,
    pen_rate: 0,
    element_mystery: 93,
    element_abnormal_power: 94,
    sp_recover: 120,
  },
  level: {
    '1': { hp_max: 0, attack: 0, defence: 0, level_max: 10, level_min: 0 },
    '2': { hp_max: 423, attack: 46, defence: 34, level_max: 20, level_min: 10 },
    '3': { hp_max: 847, attack: 91, defence: 68, level_max: 30, level_min: 20 },
    '4': { hp_max: 1270, attack: 137, defence: 101, level_max: 40, level_min: 30 },
    '5': { hp_max: 1694, attack: 183, defence: 135, level_max: 50, level_min: 40 },
    '6': { hp_max: 2117, attack: 228, defence: 169, level_max: 60, level_min: 50 },
  },
  extra_level: {
    '1': { max_level: 15, extra: { '12101': { prop: 12101, value: 0 }, '20101': { prop: 20101, value: 480 } } },
    '2': { max_level: 25, extra: { '12101': { prop: 12101, value: 25 }, '20101': { prop: 20101, value: 480 } } },
    '3': { max_level: 35, extra: { '12101': { prop: 12101, value: 25 }, '20101': { prop: 20101, value: 960 } } },
    '4': { max_level: 45, extra: { '12101': { prop: 12101, value: 50 }, '20101': { prop: 20101, value: 960 } } },
    '5': { max_level: 55, extra: { '12101': { prop: 12101, value: 50 }, '20101': { prop: 20101, value: 1440 } } },
    '6': { max_level: 60, extra: { '12101': { prop: 12101, value: 75 }, '20101': { prop: 20101, value: 1440 } } },
  },
}

describe('character level stats', () => {
  it('CHAR_LEVEL range is 1–60 with default at max', () => {
    expect(CHAR_LEVEL_MIN).toBe(1)
    expect(CHAR_LEVEL_MAX).toBe(60)
    expect(CHAR_LEVEL_DEFAULT).toBe(60)
  })

  it('statAtLevel floors base + break bonus + growth/10000 × (lv-1)', () => {
    expect(statAtLevel(617, 837238, 0, 1)).toBe(617)
    expect(statAtLevel(617, 837238, 0, 10)).toBe(1370)
    expect(statAtLevel(617, 837238, 423, 20)).toBe(2630)
    expect(statAtLevel(617, 837238, 2117, 60)).toBe(7673)
  })

  it('statAtLevel clamps lv below 1 to avoid negative growth', () => {
    expect(statAtLevel(617, 837238, 0, 0)).toBe(617)
    expect(statAtLevel(617, 837238, 0, -5)).toBe(617)
  })

  it('charBreakSegment picks the phase by (min, max]', () => {
    expect(charBreakSegment(lvl11.level, 1)?.phase).toBe(1)
    expect(charBreakSegment(lvl11.level, 10)?.phase).toBe(1)
    expect(charBreakSegment(lvl11.level, 11)?.phase).toBe(2)
    expect(charBreakSegment(lvl11.level, 60)?.phase).toBe(6)
    expect(charBreakSegment(undefined, 30)).toBeNull()
  })

  it('charExtraBonus picks accumulated potential up to max_level', () => {
    expect(charExtraBonus(lvl11.extra_level, 1)).toEqual({ attack: 0, crit: 0 })
    expect(charExtraBonus(lvl11.extra_level, 15)).toEqual({ attack: 0, crit: 480 })
    expect(charExtraBonus(lvl11.extra_level, 25)).toEqual({ attack: 25, crit: 480 })
    expect(charExtraBonus(lvl11.extra_level, 60)).toEqual({ attack: 75, crit: 1440 })
    expect(charExtraBonus(undefined, 60)).toEqual({ attack: 0, crit: 0 })
  })

  it('matches the in-game panel at every 10-level anchor', () => {
    const at = (lv: number) => {
      const rows = characterStatsAtLevel(lvl11.stats, lvl11.level, lv)
      const get = (label: string) => rows.find((r) => r.label === label)?.value
      return { hp: get('生命值'), atk: get('攻击力'), def: get('防御力') }
    }
    expect(at(1)).toEqual({ hp: '617', atk: '128', def: '49' })
    expect(at(10)).toEqual({ hp: '1370', atk: '197', def: '109' })
    expect(at(20)).toEqual({ hp: '2630', atk: '321', def: '210' })
    expect(at(30)).toEqual({ hp: '3891', atk: '443', def: '310' })
    expect(at(40)).toEqual({ hp: '5152', atk: '567', def: '410' })
    expect(at(50)).toEqual({ hp: '6413', atk: '691', def: '511' })
    expect(at(60)).toEqual({ hp: '7673', atk: '813', def: '612' })
  })

  it('keeps non-scaling stats and percent formatting stable', () => {
    const rows = characterStatsAtLevel(lvl11.stats, lvl11.level, 60)
    const get = (label: string) => rows.find((r) => r.label === label)?.value
    expect(get('暴击率')).toBe('5.00%')
    expect(get('暴击伤害')).toBe('50.00%')
    expect(get('穿透率')).toBe('0.00%')
    expect(get('冲击力')).toBe('93')
    expect(get('异常掌控')).toBe('93')
    expect(get('异常精通')).toBe('94')
    expect(get('能量回复')).toBe('120')
  })

  it('returns [] for missing stats and null breaks for empty level', () => {
    expect(characterStatsAtLevel(undefined, lvl11.level, 60)).toEqual([])
    expect(charBreakSegment({}, 30)).toBeNull()
  })
})
