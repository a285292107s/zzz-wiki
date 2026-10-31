import { describe, expect, it } from 'vitest'
import {
  CATALOG,
  GUIDE_ENTRIES,
  NAV_ENTRIES,
  SITE_INFO_ENTRIES,
  guideForPath,
} from '../src/domain/catalog'
import { LANGS, pickText } from '../src/domain/lang'

const HOME_ENTRIES = [...CATALOG, ...GUIDE_ENTRIES]

describe('catalog 入口契约', () => {
  it('首页目录编号连续：01–06，不留空号（页脚说明页不占位次）', () => {
    expect(HOME_ENTRIES.map((e) => e.no)).toEqual(['01', '02', '03', '04', '05', '06'])
  })

  it('站头导航 = 全部数据类目 + 进主导航的图文板块', () => {
    expect(NAV_ENTRIES.map((e) => e.to)).toEqual([
      ...CATALOG.map((c) => c.path),
      ...GUIDE_ENTRIES.filter((g) => g.nav).map((g) => g.path),
    ])
  })

  it('底部栏短标签四语齐全', () => {
    for (const lang of LANGS) {
      for (const c of CATALOG) {
        expect(pickText(c.tabLabel, lang).trim(), `${lang} ${c.path}`).not.toBe('')
      }
    }
  })

  it('站点说明页不进首页目录、不进站头导航', () => {
    const listed = new Set(HOME_ENTRIES.map((e) => e.path))
    for (const e of SITE_INFO_ENTRIES) {
      expect(listed.has(e.path), e.path).toBe(false)
      expect(NAV_ENTRIES.some((n) => n.to === e.path), e.path).toBe(false)
    }
  })

  it('页脚说明页名四语齐全（页脚取这一份，不另写文案）', () => {
    for (const lang of LANGS) {
      for (const e of SITE_INFO_ENTRIES) {
        expect(pickText(e.label, lang).trim(), `${lang} ${e.path}`).not.toBe('')
      }
    }
  })

  it('guideForPath 覆盖两处清单，未登记路径返回 undefined', () => {
    for (const e of [...GUIDE_ENTRIES, ...SITE_INFO_ENTRIES]) {
      expect(guideForPath(e.path)?.label, e.path).toBe(e.label)
    }
    expect(guideForPath('/nope')).toBeUndefined()
  })
})
