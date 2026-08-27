import { describe, expect, it } from 'vitest'
import {
  buildMoveRows,
  buildSkillRows,
  buildSkinRows,
  dictToRows
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

  it('maps desc2 lore text passthrough', () => {
    const rows = dictToRows({ '1': { name: '影画1', desc: 'd1', desc2: '寒风是凛冬的前兆。' } })
    expect(rows[0].desc2).toBe('寒风是凛冬的前兆。')
    const rows2 = dictToRows({ '1': { name: '影画1' } })
    expect(rows2[0].desc2).toBeUndefined()
  })

  it('tolerates entries without name/desc', () => {
    const rows = dictToRows({ '1': { other: true } })
    expect(rows[0]).toMatchObject({ no: 1 })
    expect(rows[0].name).toBeUndefined()
  })
})

describe('buildMoveRows（出招表 skill_list）', () => {
  it('returns [] for null/undefined', () => {
    expect(buildMoveRows(null)).toEqual([])
    expect(buildMoveRows(undefined)).toEqual([])
  })

  it('sorts by numeric id and maps name/desc', () => {
    const rows = buildMoveRows({
      '1201002': {
        name: '普通攻击：穿云（四、五段）',
        desc: '<IconMap:Icon_Normal>',
        element_type: 203,
        hit_type: 103,
        potential: [],
      },
      '1201001': {
        name: '普通攻击：穿云（一、二、三段）',
        desc: '<IconMap:Icon_Normal>',
        element_type: 200,
        hit_type: 103,
        potential: [],
      },
    })
    expect(rows.map((r) => r.id)).toEqual(['1201001', '1201002'])
    expect(rows[0]).toMatchObject({
      id: '1201001',
      name: '普通攻击：穿云（一、二、三段）',
      desc: '<IconMap:Icon_Normal>',
    })
  })

  it('skips entries without name or desc', () => {
    const rows = buildMoveRows({
      '1': { name: 'x' },
      '2': { desc: 'd' },
      '3': { other: true },
    })
    expect(rows).toEqual([])
  })

  it('keeps potential-gated moves (纯操作参考不因潜能隐藏)', () => {
    const rows = buildMoveRows({
      '1021012': {
        name: '闪避：尾巴失踪术',
        desc: '<IconMap:Icon_Evade>',
        potential: [102100],
      },
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('闪避：尾巴失踪术')
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
    expect(row.groups?.[0]?.entries?.[0]).toMatchObject({ name: '一段伤害倍率', format: '%' })
    // 无数值对应的强攻组 desc 为空
    expect(row.groups?.[1]).toMatchObject({ name: '强攻', desc: undefined })
    expect(row.groups?.[1].entries).toHaveLength(1)
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

