import { describe, expect, it } from 'vitest'
import { buildSearchIndex, highlightSegments, normalizeQuery, searchEntries } from '../src/domain/search'
import type { Lang } from '../src/domain/lang'

const ICON = (row: Record<string, unknown>) => [`icon/${String(row.Id)}.webp`]

/** 默认按中文建索引；传语言可验「label 随语言、hay 不随语言」 */
function fixture(lang: Lang = 'zh') {
  return buildSearchIndex(
    [
      {
        catPath: '/agents',
        rows: [
          { Id: 1011, zh: '安比', en: 'Anby', ja: 'アンビー', ko: '엔비', code: 'Anby', camp_name: '狡兔屋' },
          { Id: 1041, zh: '「11号」', en: 'Soldier 11', ko: '솔저 11', ja: 'ソルジャー11' },
        ],
        iconSrcs: ICON,
      },
      {
        catPath: '/w-engines',
        rows: [{ Id: 12001, zh: '「月相」-望', en: '[Lunar] Pleniluna' }],
        iconSrcs: ICON,
      },
      {
        catPath: '/disks',
        // 驱动盘名录形态：zh/en 是 {name,…} 子对象
        rows: [{ Id: 31000, zh: { name: '啄木鸟电音' }, en: { name: 'Woodpecker Electro' } }],
        iconSrcs: ICON,
      },
    ],
    lang,
  )
}

describe('normalizeQuery', () => {
  it('大小写与全半角归一', () => {
    expect(normalizeQuery('ANBY')).toBe('anby')
    expect(normalizeQuery('１０１１')).toBe('1011')
    expect(normalizeQuery('  Soldier　11 ')).toBe('soldier 11')
  })
})

describe('buildSearchIndex', () => {
  it('条目数与排序（类目序 → Id 升序）', () => {
    const idx = fixture()
    expect(idx).toHaveLength(4)
    expect(idx.map((e) => e.catPath)).toEqual(['/agents', '/agents', '/w-engines', '/disks'])
    expect(idx.map((e) => e.no)).toEqual(['1011', '1041', '12001', '31000'])
  })

  it('hay 合并四语 + 编号；label 取 pickName 同序回退', () => {
    const idx = fixture()
    expect(idx[0]!.hay).toContain('安比')
    expect(idx[0]!.hay).toContain('anby')
    expect(idx[0]!.hay).toContain('엔비')
    expect(idx[0]!.hay).toContain('1011')
    expect(idx[0]!.label).toBe('安比')
    expect(idx[2]!.label).toBe('「月相」-望')
  })

  it('label 随语言切换，hay 不随语言（跨语言照样命中）', () => {
    const ja = fixture('ja')
    const en = fixture('en')
    expect(ja[0]!.label).toBe('アンビー')
    expect(en[0]!.label).toBe('Anby')
    // 英文界面下输入中文名仍命中（hay 是四语合并串）
    expect(searchEntries(en, '安比').map((e) => e.to)).toEqual(['/agents/1011'])
    expect(searchEntries(ja, 'soldier').map((e) => e.to)).toEqual(['/agents/1041'])
  })

  it('驱动盘名录的 {name} 子对象形态也能取名', () => {
    const en = fixture('en')
    expect(en[3]!.label).toBe('Woodpecker Electro')
    expect(searchEntries(en, '啄木鸟').map((e) => e.to)).toEqual(['/disks/31000'])
  })

  it('详情路由由类目路径 + Id 派生', () => {
    const idx = fixture()
    expect(idx[0]!.to).toBe('/agents/1011')
    expect(idx[2]!.to).toBe('/w-engines/12001')
  })
})

describe('searchEntries', () => {
  it('空查询返回全部（快速入口）', () => {
    expect(searchEntries(fixture(), '')).toHaveLength(4)
  })

  it('单词命中：中文 / 英文大小写无关 / 编号', () => {
    const idx = fixture()
    expect(searchEntries(idx, '安比').map((e) => e.to)).toEqual(['/agents/1011'])
    expect(searchEntries(idx, 'SOLDIER').map((e) => e.to)).toEqual(['/agents/1041'])
    expect(searchEntries(idx, '1011').map((e) => e.to)).toEqual(['/agents/1011'])
  })

  it('全角数字查询归一命中', () => {
    expect(searchEntries(fixture(), '１０１１').map((e) => e.to)).toEqual(['/agents/1011'])
  })

  it('多词 AND：词序无关，须同条目全命中', () => {
    const idx = fixture()
    expect(searchEntries(idx, 'anby 安比').map((e) => e.to)).toEqual(['/agents/1011'])
    expect(searchEntries(idx, 'anby pleniluna')).toHaveLength(0)
  })

  it('无匹配返回空（UI 呈现空态）', () => {
    expect(searchEntries(fixture(), '妮可')).toHaveLength(0)
  })
})

describe('highlightSegments', () => {
  it('同语言命中：原文定位分段（大小写/全半角归一）', () => {
    expect(highlightSegments('Soldier 11', 'soldier')).toEqual([
      { text: 'Soldier', hit: true },
      { text: ' 11', hit: false },
    ])
    expect(highlightSegments('「11号」', '１１')).toEqual([
      { text: '「', hit: false },
      { text: '11', hit: true },
      { text: '号」', hit: false },
    ])
  })

  it('跨语言命中（label 无查询词）不伪造标记：整段 hit=false', () => {
    // 查 'anby' 命中 zh label '安比' 的条目（hay 里有 en），但 label 本身无 'anby' 子串
    expect(highlightSegments('安比', 'anby')).toEqual([{ text: '安比', hit: false }])
    expect(highlightSegments('零号·安比', 'ling')).toEqual([{ text: '零号·安比', hit: false }])
  })

  it('空查询：整段不标', () => {
    expect(highlightSegments('安比', '')).toEqual([{ text: '安比', hit: false }])
  })
})
