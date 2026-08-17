/* ============================================================
   Data model types — 本地静态数据（scripts/build-data.mjs 生成，
   契约蓝本为旧 static.nanoka.cc ZZZ 数据）。Numeric element/
   specialty ids are decoded by ELEMENTS / PROFESSIONS maps below.
   List payloads are dicts keyed by id; detail payloads are single
   objects. Fields are defensive.
   ============================================================ */

/* ---------- element / specialty decoding ----------
 * 单一事实源：src/domain/enums.ts（DESIGN.md §5.2）。这里只做再导出，
 * 保持既有「从 @/data/types 引入」的调用面不变。 */

import type { AttrCode, RarityAll, RarityChar, SpecCode } from '@/domain/enums'
export { ELEMENTS, PROFESSIONS, RANK_TO_TIER } from '@/domain/enums'
export type { AttrCode, RarityAll, RarityChar, SpecCode } from '@/domain/enums'

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