import { describe, expect, it } from 'vitest'
import {
  bangbooBreakCount,
  bangbooStatsAtLevel,
  buildCoreEnhance,
  charBreakSegment,
  characterStatsAtLevel,
  coreEnhanceTotal,
  formatCoreEnhance,
  statAtLevel,
  wEngineBreakCount,
  wEngineMainAt,
  wEnginePropsAtLevel,
  wEngineRandAt
} from '../src/domain/sections'

describe('character level stats', () => {
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

  it('buildCoreEnhance parses extra_level into per-rank increments (A-F)', () => {
    const enhance = buildCoreEnhance(lvl11.extra_level)
    expect(enhance).toHaveLength(6)
    expect(enhance.map((l) => l.no)).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
    expect(enhance.map((l) => l.unlockAt)).toEqual([15, 25, 35, 45, 55, 60])
    // 档 A：暴击率 +4.8%（0 增量的基础攻击力被过滤）；增量携带属性码（prop）
    expect(enhance[0].bonus).toEqual([
      { prop: 20101, name: '暴击率', value: 480, format: '{0:0.#%}', text: '4.8%' },
    ])
    // 两属性交替递增：每档只有一项新增（与游戏面板一致，而非累计值）
    expect(enhance.map((l) => l.bonus.map((b) => b.name))).toEqual([
      ['暴击率'],
      ['基础攻击力'],
      ['暴击率'],
      ['基础攻击力'],
      ['暴击率'],
      ['基础攻击力'],
    ])
    // 档 F：基础攻击力 +25（暴击率本档无新增，已过滤）
    expect(enhance[5].bonus.map((b) => `${b.name}+${b.text}`)).toEqual([
      '基础攻击力+25',
    ])
  })

  it('coreEnhanceTotal sums per-rank increments to max-level totals', () => {
    const enhance = buildCoreEnhance(lvl11.extra_level)
    // 顺序 = 首次出现序（档 A 先出暴击率，档 B 再出基础攻击力）
    expect(coreEnhanceTotal(enhance).map((b) => `${b.name}+${b.text}`)).toEqual([
      '暴击率+14.4%',
      '基础攻击力+75',
    ])
    expect(coreEnhanceTotal([])).toEqual([])
  })

  it('coreEnhanceTotal merges by prop code: same-name different-prop stay separate rows', () => {
    // 同名异码（如 11101/11102 生命值）分行展示，不因中文名相同而互相累加
    const levels = [
      { no: 'A', unlockAt: 15, bonus: [{ prop: 11101, name: '生命值', value: 100, format: '{0:0}', text: '100' }] },
      { no: 'B', unlockAt: 25, bonus: [{ prop: 11102, name: '生命值', value: 50, format: '{0:0}', text: '50' }] },
      { no: 'C', unlockAt: 35, bonus: [{ prop: 11101, name: '生命值', value: 100, format: '{0:0}', text: '100' }] },
    ]
    expect(coreEnhanceTotal(levels).map((b) => `${b.name}+${b.value}`)).toEqual([
      '生命值+200',
      '生命值+50',
    ])
  })

  it('buildCoreEnhance scales base energy regen by 1/100 (raw 12 → 0.12/s)', () => {
    const enhance = buildCoreEnhance({
      '1': { max_level: 15, extra: { '30501': { prop: 30501, name: '基础能量自动回复', format: '{0:0.##}', value: 12 } } },
      '2': { max_level: 25, extra: { '30501': { prop: 30501, name: '基础能量自动回复', format: '{0:0.##}', value: 12 } } },
      '3': { max_level: 35, extra: { '30501': { prop: 30501, name: '基础能量自动回复', format: '{0:0.##}', value: 24 } } },
      '4': { max_level: 45, extra: { '30501': { prop: 30501, name: '基础能量自动回复', format: '{0:0.##}', value: 24 } } },
      '5': { max_level: 55, extra: { '30501': { prop: 30501, name: '基础能量自动回复', format: '{0:0.##}', value: 36 } } },
      '6': { max_level: 60, extra: { '30501': { prop: 30501, name: '基础能量自动回复', format: '{0:0.##}', value: 36 } } },
    })
    expect(enhance.map((l) => `${l.no}:${l.bonus.map((b) => b.text).join(',')}`)).toEqual([
      'A:0.12',
      'B:',
      'C:0.12',
      'D:',
      'E:0.12',
      'F:',
    ])
    expect(coreEnhanceTotal(enhance).map((b) => `${b.name}+${b.text}`)).toEqual([
      '基础能量自动回复+0.36',
    ])
  })

  it('formatCoreEnhance follows hakushin format strings', () => {
    expect(formatCoreEnhance(480, '{0:0.#%}')).toBe('4.8%')
    expect(formatCoreEnhance(2880, '{0:0.#%}')).toBe('28.8%')
    expect(formatCoreEnhance(75, '{0:0.#}')).toBe('75')
    expect(formatCoreEnhance(1800, '{0:0}')).toBe('1800')
    expect(formatCoreEnhance(36, '{0:0.##}')).toBe('36')
  })

  it('buildCoreEnhance returns [] for missing input and filters zero bonuses', () => {
    expect(buildCoreEnhance(undefined)).toEqual([])
    expect(buildCoreEnhance(null)).toEqual([])
    expect(buildCoreEnhance({})).toEqual([])
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

/* ---------- 核心技（passive：核心被动 + 额外能力） ---------- */

/** 「11号」1041 核心技（7 级，额外能力各级一致） */
describe('wEngineMainAt', () => {
  it('matches BWIKI breakpoints within ±1 (game-internal rounding)', () => {
    for (const c of ENGINE_CASES) {
      c.breakpoints.forEach((v, i) => {
        const got = wEngineMainAt(10 * (i + 1), c.base, c.max)
        expect(Math.abs(got - v)).toBeLessThanOrEqual(1)
      })
    }
  })

  it('clamps at level 1 and max level', () => {
    expect(wEngineMainAt(0, 50, 743)).toBe(50)
    expect(wEngineMainAt(1, 50, 743)).toBe(50)
    expect(wEngineMainAt(60, 50, 743)).toBe(743)
    expect(wEngineMainAt(99, 50, 743)).toBe(743)
  })

  it('monotonically grows inside a segment', () => {
    const lv10 = wEngineMainAt(10, 50, 743)
    const lv19 = wEngineMainAt(19, 50, 743)
    const lv20 = wEngineMainAt(20, 50, 743)
    expect(lv10).toBeLessThan(lv19)
    expect(lv19).toBeLessThan(lv20)
    expect(lv20).toBe(296)
  })
})

describe('wEngineRandAt', () => {
  it('scales by 1.3 per break stage, capped at 2.5x', () => {
    for (const [base, ladder] of RAND_CASES) {
      ladder.forEach((v, seg) => {
        expect(wEngineRandAt(seg < 2 ? seg * 5 + 9 : seg * 10, base)).toBe(v)
      })
    }
  })

  it('keeps Lv.50-60 at final stage', () => {
    expect(wEngineRandAt(50, 960)).toBe(2400)
    expect(wEngineRandAt(60, 960)).toBe(2400)
  })
})

describe('wEngineBreakCount', () => {
  it('counts breaks per 10 levels', () => {
    expect([1, 9, 10, 19, 20, 49, 50, 60].map(wEngineBreakCount)).toEqual([0, 0, 1, 1, 2, 4, 5, 5])
  })
})

describe('wEnginePropsAtLevel', () => {
  it('builds main + sub stat items at level', () => {
    const items = wEnginePropsAtLevel(60, { name: '基础攻击力', value: 50 }, { name: '暴击率', value: 960, format: '{0:0.#%}' }, 743)
    expect(items).toEqual([
      { label: '基础攻击力', value: '743', tag: '主属性' },
      { label: '暴击率', value: '24.00%', tag: '副属性' },
    ])
  })

  it('falls back to static Lv.1 values when atk_max missing', () => {
    const items = wEnginePropsAtLevel(60, { name: '基础攻击力', value: 50 }, { name: '暴击率', value: 960, format: '{0:0.#%}' }, undefined)
    expect(items[0].value).toBe('50')
    expect(items[1].value).toBe('24.00%')
  })

  it('returns [] when properties are missing', () => {
    expect(wEnginePropsAtLevel(1, null, null, 743)).toEqual([])
  })
})

/* ---------- 邦布基础数值（等级滑条） ---------- */

/** 企鹅布（53001，A）stats + level 字面量（与 public/data 一致） */
const PENGUIN_STATS = {
  endurance: 180,
  hp_max: 360,
  hpupgrade: 428397,
  attack: 50,
  attack_upgrade: 252034,
  break_stun: 90,
  element_abnormal_power: 120,
  defence: 30,
  def_upgrade: 85729,
  crit: 500,
  crit_dmg: 5000,
}

const PENGUIN_LEVEL: Record<string, unknown> = {
  '1': { hp_max: 0, attack: 0, defence: 0, level_min: 0, level_max: 10, extra: { '20101': { value: 0 }, '21101': { value: 0 } } },
  '2': { hp_max: 188, attack: 47, defence: 38, level_min: 10, level_max: 20, extra: { '20101': { value: 450 }, '21101': { value: 0 } } },
  '3': { hp_max: 376, attack: 233, defence: 75, level_min: 20, level_max: 30, extra: { '20101': { value: 2250 }, '21101': { value: 0 } } },
  '4': { hp_max: 564, attack: 699, defence: 113, level_min: 30, level_max: 40, extra: { '20101': { value: 2250 }, '21101': { value: 2500 } } },
  '5': { hp_max: 752, attack: 1864, defence: 151, level_min: 40, level_max: 50, extra: { '20101': { value: 4500 }, '21101': { value: 2500 } } },
  '6': { hp_max: 940, attack: 4661, defence: 188, level_min: 50, level_max: 60, extra: { '20101': { value: 4500 }, '21101': { value: 5000 } } },
}

const valueOf = (items: ReturnType<typeof bangbooStatsAtLevel>, label: string) =>
  items.find((i) => i.label === label)?.value

describe('bangbooStatsAtLevel', () => {
  it('matches BWIKI panel for 企鹅布 across all break breakpoints', () => {
    // [lv, 生命值, 攻击力, 防御力, 暴击率, 暴击伤害]（突破后口径）
    const expected: Array<[number, string, string, string, string, string]> = [
      [1, '360', '50', '30', '5.00%', '50.00%'],
      [10, '933', '323', '145', '9.50%', '50.00%'],
      [20, '1549', '761', '267', '27.50%', '50.00%'],
      [30, '2166', '1479', '391', '27.50%', '75.00%'],
      [40, '2782', '2896', '515', '50.00%', '75.00%'],
      [50, '3399', '5945', '638', '50.00%', '100.00%'],
      [60, '3827', '6198', '723', '50.00%', '100.00%'],
    ]
    for (const [lv, hp, atk, def, crit, critDmg] of expected) {
      const items = bangbooStatsAtLevel(PENGUIN_STATS, PENGUIN_LEVEL, lv)
      expect(valueOf(items, '生命值'), `Lv.${lv} 生命值`).toBe(hp)
      expect(valueOf(items, '攻击力'), `Lv.${lv} 攻击力`).toBe(atk)
      expect(valueOf(items, '防御力'), `Lv.${lv} 防御力`).toBe(def)
      expect(valueOf(items, '暴击率'), `Lv.${lv} 暴击率`).toBe(crit)
      expect(valueOf(items, '暴击伤害'), `Lv.${lv} 暴击伤害`).toBe(critDmg)
    }
  })

  it('keeps static stats constant across levels', () => {
    const items1 = bangbooStatsAtLevel(PENGUIN_STATS, PENGUIN_LEVEL, 1)
    const items60 = bangbooStatsAtLevel(PENGUIN_STATS, PENGUIN_LEVEL, 60)
    for (const label of ['冲击力', '异常掌控', '能量回复']) {
      expect(valueOf(items60, label)).toBe(valueOf(items1, label))
    }
    expect(valueOf(items60, '冲击力')).toBe('90')
    expect(valueOf(items60, '异常掌控')).toBe('120')
  })

  it('handles stats without extra and missing level dict', () => {
    const noExtra = bangbooStatsAtLevel(PENGUIN_STATS, undefined, 60)
    // 无突破段时仅按成长推算（growth/10000 × (L-1)），不叠加段加成
    expect(valueOf(noExtra, '生命值')).toBe('2887')
    expect(valueOf(noExtra, '暴击率')).toBe('5.00%')
    expect(bangbooStatsAtLevel(undefined, PENGUIN_LEVEL, 60)).toEqual([])
  })
})

describe('bangbooBreakCount', () => {
  it('counts breaks per 10 levels', () => {
    expect([1, 9, 10, 19, 20, 49, 50, 60].map(bangbooBreakCount)).toEqual([0, 0, 1, 1, 2, 4, 5, 5])
  })
})

/* ---------- 邦布技能数值（skill param + skill_prop） ---------- */

/** 企鹅布（53001）技能 a/b/c 字面量（与 public/data 一致，仅保留关键字段） */

const RAND_CASES: Array<[number, number[]]> = [
  [960, [960, 1248, 1536, 1824, 2112, 2400]],
  [600, [600, 780, 960, 1140, 1320, 1500]],
  [2000, [2000, 2600, 3200, 3800, 4400, 5000]],
]

const ENGINE_CASES = [
  { base: 48, max: 713, breakpoints: [166, 284, 402, 520, 638] },
  { base: 50, max: 743, breakpoints: [173, 296, 418, 542, 665] },
  { base: 40, max: 594, breakpoints: [138, 236, 335, 433, 532] },
  { base: 32, max: 475, breakpoints: [110, 189, 268, 346, 425] },
]

/** 副属性断点：暴击率 9.6→24、冲击力 6→15、能量回复 20→50（万分数） */

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
    '1': { max_level: 15, extra: { '12101': { prop: 12101, name: '基础攻击力', format: '{0:0.#}', value: 0 }, '20101': { prop: 20101, name: '暴击率', format: '{0:0.#%}', value: 480 } } },
    '2': { max_level: 25, extra: { '12101': { prop: 12101, name: '基础攻击力', format: '{0:0.#}', value: 25 }, '20101': { prop: 20101, name: '暴击率', format: '{0:0.#%}', value: 480 } } },
    '3': { max_level: 35, extra: { '12101': { prop: 12101, name: '基础攻击力', format: '{0:0.#}', value: 25 }, '20101': { prop: 20101, name: '暴击率', format: '{0:0.#%}', value: 960 } } },
    '4': { max_level: 45, extra: { '12101': { prop: 12101, name: '基础攻击力', format: '{0:0.#}', value: 50 }, '20101': { prop: 20101, name: '暴击率', format: '{0:0.#%}', value: 960 } } },
    '5': { max_level: 55, extra: { '12101': { prop: 12101, name: '基础攻击力', format: '{0:0.#}', value: 50 }, '20101': { prop: 20101, name: '暴击率', format: '{0:0.#%}', value: 1440 } } },
    '6': { max_level: 60, extra: { '12101': { prop: 12101, name: '基础攻击力', format: '{0:0.#}', value: 75 }, '20101': { prop: 20101, name: '暴击率', format: '{0:0.#%}', value: 1440 } } },
  },
}
