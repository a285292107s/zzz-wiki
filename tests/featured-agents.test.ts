import { describe, expect, it } from 'vitest'
import {
  buildFeaturedCards,
  deckSizes,
  heroSources,
  shuffle,
  seededShuffle,
  daySeed,
  monthDayKey,
  birthdayOf,
  FEATURED_POOL,
  pickFeatured,
} from '@/composables/useFeaturedAgents'
import featuredBirthdays from '@/data/featured-birthdays.json'
import birthdaySupplement from '@/data/birthday-supplement.json'
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

describe('今日精选的生日优先（pickFeatured）', () => {
  /** 池内每天各有谁过生日（从生日表自算，与实现同源；避免把角色号写死在断言里） */
  function birthdaysByDay(): Map<string, number[]> {
    const byDay = new Map<string, number[]>()
    for (const p of FEATURED_POOL) {
      const b = birthdayOf(p.id)
      if (b) byDay.set(b, [...(byDay.get(b) ?? []), p.id])
    }
    return byDay
  }

  /** 找一天「池内至少 n 位当天生日」，并给出对应的 Date */
  function dayWithBirthdays(n: number): { date: Date; ids: number[] } | null {
    const hit = [...birthdaysByDay().entries()].filter(([, v]) => v.length >= n).sort((a, b) => b[1].length - a[1].length)[0]
    if (!hit) return null
    const [mm, dd] = hit[0].split('-').map(Number)
    return { date: new Date(2026, mm! - 1, dd!), ids: hit[1] }
  }

  it('当天生日的角色排在最前，其余名额按播种序补齐', () => {
    const hit = dayWithBirthdays(1)
    expect(hit).not.toBeNull()
    const picks = pickFeatured(FEATURED_POOL, hit!.date)
    expect(picks).toHaveLength(4)
    // 生日位在最前，且「生日卡之后不再出现非生日卡」（flags 单调不增）
    expect(hit!.ids).toContain(picks[0]!.id)
    const isBirthday = picks.map((p) => hit!.ids.includes(p.id))
    expect(isBirthday).toEqual([...isBirthday].sort((a, b) => Number(b) - Number(a)))
  })

  it('同一天两位生日角色都进牌堆（不是只取一位）', () => {
    const hit = dayWithBirthdays(2)
    expect(hit).not.toBeNull()
    const picks = pickFeatured(FEATURED_POOL, hit!.date)
    expect(new Set(picks.slice(0, 2).map((p) => p.id))).toEqual(new Set(hit!.ids))
  })

  it('count 小于生日人数时只取前 count 位（固定 4 张的取舍）', () => {
    const hit = dayWithBirthdays(2)
    expect(hit).not.toBeNull()
    const picks = pickFeatured(FEATURED_POOL, hit!.date, 1)
    expect(picks).toHaveLength(1)
    expect(hit!.ids).toContain(picks[0]!.id)
  })

  it('当天无人生日时回到纯播种序：同日恒定（含当天 23:59 取片）', () => {
    const byDay = birthdaysByDay()
    // 「无人生日的那天」由生日表反推，不写死日期：池是人工策展，哪天新增一位生日角色
    // 都会让写死的日期变成假失败（门禁一旦因与实现无关的原因失败，就没人再信它）
    const date =
      [...Array(365).keys()]
        .map((i) => new Date(2026, 0, i + 1))
        .find((d) => !byDay.has(monthDayKey(d))) ?? new Date(2026, 0, 1)
    expect(byDay.has(monthDayKey(date))).toBe(false)
    const a = pickFeatured(FEATURED_POOL, date)
    const b = pickFeatured(FEATURED_POOL, new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59))
    expect(a.map((p) => p.id)).toEqual(b.map((p) => p.id))
    expect(a).toHaveLength(4)
    expect(new Set(a.map((p) => p.id)).size).toBe(4) // 不重复占格
  })

  it('跨日换一批：相隔一天的两批不完全相同', () => {
    const a = pickFeatured(FEATURED_POOL, new Date(2026, 9, 12)).map((p) => p.id)
    const others = [13, 14, 15, 16, 17].map((d) =>
      pickFeatured(FEATURED_POOL, new Date(2026, 9, d)).map((p) => p.id),
    )
    expect(others.some((ids) => ids.join() !== a.join())).toBe(true)
  })

  it('一年 365 天逐日校验：生日卡张数精确等于「当天生日人数（上限 4）」，且整体排在前面', () => {
    const byDay = birthdaysByDay()
    for (let d = 1; d <= 365; d++) {
      const date = new Date(2026, 0, d)
      const picks = pickFeatured(FEATURED_POOL, date)
      const today = byDay.get(monthDayKey(date)) ?? []
      const flags = picks.map((p) => today.includes(p.id))

      expect(picks).toHaveLength(4)
      expect(new Set(picks.map((p) => p.id)).size).toBe(4) // 无重复占格
      expect(flags.filter(Boolean).length).toBe(Math.min(today.length, 4)) // 生日的都给到，多的按上限截断
      expect(flags).toEqual([...flags].sort((a, b) => Number(b) - Number(a))) // 生日组整体在最前
    }
  })

  it('无生日的角色不享优先，但池子只剩它们时照样出卡（不静默少给）', () => {
    const hit = dayWithBirthdays(1)!
    // 用**生日表里必然没有的**角色号自造「无生日」条目：与「当前池内恰好谁缺生日」解耦
    // （1551 这类缺口会随后续数据/补充表变化，写死真实角色号就会把正常更新误报成回归）
    const noBirthday = [900001, 900002, 900003].map((id) => ({ id, pos: '50%', zoom: 1, originY: 50 }))
    expect(noBirthday.every((p) => birthdayOf(p.id) === null)).toBe(true)
    // 池内只有「1 位当天生日 + N 位无生日」时，首位必须是那位生日角色
    const picks = pickFeatured([...noBirthday, { id: hit.ids[0]!, pos: '50%', zoom: 1, originY: 50 }], hit.date)
    expect(picks[0]!.id).toBe(hit.ids[0])
    // 全是无生日角色 → 按播种序给满（有多少给多少），且顺序确定
    const only = pickFeatured(noBirthday, hit.date, 4)
    expect(only).toHaveLength(noBirthday.length)
    expect(only.map((p) => p.id)).toEqual(pickFeatured(noBirthday, hit.date, 4).map((p) => p.id))
  })

  it('特殊形态与其本体同生日（人工补充表生效的证据）', () => {
    for (const [formId, baseId] of Object.entries(birthdaySupplement.inheritFrom)) {
      // 该形态当前若不在池内，产物里就不会有它 —— 跳过（池是人工策展，增减不该误报成失败）
      if (birthdayOf(Number(formId)) === null) continue
      expect(birthdayOf(Number(baseId))).not.toBeNull() // 本体的生日必须同样来自详情
      expect(birthdayOf(Number(formId))).toBe(birthdayOf(Number(baseId)))
    }
  })

  it('生日表与策展池不脱节：表内 id 全部仍在池内', () => {
    const poolIds = new Set(FEATURED_POOL.map((p) => p.id))
    for (const key of Object.keys(featuredBirthdays)) {
      expect(poolIds.has(Number(key))).toBe(true)
    }
    // 有生日的条目必须格式统一（补零 MM-DD），否则当天比较必然落空
    for (const v of Object.values(featuredBirthdays)) expect(v).toMatch(/^\d{2}-\d{2}$/)
  })

  it('monthDayKey 补零后与生日表同构', () => {
    expect(monthDayKey(new Date(2026, 0, 5))).toBe('01-05')
    expect(monthDayKey(new Date(2026, 11, 31))).toBe('12-31')
    expect(monthDayKey(new Date(2026, 9, 12, 23, 59))).toBe('10-12')
  })
})

