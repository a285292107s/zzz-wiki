import { describe, expect, it } from 'vitest'
import {
  MAX_COMPARE,
  buildComparison,
  compareFields,
  formatField,
  type CompareEntryInput,
} from '@/domain/compare'

function entry(id: number, data: Record<string, unknown>, over: Partial<CompareEntryInput> = {}): CompareEntryInput {
  return {
    id,
    label: `条目${id}`,
    no: String(id).padStart(3, '0'),
    to: `/agents/${id}`,
    srcs: [],
    data,
    ...over,
  }
}

describe('compareFields', () => {
  it('四类目都有对照字段，且键名非空', () => {
    for (const p of ['/agents', '/w-engines', '/bangboos', '/disks']) {
      const f = compareFields(p)
      expect(f.length).toBeGreaterThan(0)
      for (const x of f) {
        expect(x.key).toBeTruthy()
        expect(x.label).toBeTruthy()
      }
    }
  })

  it('未知类目返回空数组（不抛错）', () => {
    expect(compareFields('/nope')).toEqual([])
  })
})

describe('formatField 枚举解码与空值', () => {
  it('代理人属性/职业/攻击方式按枚举解成中文', () => {
    expect(formatField('/agents', 'element', { element: 201 })).toBe('火')
    expect(formatField('/agents', 'type', { type: 6 })).toBe('命破')
    expect(formatField('/agents', 'hit', { hit: 103 })).toBe('贯穿')
  })

  it('未知枚举码原样显示（便于发现数据异常，而不是显示 undefined）', () => {
    expect(formatField('/agents', 'element', { element: 999 })).toBe('999')
  })

  it('空值统一为破折号（对照表里空位必须可见）', () => {
    for (const v of [undefined, null, '']) {
      expect(formatField('/agents', 'camp_name', { camp_name: v })).toBe('—')
    }
  })

  it('稀有度按名录同一口径显示：rank 3/4 → A/S（直接显示数字会被误读为档数）', () => {
    expect(formatField('/agents', 'rank', { rank: 4 })).toBe('S')
    expect(formatField('/agents', 'rank', { rank: 3 })).toBe('A')
    expect(formatField('/w-engines', 'rank', { rank: 2 })).toBe('B')
  })

  it('未知稀有度码原样显示（不显示 undefined）', () => {
    expect(formatField('/agents', 'rank', { rank: 9 })).toBe('9')
  })

  it('驱动盘 zh 为 {name} 对象时取 name', () => {
    expect(formatField('/disks', 'zh', { zh: { name: '啄木鸟电音' } })).toBe('啄木鸟电音')
    expect(formatField('/disks', 'zh', { zh: {} })).toBe('—')
  })
})

describe('buildComparison', () => {
  it('行=字段、列=条目，并标出有差异的行', () => {
    const m = buildComparison('/agents', [
      entry(1011, { rank: 'S', element: 201, type: 1, hit: 101, camp_name: '狡兔屋' }),
      entry(1021, { rank: 'S', element: 201, type: 1, hit: 101, camp_name: '狡兔屋' }),
      entry(1031, { rank: 'A', element: 202, type: 2, hit: 102, camp_name: '白祇重工' }),
    ])
    expect(m.columns.map((c) => c.id)).toEqual([1011, 1021, 1031])
    expect(m.rows.map((r) => r.label)).toEqual(['稀有度', '属性', '职业', '攻击方式', '阵营'])
    // 三条互不相同 → 5 行都有差异
    expect(m.diffCount).toBe(5)
    expect(m.rows[0].cells).toEqual(['S', 'S', 'A'])
    expect(m.rows[0].differs).toBe(true)
  })

  it('全同行不标差异（把注意力留给真正的差别）', () => {
    const same = { rank: 'S', element: 201, type: 1, hit: 101, camp_name: '狡兔屋' }
    const m = buildComparison('/agents', [entry(1011, same), entry(1021, { ...same })])
    expect(m.diffCount).toBe(0)
    expect(m.rows.every((r) => !r.differs)).toBe(true)
  })

  it('差异判定归一化：大小写与首尾空白不算差异', () => {
    const m = buildComparison('/w-engines', [
      entry(1, { rank: 's', type: '强攻', atk: 500, sub: '暴击率' }),
      entry(2, { rank: 'S ', type: '强攻', atk: 500, sub: '暴击率' }),
    ])
    expect(m.diffCount).toBe(0)
  })

  it('空值与有值算差异（缺失本身就是要看的信息）', () => {
    const m = buildComparison('/bangboos', [
      entry(1, { rank: 'S', codename: '阿全' }),
      entry(2, { rank: 'S' }),
    ])
    expect(m.rows[1].cells).toEqual(['阿全', '—'])
    expect(m.rows[1].differs).toBe(true)
    expect(m.diffCount).toBe(1)
  })

  it('单条目对照：无差异行（上限内也允许只放一条）', () => {
    const m = buildComparison('/agents', [entry(1011, { rank: 'S', element: 201, type: 1, hit: 101, camp_name: '狡兔屋' })])
    expect(m.columns).toHaveLength(1)
    expect(m.diffCount).toBe(0)
  })

  it('MAX_COMPARE 为 3（并排可比的上限）', () => {
    expect(MAX_COMPARE).toBe(3)
  })
})
