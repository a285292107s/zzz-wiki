import { describe, expect, it } from 'vitest'
import { SKILL_KEYS, SKILL_LABELS, SKILL_ORDER } from '../src/domain/sections'

describe('sections 常量契约', () => {
  it('SKILL_ORDER 固定七槽，槽位名四语齐全、键位字形逐槽齐全', () => {
    expect([...SKILL_ORDER]).toEqual([
      'basic', 'special', 'chain', 'ultimate', 'assist', 'dodge', 'core',
    ])
    for (const k of SKILL_ORDER) {
      for (const l of ['zh', 'en', 'ja', 'ko'] as const) {
        expect(SKILL_LABELS[k][l], `SKILL_LABELS.${k}.${l}`).toBeTruthy()
      }
      expect(SKILL_KEYS[k]?.glyph, `SKILL_KEYS.${k}.glyph`).toBeTruthy()
      expect(SKILL_KEYS[k]?.en.length ?? 0, `SKILL_KEYS.${k}.en`).toBeGreaterThan(0)
    }
  })
})
