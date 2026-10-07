import { describe, expect, it } from 'vitest'
import {
  buildFeaturedCards,
  shuffle,
  seededShuffle,
  daySeed,
  FEATURED_POOL,
  pickFeatured,
  elementKeyOf,
  campKeyOf,
} from '@/composables/useFeaturedAgents'
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

describe('「今日角色」的确定性挑选（同日恒定 / 跨日变化）', () => {
  it('同一天同一批：同一 seed 必得同一排列，且不改写入参', () => {
    const src = FEATURED_POOL.slice(0, 12)
    const a = seededShuffle(src, daySeed(new Date(2026, 9, 6)))
    const b = seededShuffle(src, daySeed(new Date(2026, 9, 6, 23, 59)))
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id))
    expect(src.map((x) => x.id)).toEqual(FEATURED_POOL.slice(0, 12).map((x) => x.id))
  })

  it('跨日换一批：不同日期种子的前四位不同（至少一天不同即可）', () => {
    const src = FEATURED_POOL
    const today = seededShuffle(src, daySeed(new Date(2026, 9, 6))).slice(0, 4).map((x) => x.id)
    const others = [7, 8, 9, 10, 11, 12].map((d) =>
      seededShuffle(src, daySeed(new Date(2026, 9, d))).slice(0, 4).map((x) => x.id),
    )
    expect(others.some((ids) => ids.join() !== today.join())).toBe(true)
  })

  it('daySeed 同日恒定、跨日递增（本地日期编码）', () => {
    expect(daySeed(new Date(2026, 0, 5))).toBe(20260105)
    expect(daySeed(new Date(2026, 11, 31))).toBe(20261231)
    expect(daySeed(new Date(2026, 9, 6, 0, 0))).toBe(daySeed(new Date(2026, 9, 6, 23, 59, 59)))
  })

  it('确定性排列仍是合法排列（元素不增不减）', () => {
    const src = FEATURED_POOL.slice(0, 20).map((x) => x.id)
    const out = seededShuffle(src, 42)
    expect([...out].sort((a, b) => a - b)).toEqual([...src].sort((a, b) => a - b))
  })
})

describe('今日精选的属性 + 阵营去重（pickFeatured）', () => {
  it('4 张卡的属性与阵营都互不重复', () => {
    const picks = pickFeatured(FEATURED_POOL, daySeed(new Date(2026, 9, 5)))
    expect(picks).toHaveLength(4)
    expect(new Set(picks.map((p) => elementKeyOf(p.id))).size).toBe(4)
    expect(new Set(picks.map((p) => campKeyOf(p.id))).size).toBe(4)
  })

  it('一年 365 天逐日校验：任何一天都不出现属性或阵营重复', () => {
    const elDupes: number[] = []
    const campDupes: number[] = []
    for (let d = 1; d <= 365; d++) {
      const date = new Date(2026, 0, d)
      const picks = pickFeatured(FEATURED_POOL, daySeed(date))
      if (new Set(picks.map((p) => elementKeyOf(p.id))).size !== 4) elDupes.push(daySeed(date))
      if (new Set(picks.map((p) => campKeyOf(p.id))).size !== 4) campDupes.push(daySeed(date))
    }
    expect({ elDupes, campDupes }).toEqual({ elDupes: [], campDupes: [] })
  })

  it('同一 seed 恒定：同日两次挑选完全一致（图片缓存才不白费）', () => {
    const seed = daySeed(new Date(2026, 9, 5))
    expect(pickFeatured(FEATURED_POOL, seed).map((p) => p.id)).toEqual(
      pickFeatured(FEATURED_POOL, seed).map((p) => p.id),
    )
  })

  it('池子属性种类不足时按洗牌序补齐，不静默少给', () => {
    // 只给同属性的 3 个条目，却要 4 张 → 应回退补位（而不是返回 1 张）
    const sameEl = FEATURED_POOL.filter((p) => elementKeyOf(p.id) === 'el-200').slice(0, 3)
    const picks = pickFeatured(sameEl, 7, 4)
    expect(picks).toHaveLength(3) // 池子本身只有 3 条 → 只能给 3
    const many = pickFeatured(FEATURED_POOL, 7, 6)
    expect(many).toHaveLength(6)
  })

  it('属性表覆盖池内全部条目（生成物与策展池不脱节）', () => {
    for (const p of FEATURED_POOL) {
      expect(elementKeyOf(p.id)).not.toMatch(/^unknown-/)
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
    // 候选链三级：card 派生 → 本地原图 → CDN（见 scripts/build/hero-cards.mjs 与 useFeaturedAgents）
    expect(cards[0]!.srcs).toHaveLength(3)
    expect(cards[0]!.srcs[0]).toMatch(/hero\/card\/Mindscape_1011_2\.webp$/)
    expect(cards[0]!.srcs[1]).toMatch(/Mindscape_1011_2\.webp$/)
    expect(cards[0]!.srcs[2]).toContain('static.nanoka.cc')
    expect(cards[0]!.to).toBe('/agents/1011')
  })

  it('清单未就绪（null）时出占位卡：全量保留、图候选齐全、名字留空（LCP 与清单并行）', () => {
    const cards = buildFeaturedCards(seed, null)
    expect(cards.map((c) => c.id)).toEqual([1011, 9999, 1051]) // 无真值依据，不丢 id
    expect(cards.map((c) => c.no)).toEqual(['01', '02', '03'])
    expect(cards[0]!.zh).toBe('')
    expect(cards[0]!.en).toBe('')
    expect(cards[0]!.elementZh).toBe('')
    expect(cards[0]!.srcs[0]).toMatch(/hero\/card\/Mindscape_1011_2\.webp$/)
    expect(cards[0]!.srcs[2]).toContain('static.nanoka.cc')
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