describe('heroSources · 首页头图的派生档（档位交给浏览器按 DPR 选）', () => {
  const SIZES = '1180px'
  const srcs = heroSources('Mindscape_1011_2', SIZES)

  it('候选链三级且顺序固定：本地派生档 → 本地原图 → CDN 兜底', () => {
    expect(srcs).toHaveLength(3)
    expect(srcs[0]!.src).toBe('/data/img/hero/wide/Mindscape_1011_2.webp')
    expect(srcs[1]!.src).toBe('/data/img/hero/Mindscape_1011_2.webp')
    expect(srcs[2]!.src).toBe('https://static.nanoka.cc/assets/zzz/Mindscape_1011_2.webp')
  })

  it('srcset 给出 card/wide/原图三档、按宽度升序，且 w 描述符必配 sizes', () => {
    const ss = srcs[0]!.srcset!
    const widths = [...ss.matchAll(/(\d+)w/g)].map((m) => Number(m[1]))
    expect(widths).toEqual([800, 1600, 1920]) // 升序：浏览器取「最小够用」档
    expect(ss).toContain('/data/img/hero/card/Mindscape_1011_2.webp 800w')
    expect(ss).toContain('/data/img/hero/wide/Mindscape_1011_2.webp 1600w')
    expect(ss).toContain('/data/img/hero/Mindscape_1011_2.webp 1920w')
    // 缺 sizes 时浏览器按 100vw 兜底 → 桌面会误选最小档（又糊），故必须成对出现
    expect(srcs[0]!.sizes).toBe(SIZES)
  })

  it('末档（原图）的 w 描述符不参与选档：它是最后一档，只当前几档都不够时才落回', () => {
    // 原图实际宽 1920-2580 不等，这里声明全池下界 1920；因为它是最后一档，
    // 浏览器「取密度≥DPR 的最小档，否则取最大档」的规则下取值不影响结果。
    const last = srcs[0]!.srcset!.split(', ').at(-1)!
    expect(last).toBe('/data/img/hero/Mindscape_1011_2.webp 1920w')
  })
})

