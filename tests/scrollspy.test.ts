import { describe, expect, it } from 'vitest'
import { NAV_SLOP, resolveActiveSection, type SectionTop } from '../src/domain/scrollspy'

const tops = (rows: Array<[string, number | null]>): SectionTop[] =>
  rows.map(([id, top]) => ({ id, top }))

describe('resolveActiveSection', () => {
  it('returns null for empty tops', () => {
    expect(resolveActiveSection([], false, 156)).toBeNull()
    expect(resolveActiveSection([], true, 156)).toBeNull()
  })

  it('picks the latest section whose top is within the limit (01 停靠位场景)', () => {
    // 点击 01 后：head 早已过线、dossier 顶恰在停靠位、profile 还在线外
    expect(
      resolveActiveSection(tops([['head', -415], ['dossier', 76], ['profile', 299], ['stats', 680]]), false, 156),
    ).toBe('dossier')
  })

  it('picks the next section after scrolling further (02 场景)', () => {
    expect(
      resolveActiveSection(tops([['dossier', -147], ['profile', 76], ['stats', 457]]), false, 156),
    ).toBe('profile')
  })

  it('honors the limit boundary (top === limit 仍进线)', () => {
    expect(resolveActiveSection(tops([['a', 156], ['b', 157]]), false, 156)).toBe('a')
  })

  it('keeps the first section while no section crosses the line (大空隙)', () => {
    expect(resolveActiveSection(tops([['head', 300], ['dossier', 500]]), false, 156)).toBe('head')
  })

  it('skips missing elements (top null) without crashing', () => {
    expect(
      resolveActiveSection(tops([['a', null], ['b', 200], ['c', 50]]), false, 156),
    ).toBe('c')
  })

  it('returns the last section at the physical bottom even if it cannot reach the stop', () => {
    // 末块 top 230 > limit：底部特判直接点亮末项，不再顺延倒数第二块
    const sections = tops([['talents', -473], ['impressions', 230]])
    expect(resolveActiveSection(sections, true, 156)).toBe('impressions')
  })
})

describe('NAV_SLOP', () => {
  it('matches the FormulasView precedent value', () => {
    expect(NAV_SLOP).toBe(80)
  })
})