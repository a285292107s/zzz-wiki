/* ============================================================
 * 枚举解码映射 — 单一事实源（DESIGN.md §5.2）。
 * Numeric element/specialty ids are decoded via these maps.
 * 由 src/data/types.ts 再导出以保持既有 import 面。
 * ============================================================ */

export type AttrCode = 200 | 201 | 202 | 203 | 204 | 205 | 300

export const ELEMENTS: Record<AttrCode, { en: string; zh: string; color: string }> = {
  200: { en: 'Physical', zh: '物理', color: '#c8a35c' },
  201: { en: 'Fire', zh: '火', color: '#d4653f' },
  202: { en: 'Ice', zh: '冰', color: '#5d9bc2' },
  203: { en: 'Electric', zh: '电', color: '#a06fc4' },
  204: { en: 'Wind', zh: '风', color: '#6fbfa0' },
  205: { en: 'Ether', zh: '以太', color: '#4bb8a0' },
  // 300 = Lumen / 流明：蕾米埃尔的特殊属性（非标准五属性）
  300: { en: 'Lumiflux', zh: '流明', color: '#c98ad8' },
}

export type SpecCode = 1 | 2 | 3 | 4 | 5 | 6 | 7

export const PROFESSIONS: Record<SpecCode, { en: string; zh: string }> = {
  1: { en: 'Attack', zh: '强攻' },
  2: { en: 'Stun', zh: '击破' },
  3: { en: 'Anomaly', zh: '异常' },
  4: { en: 'Support', zh: '支援' },
  5: { en: 'Defense', zh: '防护' },
  6: { en: 'Rupture', zh: '命破' },
  // 7 = Armorer / 锋御（hakushin raw 3.2.3：1611 克拉蕾；ZenlessData 职业表暂未收录）
  7: { en: 'Armorer', zh: '锋御' },
}

/** 攻击方式枚举（构建管线 hit_type 用；与原 HIT_EN 对齐） */
export type HitCode = 101 | 102 | 103

export const HIT_TYPES: Record<HitCode, { en: string; zh: string }> = {
  101: { en: 'Slash', zh: '斩击' },
  102: { en: 'Strike', zh: '打击' },
  103: { en: 'Pierce', zh: '贯穿' },
}

/**
 * 合法属性码白名单 —— 由 ELEMENTS 派生，禁止手写。
 * 用途：useCatalogList 的 URL query 参数校验（非法 attr → 回退 all）。
 * 新增属性（如 300 流明）只需改 ELEMENTS，白名单自动同步。
 */
export const ATTR_CODES: AttrCode[] = Object.keys(ELEMENTS).map(Number) as AttrCode[]

/**
 * 合法职业码白名单 —— 由 PROFESSIONS 派生，禁止手写。
 * 用途：useCatalogList 的 URL query 参数校验（非法 prof → 回退 all）。
 * 新增职业（如 7 锋御）只需改 PROFESSIONS，白名单自动同步。
 */
export const SPEC_CODES: SpecCode[] = Object.keys(PROFESSIONS).map(Number) as SpecCode[]

export type RarityChar = 3 | 4
export type RarityAll = 2 | 3 | 4

/** Rank → displayed tier: characters/bangboos use 3=A, 4=S;
 *  weapons also have B at rank 2. */
export const RANK_TO_TIER: Record<number, 'S' | 'A' | 'B'> = {
  2: 'B',
  3: 'A',
  4: 'S',
}
