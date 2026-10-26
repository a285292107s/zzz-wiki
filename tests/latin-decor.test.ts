import { describe, expect, it } from 'vitest'
import { CATALOG, GUIDE_ENTRIES } from '../src/domain/catalog'
import { LANGS, pickText } from '../src/domain/lang'
import { uiTextFor } from '../src/domain/uiText'
import { latinDecor } from '../src/utils/latinDecor'

describe('latinDecor（装饰性拉丁行）', () => {
  it('与本地化文案同义时隐去：大小写、空格、词间标点不影响判定', () => {
    expect(latinDecor('AGENTS', 'Agents')).toBe('')
    expect(latinDecor('NEW ERIDU · DATA TERMINAL', 'New Eridu Data Terminal')).toBe('')
    expect(latinDecor('W-ENGINES', 'W-Engines')).toBe('')
  })

  it('只是标题的缩写同样隐去（同一语言下这行没说出新东西）', () => {
    expect(latinDecor('Mindscape', 'Mindscape Cinema')).toBe('')
    expect(latinDecor('Core', 'Core Skill')).toBe('')
    expect(latinDecor('Refine', 'Refinement effect')).toBe('')
    expect(latinDecor('Bonus', 'Set Bonus')).toBe('')
    expect(latinDecor('BANGBOO', 'Bangboos')).toBe('')
    expect(latinDecor('Formulas', 'Combat Formulas')).toBe('')
  })

  it('不同书写系统的对照保留（中文名 + 拉丁铭牌正是设计要的那一层）', () => {
    expect(latinDecor('AGENTS', '代理人')).toBe('AGENTS')
    expect(latinDecor('VITALS', '基础属性')).toBe('VITALS')
    expect(latinDecor('CORE', '核心技')).toBe('CORE')
  })

  it('换词的铭牌照常显示：它给的是标题没说的说法', () => {
    expect(latinDecor('Colophon', 'About the data')).toBe('Colophon')
    expect(latinDecor('Vitals', 'Base stats')).toBe('Vitals')
    expect(latinDecor('Lore', 'Overview')).toBe('Lore')
    expect(latinDecor('Inter-Knot', 'Rope Net impressions')).toBe('Inter-Knot')
  })

  it('空值返回空串', () => {
    expect(latinDecor('', 'Agents')).toBe('')
    expect(latinDecor(undefined, 'Agents')).toBe('')
  })
})

describe('装饰行在各语言的落地', () => {
  it('非英文语言的类目铭牌仍然显示', () => {
    for (const lang of ['zh', 'ja', 'ko'] as const) {
      for (const entry of [...CATALOG, ...GUIDE_ENTRIES]) {
        expect(latinDecor(entry.en, pickText(entry.label, lang)), `${lang} ${entry.path}`).not.toBe('')
      }
    }
  })

  it('英文下与类目名同串的铭牌不再印第二遍', () => {
    for (const path of ['/agents', '/w-engines', '/disks']) {
      const entry = [...CATALOG, ...GUIDE_ENTRIES].find((e) => e.path === path)!
      expect(latinDecor(entry.en, pickText(entry.label, 'en')), path).toBe('')
    }
  })

  it('站头品牌副标四语都真的会渲染（没有任何语言被守卫吞掉）', () => {
    for (const lang of LANGS) {
      const { brandSub, brandName } = uiTextFor(lang).header
      expect(latinDecor(brandSub, brandName), lang).not.toBe('')
    }
  })

  it('品牌副标保持拉丁铭牌写法（全大写 + 间隔点），不随语言翻译', () => {
    for (const lang of LANGS) {
      expect(uiTextFor(lang).header.brandSub, lang).toMatch(/^[A-Z0-9 ·-]+$/)
    }
  })
})
