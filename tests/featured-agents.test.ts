import { describe, expect, it } from 'vitest'
import { buildFeaturedCards, shuffle, FEATURED_POOL } from '@/composables/useFeaturedAgents'
import type { CharacterListItem } from '@/data/types'
import { ELEMENTS } from '@/domain/enums'

/** 构造名录条目（schema 除 Id 外均可选，其余缺省） */
function makeItem(Id: number, over: Partial<CharacterListItem> = {}): CharacterListItem {
  return { Id, ...over } as CharacterListItem
}

describe('shuffle', () => {
  it('返回同集合的随机排列，且不修改入参', () => {
    const src = [1, 2, 3, 4, 5]
    const out = shuffle(src)
    expect(src).toEqual([1, 2, 3, 4, 5]) // 入参未被改写
    expect(out).not.toBe(src) // 新数组
    expect([...out].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]) // 同集合（排列）
  })

  it('FEATURED_POOL 从 featured-pool.json 读入且每项结构完整', () => {
    expect(FEATURED_POOL.length).toBeGreaterThan(0)
    for (const p of FEATURED_POOL) {
      expect(typeof p.id).toBe('number')
      expect(typeof p.pos).toBe('string')
      expect(typeof p.zoom).toBe('number')
      expect(typeof p.originY).toBe('number')
    }
  })
})

describe('buildFeaturedCards', () => {
  const seed = [
    { id: 1011, pos: '50%', zoom: 1.3, originY: 49.8 },
    { id: 9999, pos: '50%', zoom: 1, originY: 50 }, // 名录缺失，应被丢弃
    { id: 1051, pos: '64%', zoom: 1.22, originY: 61.4 },
  ]

  it('按 id 解析名字/元素/头图/链接，缺失 id 丢弃并紧凑重排编号', () => {
    const list = [
      makeItem(1011, { zh: '安比', en: 'Anby', element: 203 }),
      makeItem(1051, { zh: '伊德海莉', en: 'Yidhari', element: 202 }),
    ]
    const cards = buildFeaturedCards(seed, list)
    expect(cards.map((c) => c.id)).toEqual([1011, 1051]) // 9999 被丢弃
    expect(cards.map((c) => c.no)).toEqual(['01', '02']) // 重排后紧凑编号
    expect(cards[0]!.zh).toBe('安比')
    expect(cards[0]!.elementZh).toBe(ELEMENTS[203].zh) // 基础元素中文
    expect(cards[0]!.elementColor).toBe(ELEMENTS[203].color)
    expect(cards[0]!.srcs[0]).toMatch(/Mindscape_1011_2\.webp$/)
    expect(cards[0]!.srcs[1]).toContain('static.nanoka.cc')
    expect(cards[0]!.to).toBe('/agents/1011')
  })

  it('特殊属性显示特殊名，且不套基础元素色', () => {
    const list = [makeItem(1371, { zh: '仪玄', en: 'Yixuan', element: 205, special_element: '玄墨' })]
    const cards = buildFeaturedCards([{ id: 1371, pos: '40%', zoom: 1.2, originY: 30.2 }], list)
    expect(cards[0]!.elementZh).toBe('玄墨')
    expect(cards[0]!.elementColor).toBe('')
  })

  it('空名录给出空结果', () => {
    expect(buildFeaturedCards(seed, [])).toEqual([])
  })
})
