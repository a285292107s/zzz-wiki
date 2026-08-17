/* ============================================================
   Data model types — 本地静态数据（scripts/build-data.mjs 生成，
   契约蓝本为旧 static.nanoka.cc ZZZ 数据）。Numeric element/
   specialty ids are decoded by ELEMENTS / PROFESSIONS maps below.
   List payloads are dicts keyed by id; detail payloads are single
   objects. Fields are defensive.
   ============================================================ */

/* ---------- element / specialty decoding ---------- */

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

export type RarityChar = 3 | 4
export type RarityAll = 2 | 3 | 4

/** Rank → displayed tier: characters/bangboos use 3=A, 4=S;
 *  weapons also have B at rank 2. */
export const RANK_TO_TIER: Record<number, 'S' | 'A' | 'B'> = {
  2: 'B',
  3: 'A',
  4: 'S',
}

/* ---------- list payloads ---------- */

export interface CharacterListItem {
  Id: number
  code?: string
  rank?: RarityChar
  type?: SpecCode
  element?: AttrCode
  hit?: number
  camp?: number
  icon?: string
  en?: string
  zh?: string
  ja?: string
  ko?: string
  desc?: string
  [k: string]: unknown
}

export interface WEngineListItem {
  Id: number
  icon?: string
  rank?: RarityAll
  type?: SpecCode
  en?: string
  zh?: string
  ja?: string
  ko?: string
  [k: string]: unknown
}

export interface BangbooListItem {
  Id: number
  icon?: string
  rank?: RarityChar
  codename?: string
  en?: string
  zh?: string
  ja?: string
  ko?: string
  desc?: string
  [k: string]: unknown
}

export interface LocaleInfo {
  name?: string
  desc2?: string
  desc4?: string
  [k: string]: unknown
}

export interface DiskDriveListItem {
  Id: number
  icon?: string
  en?: LocaleInfo
  zh?: LocaleInfo
  ja?: LocaleInfo
  ko?: LocaleInfo
  [k: string]: unknown
}

/* ---------- detail payloads ---------- */

export interface PropMap {
  [id: string]: string | number
}

export interface CharacterDetail {
  Id: number
  /** 详情载荷用 `id`（小写），名录用 `Id`（大写） */
  id?: number
  icon?: string
  name?: string
  code_name?: string
  rarity?: number
  weapon_type?: PropMap
  element_type?: PropMap
  hit_type?: PropMap
  camp?: PropMap
  gender?: number
  partner_info?: {
    birthday?: string
    full_name?: string
    gender?: string
    stature?: string
    profile_desc?: string
    impressions?: string[]
    impression_f?: string
    impression_m?: string
    [k: string]: unknown
  } | null
  stats?: Record<string, number>
  level?: Record<string, {
    hp_max?: number
    attack?: number
    defence?: number
    level_max?: number
    level_min?: number
    materials?: Record<string, number>
    [k: string]: unknown
  }>
  extra_level?: Record<string, {
    max_level?: number
    extra?: Record<string, {
      prop?: number
      name?: string
      format?: string
      value?: number
    }>
    [k: string]: unknown
  }>
  skill?: Record<string, {
    description?: Array<{
      name?: string
      desc?: string
      param?: unknown
      [k: string]: unknown
    }>
    [k: string]: unknown
  }>
  talent?: Record<string, {
    name?: string
    desc?: string
    desc2?: string
    [k: string]: unknown
  }>
  passive?: Record<string, unknown>
  potential_detail?: Record<string, unknown>
  skin?: Record<string, unknown>
  [k: string]: unknown
}

export interface WEngineDetail {
  Id: number
  /** 详情载荷用 `id`（小写）、code_name 为英文名 */
  id?: number
  code_name?: string
  name?: string
  desc?: string
  desc2?: string
  desc3?: string
  rarity?: number
  icon?: string
  weapon_type?: PropMap
  base_property?: {
    name?: string
    name2?: string
    format?: string
    value?: number
  }
  rand_property?: {
    name?: string
    name2?: string
    format?: string
    value?: number
  }
  talents?: Record<string, {
    name?: string
    desc?: string
    [k: string]: unknown
  }>
  [k: string]: unknown
}

export interface BangbooDetail {
  Id: number
  code_name?: string
  name?: string
  desc?: string
  rarity?: number
  icon?: string
  stats?: Record<string, number>
  level?: Record<string, unknown>
  skill?: Record<string, unknown>
  [k: string]: unknown
}

export interface DiskDriveDetail {
  Id: number
  name?: string
  desc2?: string
  desc4?: string
  story?: string
  icon?: string
  [k: string]: unknown
}