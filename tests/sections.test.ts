import { describe, expect, it } from 'vitest'
import {
  SKILL_KEYS,
  SKILL_ORDER,
  SKILL_ZH,
  buildSkillRows,
  buildSkinRows,
  dictToRows,
} from '../src/domain/sections'

describe('dictToRows', () => {
  it('returns [] for null/undefined', () => {
    expect(dictToRows(null)).toEqual([])
    expect(dictToRows(undefined)).toEqual([])
  })

  it('sorts by numeric key and maps name/desc', () => {
    const rows = dictToRows({
      '2': { name: '影画2', desc: 'd2' },
      '1': { name: '影画1', desc: 'd1' },
    })
    expect(rows.map((r) => r.no)).toEqual([1, 2])
    expect(rows[0]).toMatchObject({ no: 1, name: '影画1', desc: 'd1' })
  })

  it('tolerates entries without name/desc', () => {
    const rows = dictToRows({ '1': { other: true } })
    expect(rows[0]).toMatchObject({ no: 1 })
    expect(rows[0].name).toBeUndefined()
  })
})

describe('skill helpers', () => {
  it('SKILL_ORDER covers the six core slots in game UI order', () => {
    expect(SKILL_ORDER).toEqual(['basic', 'dodge', 'special', 'chain', 'assist', 'core'])
    expect(SKILL_ZH.basic).toBe('普通攻击')
    expect(SKILL_KEYS.core.en).toBe('CORE')
  })

  it('buildSkillRows filters missing slots and keeps order', () => {
    const rows = buildSkillRows({
      special: { description: [{ name: 'X' }] },
      basic: { description: [{ name: 'Y' }] },
    })
    expect(rows.map((r) => r.key)).toEqual(['basic', 'special'])
  })

  it('buildSkillRows returns [] for empty input', () => {
    expect(buildSkillRows(undefined)).toEqual([])
    expect(buildSkillRows({})).toEqual([])
  })
})

describe('buildSkinRows', () => {
  it('sorts by skin id and provides defaults', () => {
    const rows = buildSkinRows({
      '2': { name: '乙' },
      '1': { desc: '甲之描述' },
    })
    expect(rows.map((r) => r.id)).toEqual(['1', '2'])
    expect(rows[0]).toMatchObject({ id: '1', name: '', desc: '甲之描述', img: '' })
  })

  it('returns [] for empty input', () => {
    expect(buildSkinRows(null)).toEqual([])
  })
})
