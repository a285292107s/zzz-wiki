/* ============================================================
 * 枚举解码映射 — 单一事实源（DESIGN.md §5.2）。
 * Numeric element/specialty ids are decoded via these maps.
 * 由 src/data/types.ts 再导出以保持既有 import 面。
 *
 * **标签四语齐全**（决策记录 0011）：`label` 是 `Loc`（zh/en/ja/ko）。
 * **en/ja/ko 三语的游戏术语取自源站官方译名**（hakushin raw 的
 * `element_type` / `weapon_type` / `hit_type` 值域并集，2026-10 实测），
 * 不是自译；`en` 同时是构建管线的规整值来源（scripts/build/normalize.ts 的 enVal），
 * 故改动 label 会直接影响数据面写入的英文枚举值。
 *
 * ⚠ zh 保留站内**短标签**写法（火/冰/电/风，源站写「火属性/冰属性/电属性/风属性」）：
 * 标签栏与表格列宽按短式设计，且这是既有界面文案，本轮不顺手改中文。
 * ============================================================ */

import type { Loc } from './lang'

export type AttrCode = 200 | 201 | 202 | 203 | 204 | 205 | 300

export interface AttrMeta {
  /** 属性名（四语；ja/ko/en 为源站官方译名） */
  label: Loc
  /** 标签色（语言无关） */
  color: string
}

export const ELEMENTS: Record<AttrCode, AttrMeta> = {
  200: { label: { zh: '物理', en: 'Physical', ja: '物理', ko: '물리' }, color: '#c8a35c' },
  201: { label: { zh: '火', en: 'Fire', ja: '炎', ko: '불 속성' }, color: '#d4653f' },
  202: { label: { zh: '冰', en: 'Ice', ja: '氷', ko: '얼음 속성' }, color: '#5d9bc2' },
  203: { label: { zh: '电', en: 'Electric', ja: '電気', ko: '전기 속성' }, color: '#a06fc4' },
  204: { label: { zh: '风', en: 'Wind', ja: '風', ko: '바람 속성' }, color: '#6fbfa0' },
  205: { label: { zh: '以太', en: 'Ether', ja: 'エーテル', ko: '에테르' }, color: '#4bb8a0' },
  // 300 = Lumen / 流明：蕾米埃尔的特殊属性（非标准五属性）
  300: { label: { zh: '流明', en: 'Lumiflux', ja: '流明', ko: '루멘' }, color: '#c98ad8' },
}

export type SpecCode = 1 | 2 | 3 | 4 | 5 | 6 | 7

export const PROFESSIONS: Record<SpecCode, { label: Loc }> = {
  1: { label: { zh: '强攻', en: 'Attack', ja: '強攻', ko: '강공' } },
  2: { label: { zh: '击破', en: 'Stun', ja: '撃破', ko: '격파' } },
  3: { label: { zh: '异常', en: 'Anomaly', ja: '異常', ko: '이상' } },
  4: { label: { zh: '支援', en: 'Support', ja: '支援', ko: '지원' } },
  5: { label: { zh: '防护', en: 'Defense', ja: '防護', ko: '방어' } },
  6: { label: { zh: '命破', en: 'Rupture', ja: '命破', ko: '명파' } },
  // 7 = Armorer / 锋御（hakushin raw 3.2.3：1611 克拉蕾；ZenlessData 职业表暂未收录）
  7: { label: { zh: '锋御', en: 'Armorer', ja: '鋭御', ko: '단조' } },
}

/** 攻击方式枚举（构建管线 hit_type 用；与原 HIT_EN 对齐） */
export type HitCode = 101 | 102 | 103

export const HIT_TYPES: Record<HitCode, { label: Loc }> = {
  101: { label: { zh: '斩击', en: 'Slash', ja: '斬撃', ko: '베기' } },
  102: { label: { zh: '打击', en: 'Strike', ja: '打撃', ko: '타격' } },
  // zh 用站内既有的「贯穿」（源站写「穿透」），en 仍取官方 Pierce
  103: { label: { zh: '贯穿', en: 'Pierce', ja: '刺突', ko: '꿰뚫기' } },
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
