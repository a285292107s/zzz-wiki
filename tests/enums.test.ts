import { describe, expect, it } from 'vitest'
import {
  ELEMENTS,
  HIT_TYPES,
  PROFESSIONS,
  RANK_TO_TIER,
} from '../src/domain/enums'

describe('ELEMENTS', () => {
  it('covers all 7 known element codes', () => {
    expect(Object.keys(ELEMENTS).map(Number).sort()).toEqual([
      200, 201, 202, 203, 204, 205, 300,
    ])
  })

  it('maps 200 to 物理 / Physical', () => {
    expect(ELEMENTS[200]).toMatchObject({ en: 'Physical', zh: '物理' })
  })

  it('maps 300 to 流明 / Lumiflux', () => {
    expect(ELEMENTS[300]).toMatchObject({ en: 'Lumiflux', zh: '流明' })
  })

  it('every element carries a color token', () => {
    for (const el of Object.values(ELEMENTS)) {
      expect(el.color).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })
})

describe('PROFESSIONS', () => {
  it('covers combat roles 1..7 (incl. Armorer 7 = 锋御)', () => {
    expect(Object.keys(PROFESSIONS).map(Number).sort()).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ])
    expect(PROFESSIONS[7]).toMatchObject({ en: 'Armorer', zh: '锋御' })
    expect(PROFESSIONS[1]).toMatchObject({ en: 'Attack', zh: '强攻' })
  })
})

describe('HIT_TYPES', () => {
  it('covers slash/strike/pierce', () => {
    expect(HIT_TYPES[101]).toMatchObject({ en: 'Slash' })
    expect(HIT_TYPES[102]).toMatchObject({ en: 'Strike' })
    expect(HIT_TYPES[103]).toMatchObject({ en: 'Pierce' })
  })
})

describe('RANK_TO_TIER', () => {
  it('maps 2=B 3=A 4=S', () => {
    expect(RANK_TO_TIER[2]).toBe('B')
    expect(RANK_TO_TIER[3]).toBe('A')
    expect(RANK_TO_TIER[4]).toBe('S')
  })
})
