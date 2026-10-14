/* ============================================================
 * sections 常量契约哨兵用例。
 * 这些导出驱动着渲染顺序与文案（技能槽序、徽章字形、等级区间），
 * 此前无任何覆盖——回归（如误改槽位顺序）不会红。此处锁定其值：
 * 修改必须是有意的契约变更。
 * ============================================================ */

import { describe, expect, it } from 'vitest'
import {
  BANGBOO_LEVEL_DEFAULT,
  BANGBOO_LEVEL_MAX,
  BANGBOO_LEVEL_MIN,
  BANGBOO_SKILL_ORDER,
  BANGBOO_SKILL_LABELS,
  CHAR_LEVEL_DEFAULT,
  CHAR_LEVEL_MAX,
  CHAR_LEVEL_MIN,
  isPotentialGated,
  MINDSCAPE_SKILL_LEVEL_BONUS,
  POTENTIAL_ID_MIN,
  SKILL_KEYS,
  SKILL_LEVEL_CAP,
  SKILL_LEVEL_DEFAULT,
  SKILL_LEVEL_MAX,
  SKILL_LEVEL_MIN,
  SKILL_ORDER,
  SKILL_LABELS,
  W_ENGINE_LEVEL_DEFAULT,
  W_ENGINE_LEVEL_MAX,
  W_ENGINE_LEVEL_MIN,
  W_ENGINE_REFINE_MAX,
  W_ENGINE_REFINE_MIN,
} from '../src/domain/sections'

describe('sections 常量契约（哨兵）', () => {
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

  it('BANGBOO_SKILL_ORDER 三槽与槽位名一致（四语齐全）', () => {
    expect([...BANGBOO_SKILL_ORDER]).toEqual(['a', 'b', 'c'])
    expect(BANGBOO_SKILL_LABELS.a.zh).toBe('主动技')
    expect(BANGBOO_SKILL_LABELS.b.zh).toBe('额外能力')
    expect(BANGBOO_SKILL_LABELS.c.zh).toBe('邦布连携技')
    for (const k of BANGBOO_SKILL_ORDER) {
      for (const l of ['zh', 'en', 'ja', 'ko'] as const) {
        expect(BANGBOO_SKILL_LABELS[k][l], `BANGBOO_SKILL_LABELS.${k}.${l}`).toBeTruthy()
      }
    }
  })

  it('技能等级：基础上限 12、默认 12，影画加成把可达上限抬到 16', () => {
    expect(SKILL_LEVEL_MIN).toBe(1)
    expect(SKILL_LEVEL_MAX).toBe(12)
    expect(SKILL_LEVEL_CAP).toBe(16)
    // 默认等级必须停在基础上限（12），不能被影画上限顶到 16
    expect(SKILL_LEVEL_DEFAULT).toBe(SKILL_LEVEL_MAX)
  })

  it('影画加成总量 = 影画 3 与影画 5 各 +2（live 60 名角色口径一致）', () => {
    expect(MINDSCAPE_SKILL_LEVEL_BONUS).toBe(4)
    expect(SKILL_LEVEL_CAP).toBe(SKILL_LEVEL_MAX + MINDSCAPE_SKILL_LEVEL_BONUS)
  })

  it('三类实体等级区间均为 1–60、默认满级', () => {
    expect([CHAR_LEVEL_MIN, CHAR_LEVEL_MAX, CHAR_LEVEL_DEFAULT]).toEqual([1, 60, 60])
    expect([W_ENGINE_LEVEL_MIN, W_ENGINE_LEVEL_MAX, W_ENGINE_LEVEL_DEFAULT]).toEqual([1, 60, 60])
    expect([BANGBOO_LEVEL_MIN, BANGBOO_LEVEL_MAX, BANGBOO_LEVEL_DEFAULT]).toEqual([1, 60, 60])
  })

  it('音擎精炼阶数 1–5（满精炼 5 阶）：档位键即阶数，滑条口径与之一致', () => {
    expect([W_ENGINE_REFINE_MIN, W_ENGINE_REFINE_MAX]).toEqual([1, 5])
  })

  it('潜能门控阈值 POTENTIAL_ID_MIN=100000：基础版 [0] 不算门控', () => {
    expect(POTENTIAL_ID_MIN).toBe(100000)
    expect(isPotentialGated(undefined)).toBe(false)
    expect(isPotentialGated([])).toBe(false)
    expect(isPotentialGated([0])).toBe(false)
    expect(isPotentialGated([POTENTIAL_ID_MIN - 1])).toBe(false)
    expect(isPotentialGated([POTENTIAL_ID_MIN])).toBe(true)
  })
})