describe('deckSizes · 头图 sizes 定档（纯 px，预热探针与真实 <img> 必须同值）', () => {
  it('桌面按「取景框宽」定档：min(视口宽, 1180px)', () => {
    expect(deckSizes(861)).toBe('861px')
    expect(deckSizes(1180)).toBe('1180px')
    expect(deckSizes(1280)).toBe('1180px')
    expect(deckSizes(1920)).toBe('1180px')
    expect(deckSizes(2560)).toBe('1180px')
  })

  it('手机（≤860）走竖幅等效源宽：固定 520px，不随视口缩到 350', () => {
    // 竖幅把超宽源图放大取中段，布局宽会低估需求（见 DECK_SIZES_NARROW 的推导表）
    expect(deckSizes(860)).toBe('520px')
    expect(deckSizes(390)).toBe('520px')
    expect(deckSizes(320)).toBe('520px')
  })

  it('输出纯 px：不含 vw / 媒体查询 —— 脱离文档的预热探针求不了它们', () => {
    for (const s of [deckSizes(390), deckSizes(1440)]) {
      expect(s).toMatch(/^\d+px$/)
      expect(s).not.toContain('vw')
      expect(s).not.toContain('max-width')
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
    // 候选链三级：本地派生档（srcset：card 800w / wide 1600w / 原图）→ 本地原图 → CDN
    // （见 scripts/build/hero-cards.mjs 的两档规格与 useFeaturedAgents.heroSources）
    expect(cards[0]!.srcs).toHaveLength(3)
    expect(cards[0]!.srcs[0]!.src).toMatch(/hero\/wide\/Mindscape_1011_2\.webp$/)
    expect(cards[0]!.srcs[0]!.srcset).toContain('800w')
    expect(cards[0]!.srcs[1]!.src).toMatch(/hero\/Mindscape_1011_2\.webp$/)
    expect(cards[0]!.srcs[2]!.src).toContain('static.nanoka.cc')
    expect(cards[0]!.to).toBe('/agents/1011')
  })

  it('清单未就绪（null）时出占位卡：全量保留、图候选齐全、名字留空（LCP 与清单并行）', () => {
    const cards = buildFeaturedCards(seed, null)
    expect(cards.map((c) => c.id)).toEqual([1011, 9999, 1051]) // 无真值依据，不丢 id
    expect(cards.map((c) => c.no)).toEqual(['01', '02', '03'])
    expect(cards[0]!.zh).toBe('')
    expect(cards[0]!.en).toBe('')
    expect(cards[0]!.elementZh).toBe('')
    expect(cards[0]!.srcs[0]!.src).toMatch(/hero\/wide\/Mindscape_1011_2\.webp$/)
    expect(cards[0]!.srcs[2]!.src).toContain('static.nanoka.cc')
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

describe('buildFeaturedCards · 双形态角色跟随所选形态', () => {
  // 佩洛伊斯（1551）是站内唯一的双形态角色：hero 头图分 Female/Male 两个文件
  // （src/data/hero-gender-variants.json）。首页卡面必须与详情页同图，
  // 否则共享元素飞行会把卡片上的女性版溶解成降落端的男性版。
  const pelo = [{ id: 1551, pos: '49%', zoom: 1.2965, originY: 50 }]
  const list = [makeItem(1551, { zh: '佩洛伊斯', en: 'Phaethon' })]

  it('female：取默认（女性）版文件', () => {
    const cards = buildFeaturedCards(pelo, list, undefined, 'female')
    expect(cards[0]!.srcs[0]!.src).toMatch(/hero\/wide\/Mindscape_1551_Female_2\.webp$/)
    expect(cards[0]!.srcs[0]!.srcset).toContain('Mindscape_1551_Female_2')
  })

  it('male：取男性版文件（与详情页所选形态一致）', () => {
    const cards = buildFeaturedCards(pelo, list, undefined, 'male')
    expect(cards[0]!.srcs[0]!.src).toMatch(/hero\/wide\/Mindscape_1551_Male_2\.webp$/)
    expect(cards[0]!.srcs[0]!.srcset).toContain('Mindscape_1551_Male_2')
    // 三级候选都要跟着换，否则回退档会跳回女性版
    expect(cards[0]!.srcs[1]!.src).toMatch(/hero\/Mindscape_1551_Male_2\.webp$/)
    expect(cards[0]!.srcs[2]!.src).toContain('Mindscape_1551_Male_2')
  })

  it('未传形态时用默认值（female），与重构前行为一致', () => {
    const cards = buildFeaturedCards(pelo, list)
    expect(cards[0]!.srcs[0]!.src).toMatch(/Mindscape_1551_Female_2\.webp$/)
  })

  it('单形态角色不受形态影响：两形态都取裸名规则的文件', () => {
    const single = [{ id: 1011, pos: '44%', zoom: 1.32, originY: 47.5 }]
    const singleList = [makeItem(1011, { zh: '安比' })]
    for (const form of ['female', 'male'] as const) {
      const cards = buildFeaturedCards(single, singleList, undefined, form)
      expect(cards[0]!.srcs[0]!.src).toMatch(/hero\/wide\/Mindscape_1011_2\.webp$/)
    }
  })
})

describe('buildFeaturedCards · 生日小签（isBirthday）', () => {
  // 取生日表里**实际存在**的两位、且生日不同：与策展池增删解耦（写死角色号会随池变化误报）
  const entries = Object.entries(featuredBirthdays as Record<string, string>)
  const [idA, bdA] = entries[0]!
  const [idB, bdB] = entries.find(([, v]) => v !== bdA)!
  const seed = [idA, idB].map((id) => ({ id: Number(id), pos: '50%', zoom: 1, originY: 50 }))
  const list = [makeItem(Number(idA), { zh: '甲' }), makeItem(Number(idB), { zh: '乙' })]
  /** 生日表的值恒为真实 MM-DD，故 13 月这个键必然谁都不命中（= 今天没人生日的等价场景） */
  const NO_ONE = '13-01'

  it('只给当天生日的那张挂标记（判据与选片同源的一张生日表）', () => {
    expect(buildFeaturedCards(seed, list, undefined, 'female', bdA).map((c) => c.isBirthday)).toEqual([true, false])
    expect(buildFeaturedCards(seed, list, undefined, 'female', bdB).map((c) => c.isBirthday)).toEqual([false, true])
  })

  it('今天没人生日时一张都不挂（此时选片也退化为纯播种序）', () => {
    expect(buildFeaturedCards(seed, list, undefined, 'female', NO_ONE).map((c) => c.isBirthday)).toEqual([false, false])
  })

  it('不依赖名录：清单未就绪（名字还在占位）时标记已经是准的', () => {
    expect(buildFeaturedCards(seed, null, undefined, 'female', bdA).map((c) => c.isBirthday)).toEqual([true, false])
  })

  it('形态与本体同一天生日时两张都挂（11-25 比利 + 星徽·比利）', () => {
    const forms = Object.entries(birthdaySupplement.inheritFrom)
    if (!forms.length) return
    const [formId, baseId] = forms[0]!
    const formBd = birthdayOf(Number(formId))
    if (formBd === null) return // 该形态当前不在池内 → 产物里没有它，跳过
    const s = [Number(formId), Number(baseId)].map((id) => ({ id, pos: '50%', zoom: 1, originY: 50 }))
    const l = [makeItem(Number(formId), { zh: '形态' }), makeItem(Number(baseId), { zh: '本体' })]
    expect(buildFeaturedCards(s, l, undefined, 'female', formBd).map((c) => c.isBirthday)).toEqual([true, true])
  })
})

