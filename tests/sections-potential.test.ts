import { describe, expect, it } from 'vitest'
import { buildPotentialCinema } from '../src/domain/sections'

const entry = (extra: Record<string, unknown>) => ({
  name: '',
  desc: '',
  image: 'Soldier11',
  ...extra,
})

describe('buildPotentialCinema', () => {
  it('按档序输出，并从档名里拆出档位标记与档名', () => {
    const rows = buildPotentialCinema({
      '104101': entry({ level_show_name: '炽焰行歌 II', level: 2, name: '潜能觉醒：绝焰', desc: 'x' }),
      '104100': entry({ level_show_name: '炽焰行歌 I', level: 1 }),
    })
    expect(rows.map((r) => r.no)).toEqual(['I', 'II'])
    expect(rows[1]).toMatchObject({
      no: 'II',
      level: 2,
      label: '炽焰行歌 II',
      base: '炽焰行歌',
      mark: 'II',
      name: '潜能觉醒：绝焰',
      desc: 'x',
      image: 'Soldier11',
    })
  })

  it('韩文档位标记是 CJK 兼容罗马数字：no 归一为 ASCII，mark 保留原文', () => {
    const rows = buildPotentialCinema({
      '102103': entry({ level_show_name: '고양이의 보은 Ⅳ', level: 4 }),
    })
    expect(rows[0].no).toBe('IV')
    expect(rows[0].mark).toBe('Ⅳ')
    expect(rows[0].base).toBe('고양이의 보은')
  })

  it('缺 level 字段时按档序补 1..n', () => {
    const rows = buildPotentialCinema({
      '1': entry({ level_show_name: '', name: '档一' }),
      '2': entry({ level_show_name: 'x' }),
    })
    expect(rows.map((r) => r.level)).toEqual([1, 2])
    expect(rows[0].no).toBe('I')
    expect(rows[1].mark).toBe('II')
  })

  it('无数据返回空数组', () => {
    expect(buildPotentialCinema(null)).toEqual([])
    expect(buildPotentialCinema(undefined)).toEqual([])
  })
})
