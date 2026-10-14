/* ============================================================
 * 界面文案表（domain/uiText）契约哨兵。
 *
 * 三语化最容易出的两类事故都在这守：
 *   1. **漏翻**——某语言少了/多了键（英文清单由类型挡住，但对象变量赋值不做
 *      多余属性检查，故「多出来的键」只能靠这里发现）；
 *   2. **空串**——值被写成 '' 时模板上什么都不显示，肉眼走查很难发现。
 * 另外锁定「官方译名」这一条：属性/职业/攻击方式的四语名取自源站，
 * 任何一次手改都会被这里点出来（改就是有意的契约变更）。
 * ============================================================ */

import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { ELEMENTS, HIT_TYPES, PROFESSIONS } from '../src/domain/enums'
import { isLoc, LANGS, pickText, type Loc } from '../src/domain/lang'
import { fmt, uiLoc, uiTextFor, uiTextKeyCounts } from '../src/domain/uiText'

import zhText from '../src/domain/uiText.zh.json'
import enText from '../src/domain/uiText.en.json'
import jaText from '../src/domain/uiText.ja.json'
import koText from '../src/domain/uiText.ko.json'

/** 把嵌套文案树摊平成 `a.b.c` 路径 → 值 */
function flatten(obj: unknown, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'string') out[path] = v
    else if (v && typeof v === 'object') Object.assign(out, flatten(v, path))
    else out[path] = `__NOT_STRING__:${typeof v}`
  }
  return out
}

const FLAT: Record<string, Record<string, string>> = {
  zh: flatten(zhText),
  en: flatten(enText),
  ja: flatten(jaText),
  ko: flatten(koText),
}

