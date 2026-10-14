/* 语言集的哨兵测试（src/domain/lang.ts 指向本文件）。
 *
 * 语言码同时决定数据面目录名、源站端点路径与 `<html lang>`，三处漂移的代价都很高，
 * 而 TS 只能守住「类型 ⊇ langs.json」这一半（见 lang.ts 的 LANG_META：
 * 「langs.json 与 LANG_META 同集合」「首项即默认语言」「自称不重复」都只能运行时守。
 */
import { describe, expect, it } from 'vitest'
import LANGS_JSON from '../src/domain/langs.json'
import { DEFAULT_LANG, LANGS, LANG_META, isLang } from '../src/domain/lang'
import type { Lang } from '../src/domain/lang'

describe('语言集单一事实源', () => {
  it('LANGS 逐项等于 langs.json（构建期 .mjs 侧读的就是这一份）', () => {
    expect([...LANGS]).toEqual([...LANGS_JSON])
  })

  it('规范清单哨兵：语言集就是这四种，加语言必须同时改类型/数据面/本用例', () => {
    // 这一条是**唯一能挡住「langs.json 多了语言」的守卫**：TS 侧 import JSON 只能推断成
    // string[]，`as readonly Lang[]` 会把多出的语言静默吃掉（见 lang.ts 的注释）。
    // 反方向（Lang 多了成员、langs.json 没跟上）由 lang.ts 的 LANG_META 编译期挡住。
    expect([...LANGS]).toEqual(['zh', 'en', 'ja', 'ko'])
  })

  it('首项即默认语言——构建期按 LANGS[0] 取「枚举用语言」的契约', () => {
    expect(LANGS[0]).toBe(DEFAULT_LANG)
  })

  it('LANG_META 与语言集同集合、且每一项自洽', () => {
    expect(Object.keys(LANG_META).sort()).toEqual([...LANGS].sort())
    for (const l of LANGS) {
      expect(LANG_META[l].code).toBe(l)
      expect(LANG_META[l].endonym.trim()).not.toBe('')
      expect(LANG_META[l].htmlLang).toMatch(/^[a-z]{2}(-[A-Za-z]{2,4})?$/)
    }
  })

  it('自称互不重复——切换入口不能出现两块同名板', () => {
    const endonyms = LANGS.map((l) => LANG_META[l].endonym)
    expect(new Set(endonyms).size).toBe(endonyms.length)
  })

  it('isLang 只认已登记语言（localStorage 脏值 / 数据目录名靠它挡）', () => {
    for (const l of LANGS) expect(isLang(l)).toBe(true)
    for (const bad of ['fr', 'ZH', '', 'zh-CN', null, undefined, 1, {}]) {
      expect(isLang(bad)).toBe(false)
    }
  })

  it('Lang 类型与语言集同宽（多一个成员就会在这行报错）', () => {
    const every: Record<Lang, true> = { zh: true, en: true, ja: true, ko: true }
    expect(Object.keys(every).sort()).toEqual([...LANGS].sort())
  })
})
