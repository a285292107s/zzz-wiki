/* ============================================================
   Data model types — mirror hakush.in ZZZ JSON payloads.
   Field presence is defensive: upstream payloads vary across
   versions, so almost everything is optional save for ids/names.
   ============================================================ */

export type Attribute =
  | 'Physical'
  | 'Fire'
  | 'Ice'
  | 'Electric'
  | 'Ether'

export type AttributeZh = '物理' | '火' | '冰' | '电' | '以太'

export const ATTRIBUTES: Record<Attribute, { zh: string; color: string }> = {
  Physical: { zh: '物理', color: '#c8a35c' },
  Fire: { zh: '火', color: '#d4653f' },
  Ice: { zh: '冰', color: '#5d9bc2' },
  Electric: { zh: '电', color: '#a06fc4' },
  Ether: { zh: '以太', color: '#4bb8a0' },
}

export type Profession = 'Attack' | 'Defense' | 'Anomaly' | 'Stun' | 'Support'

export const PROFESSIONS: Record<Profession, string> = {
  Attack: '强攻',
  Defense: '防护',
  Anomaly: '异常',
  Stun: '击破',
  Support: '支援',
}

/* ---------- list payloads ---------- */

export interface CharacterListItem {
  Id: number
  Name: string
  Rarity: 1 | 2 | 3 | 4 | 5
  Attribute?: Attribute
  Profession?: Profession
  Camp?: string
  Sex?: string
  Release?: string | number
  Icon?: string
  OtherName?: string
  [k: string]: unknown
}

export interface WEngineListItem {
  Id: number
  Name: string
  Rarity: 1 | 2 | 3 | 4 | 5
  Attribute?: Attribute
  Specialty?: Profession
  Icon?: string
  [k: string]: unknown
}

export interface BangbooListItem {
  Id: number
  Name: string
  Rarity: 1 | 2 | 3 | 4 | 5
  Attribute?: Attribute
  Icon?: string
  [k: string]: unknown
}

export interface DiskDriveListItem {
  Id: number
  Name: string
  Rarity?: number[]
  Icon?: string
  [k: string]: unknown
}

export type ListRecord =
  | CharacterListItem
  | WEngineListItem
  | BangbooListItem
  | DiskDriveListItem

/* ---------- detail payloads ---------- */

export interface SkillEntry {
  Id?: number
  Name?: string
  Type?: string
  Desc?: string
  LevelData?: Array<Record<string, unknown>>
  [k: string]: unknown
}

export interface TalentEntry {
  Id?: number
  Name?: string
  Desc?: string
  [k: string]: unknown
}

export interface CharacterDetail {
  Id?: number
  Name?: string
  Rarity?: number
  Attribute?: Attribute
  Profession?: Profession
  Camp?: string
  HP?: number
  ATK?: number
  DEF?: number
  Impact?: number
  CritRate?: number
  CritDMG?: number
  PenRatio?: number
  AnomalyMastery?: number
  AnomalyProficiency?: number
  EnergyRegen?: number
  CoreSkill?: Record<string, unknown>
  SkillList?: SkillEntry[]
  TalentList?: TalentEntry[]
  [k: string]: unknown
}

export interface WEngineDetail {
  Id?: number
  Name?: string
  Rarity?: number
  Specialty?: Profession
  Icon?: string
  [k: string]: unknown
}

export interface BangbooDetail {
  Id?: number
  Name?: string
  Rarity?: number
  Icon?: string
  [k: string]: unknown
}

export interface DiskDriveDetail {
  Id?: number
  Name?: string
  Rarity?: number
  [k: string]: unknown
}

export type DetailRecord =
  | CharacterDetail
  | WEngineDetail
  | BangbooDetail
  | DiskDriveDetail