describe('界面文案表（uiText）', () => {
  it('四语键集合完全一致（不漏翻、也不多出只有一种语言的键）', () => {
    const base = Object.keys(FLAT.zh!).sort()
    expect(base.length).toBeGreaterThan(150) // 下限锚：真表就该有这个量级；表被清空也报红
    for (const lang of LANGS) {
      expect(Object.keys(FLAT[lang]!).sort(), `键集合（${lang}）`).toEqual(base)
    }
  })

  it('四语都没有空串/非字符串值', () => {
    for (const lang of LANGS) {
      const empties = Object.entries(FLAT[lang]!).filter(
        ([, v]) => typeof v !== 'string' || v.startsWith('__NOT_STRING__') || v.trim() === '',
      )
      expect(empties, `空值（${lang}）`).toEqual([])
    }
  })

  it('键数量四语相同（另一种写法的兜底检查）', () => {
    const counts = uiTextKeyCounts()
    expect(new Set(Object.values(counts)).size).toBe(1)
  })

  it('uiLoc 能取到任意一条键的四语；键写错立刻抛错，不静默给空串', () => {
    const loc = uiLoc('search.quickSearch')
    expect(Object.keys(loc).sort()).toEqual([...LANGS].sort())
    expect(loc.zh).toBe(FLAT.zh!['search.quickSearch'])
    expect(loc.en).toBe(FLAT.en!['search.quickSearch'])
    expect(isLoc(loc)).toBe(true)
    expect(() => uiLoc('search.noSuchKey')).toThrow(/缺少文案键/)
    expect(isLoc({ zh: 'x', en: 'y' })).toBe(false)
    expect(isLoc('首页')).toBe(false)
  })

  it('pickText 按语言取；四语同键的值都可取（抽样：导航与详情区块）', () => {
    for (const lang of LANGS) {
      const tree = uiTextFor(lang)
      expect(pickText(uiLoc('header.search'), lang)).toBe(tree.header.search)
      expect(tree.detail.skills.length).toBeGreaterThan(0)
      expect(tree.longform.chineseOnly.length).toBeGreaterThan(0)
    }
  })

  it('fmt 只替换已给的占位符，未知占位符原样保留', () => {
    expect(fmt('突破 {n} 阶', { n: 3 })).toBe('突破 3 阶')
    expect(fmt('{a} / {b}', { a: 'x' })).toBe('x / {b}')
    expect(fmt('没有占位符', { a: 1 })).toBe('没有占位符')
    expect(fmt('重复 {n} 与 {n}', { n: 7 })).toBe('重复 7 与 7')
  })

  it('带占位符的文案四语都保留了同名占位符（否则某语言会漏掉数值）', () => {
    const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!.toLowerCase()).sort()
    const base = FLAT.zh!
    for (const key of Object.keys(base)) {
      const want = ph(base[key]!)
      if (!want.length) continue
      for (const lang of LANGS) {
        expect(ph(FLAT[lang]![key]!), `${key}（${lang}）`).toEqual(want)
      }
    }
  })

  it('属性/职业/攻击方式的标签四语齐全，且是源站官方译名', () => {
    for (const [code, meta] of Object.entries(ELEMENTS)) {
      for (const lang of LANGS) expect(meta.label[lang], `ELEMENTS[${code}].${lang}`).toBeTruthy()
    }
    for (const [code, p] of Object.entries(PROFESSIONS)) {
      for (const lang of LANGS) expect(p.label[lang], `PROFESSIONS[${code}].${lang}`).toBeTruthy()
    }
    for (const [code, h] of Object.entries(HIT_TYPES)) {
      for (const lang of LANGS) expect(h.label[lang], `HIT_TYPES[${code}].${lang}`).toBeTruthy()
    }
    // 锚点（hakushin raw 3.2 实测）：电属性 / Electric / 電気 / 전기 속성
    expect(ELEMENTS[203].label).toEqual({
      zh: '电',
      en: 'Electric',
      ja: '電気',
      ko: '전기 속성',
    })
    expect(PROFESSIONS[2].label.en).toBe('Stun')
    expect(HIT_TYPES[101].label.ko).toBe('베기')
  })

  it('技能槽位名与四语数据面里的游戏写法一致（防自译，如 ko 连携技应为 콤보 스킬）', () => {
    // 槽位名既是「区块标题」又是**识别键**：sections.isUltimateGroup 用当前语言的
    // 槽位名去 startsWith 数据里的组名，故标签一旦自译，就会与它正下方陈列的组名
    // 说两套话（同屏两个叫法）。断言直接对着 public/data 的真值，不钉死字符串常量。
    const SLOT_OF_KEY: Record<string, { dir: string; slot: string }> = {
      skillBasic: { dir: 'character', slot: 'basic' },
      skillDodge: { dir: 'character', slot: 'dodge' },
      skillSpecial: { dir: 'character', slot: 'special' },
      skillChain: { dir: 'character', slot: 'chain' },
      skillUltimate: { dir: 'character', slot: 'ultimate' },
      skillAssist: { dir: 'character', slot: 'assist' },
    }
    /** 某语言某槽位下，数据里「组名前缀」的出现次数表 */
    const prefixes = (lang: string, dir: string, slot: string): Map<string, number> => {
      const d = path.join('public', 'data', 'live', lang, dir)
      const counts = new Map<string, number>()
      for (const f of fs.readdirSync(d)) {
        const j = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')) as {
          skill?: Record<string, { description?: Array<{ name?: string }> }>
        }
        for (const desc of j.skill?.[slot]?.description ?? []) {
          const name = (desc.name ?? '').trim()
          const m = /^([^：:]+)[：:]/.exec(name)
          if (!m) continue
          const p = m[1].trim()
          counts.set(p, (counts.get(p) ?? 0) + 1)
        }
      }
      return counts
    }
    /** 下限锚：真跑过就该有这么多次对照（数据面读取失败会变 0，判据随之空真） */
    let compared = 0
    for (const lang of LANGS) {
      for (const [key, { dir, slot }] of Object.entries(SLOT_OF_KEY)) {
        const label = pickText(uiLoc(`detail.${key}`), lang as (typeof LANGS)[number])
        const counts = prefixes(lang, dir, slot)
        // 该语该槽位没有「名：值」形态的组名时无从对照（如 en/ja 的 ultimate 槽）
        if (!counts.size) continue
        // 标签必须是数据里出现过的**前缀**之一（或反之），否则就是自译
        const hit = [...counts.keys()].some(
          (p) => p === label || p.startsWith(label) || label.startsWith(p),
        )
        compared++
        expect(hit, `${lang} detail.${key}「${label}」不在数据面组名前缀里（自译？）`).toBe(true)
      }
    }
    // 四语 × 六槽位里绝大多数都该有可对照的组名；写死下限是为了让「数据没读到」
    // 这种失败以报红出现，而不是把断言整段跳过（空真判据）。
    expect(compared, '可对照的（语言 × 槽位）组合数').toBeGreaterThanOrEqual(16)
  })

  it('属性标签的四种语言写法互不相同（防「复制中文当译文」）', () => {
    for (const [code, meta] of Object.entries(ELEMENTS)) {
      const vals = LANGS.map((l) => meta.label[l])
      // 物理/流明 在中日两语里同形，是官方写法；但四语全同一定有问题
      expect(new Set(vals).size, `ELEMENTS[${code}]`).toBeGreaterThan(1)
      expect(vals[0], `ELEMENTS[${code}] zh 与 en 相同`).not.toBe(vals[1])
      expect(vals[0], `ELEMENTS[${code}] zh 与 ko 相同`).not.toBe(vals[3])
    }
    const loc: Loc = uiLoc('list.rarity')
    expect(new Set(LANGS.map((l) => loc[l])).size).toBe(4)
  })
})
