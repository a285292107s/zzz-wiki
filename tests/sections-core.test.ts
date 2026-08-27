import { describe, expect, it } from 'vitest'
import {
  buildCoreSkill,
  buildPotentialCinema
} from '../src/domain/sections'

describe('buildCoreSkill', () => {
  it('parses passive.level into ordered core passive + extra ability rows', () => {
    const core = buildCoreSkill(lvl11Passive)
    expect(core).not.toBeNull()
    expect(core?.coreName).toBe('核心被动：热浪')
    expect(core?.extraName).toBe('额外能力：燎原')
    expect(core?.levels).toHaveLength(3)
    expect(core?.levels.map((l) => l.no)).toEqual([1, 2, 3])
    expect(core?.levels[0].desc[0]).toContain('35%')
    expect(core?.levels[2].desc[0]).toContain('70%')
    expect(core?.levels[0].desc[1]).toContain('火属性伤害提升10%')
  })

  it('keeps raw rich-text markers in desc for the display layer', () => {
    const core = buildCoreSkill(lvl11Passive)
    expect(core?.levels[0].desc[0]).toContain('<color=#2BAD00>')
  })

  it('returns null for missing/empty passive or level', () => {
    expect(buildCoreSkill(undefined)).toBeNull()
    expect(buildCoreSkill(null)).toBeNull()
    expect(buildCoreSkill({})).toBeNull()
    expect(buildCoreSkill({ level: {} })).toBeNull()
  })

  it('filters records without name/desc arrays', () => {
    const core = buildCoreSkill({
      level: {
        '1': { level: 1, name: ['核心被动：X', '额外能力：Y'], desc: ['a', 'b'] },
        '2': { level: 2 },
        '3': { level: 3, name: ['核心被动：X', '额外能力：Y'], desc: ['c', 'd'] },
      },
    })
    expect(core?.levels).toHaveLength(2)
  })

  it('marks the second 1-7 round as enhanced (14-record S-rank structure)', () => {
    const core = buildCoreSkill({
      level: Object.fromEntries(
        [...Array(14)].map((_, i) => [
          String(9001 + i),
          {
            level: (i % 7) + 1,
            name: ['核心被动：X', '额外能力：Y'],
            desc: [`核心 ${(i % 7) + 1} ${i < 7 ? '基础' : '强化'}`, '额外描述'],
          },
        ]),
      ),
    })
    expect(core).not.toBeNull()
    expect(core?.levelCount).toBe(7)
    expect(core?.hasEnhance).toBe(true)
    expect(core?.levels).toHaveLength(14)
    expect(core?.levels[0]).toMatchObject({ level: 1, enhanced: false })
    expect(core?.levels[6]).toMatchObject({ level: 7, enhanced: false })
    expect(core?.levels[7]).toMatchObject({ level: 1, enhanced: true })
    expect(core?.levels[13]).toMatchObject({ level: 7, enhanced: true })
    expect(core?.levels[7].desc[0]).toContain('强化')
  })

  it('carries 潜能影像档位（potentialTag）到强化版核心技', () => {
    const core = buildCoreSkill({
      level: {
        '1191501': { level: 1, name: ['凌牙厉齿', '风暴潮'], desc: ['基础', '旧'], potential: [0] },
        '1191508': { level: 1, name: ['凌牙厉齿', '风暴潮'], desc: ['带潜能', '新'], potential: [119100, 119101] },
      },
    })
    expect(core).not.toBeNull()
    expect(core?.levels[0].potentialTag).toBeUndefined()
    expect(core?.levels[1].potentialTag).toBe('I')
  })

  it('keeps enhanced=false for a single 7-record round', () => {
    const core = buildCoreSkill(lvl11Passive)
    expect(core?.levelCount).toBe(3)
    expect(core?.hasEnhance).toBe(false)
    expect(core?.levels.every((l) => !l.enhanced)).toBe(true)
  })
})

/* ---------- 潜能影像（potential_detail，V2.5 激发潜能） ---------- */

const lvl11Potential = {
  '104100': {
    id: 104100,
    name: '',
    desc: '',
    level_show_name: '炽焰行歌 I',
    level: 1,
    ability_list: [11041501],
  },
  '104101': {
    id: 104101,
    name: '潜能觉醒：绝焰',
    desc: '[额外能力：燎原]中，「11号」自身暴击伤害提升<color=#2BAD00>16%</color>。',
    level_show_name: '炽焰行歌 II',
    level: 2,
  },
  '104105': {
    id: 104105,
    name: '潜能觉醒：绝焰',
    desc: '[额外能力：燎原]中，「11号」自身暴击伤害提升<color=#2BAD00>48%</color>。',
    level_show_name: '炽焰行歌 VI',
    level: 6,
  },
}

describe('buildPotentialCinema', () => {
  it('parses potential_detail into ordered I-VI levels', () => {
    const rows = buildPotentialCinema(lvl11Potential)
    expect(rows.map((r) => r.no)).toEqual(['I', 'II', 'VI'])
    expect(rows.map((r) => r.label)).toEqual(['炽焰行歌 I', '炽焰行歌 II', '炽焰行歌 VI'])
  })

  it('keeps name/desc and raw rich-text markers', () => {
    const rows = buildPotentialCinema(lvl11Potential)
    expect(rows[1].name).toBe('潜能觉醒：绝焰')
    expect(rows[1].desc).toContain('<color=#2BAD00>')
    expect(rows[1].desc).toContain('16%')
    // 档 I：无 name/desc（机制补强无文字）
    expect(rows[0].name).toBe('')
    expect(rows[0].desc).toBe('')
  })

  it('returns [] for missing/empty input', () => {
    expect(buildPotentialCinema(undefined)).toEqual([])
    expect(buildPotentialCinema(null)).toEqual([])
    expect(buildPotentialCinema({})).toEqual([])
  })
})

/* ---------- 音擎基础属性（等级滑条） ---------- */

/** BWIKI 详细面板断点（突破后口径）：残心青囊 S 48→713、霰落星殿 S 50→743、星徽引擎 A 40→594、月相-朔 B 32→475 */

const lvl11Passive = {
  level: {
    '1041501': {
      level: 1,
      name: ['核心被动：热浪', '额外能力：燎原'],
      desc: ['伤害提升<color=#2BAD00>35%</color>。', '队伍中存在同属性或阵营角色时触发：火属性伤害提升10%。'],
    },
    '1041502': {
      level: 2,
      name: ['核心被动：热浪', '额外能力：燎原'],
      desc: ['伤害提升<color=#2BAD00>40.8%</color>。', '队伍中存在同属性或阵营角色时触发：火属性伤害提升10%。'],
    },
    '1041507': {
      level: 7,
      name: ['核心被动：热浪', '额外能力：燎原'],
      desc: ['伤害提升<color=#2BAD00>70%</color>。', '队伍中存在同属性或阵营角色时触发：火属性伤害提升10%。'],
    },
  },
}
