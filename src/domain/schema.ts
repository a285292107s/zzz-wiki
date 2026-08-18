/* ============================================================
 * 数据契约 schema — 单一事实源（DESIGN.md §5 / ADR-002）。
 *
 * 复刻 src/data/types.ts 的历史结构（含 [k: string]: unknown 兜底），
 * 由 build 管线 / verify-data 做运行时校验，前端类型经 z.infer 派生。
 *
 * 注意：类型由 schema 派生后，禁止在视图里新增裸 as 断言 ——
 * 结构变更先改 schema，再同步类型。
 * ============================================================ */

import { z } from 'zod'

/* ---------- 基础标量 ---------- */

/** 角色稀有度：3=A 4=S */
export const RarityCharSchema = z.union([z.literal(3), z.literal(4)])
/** 全品类稀有度：2=B 3=A 4=S */
export const RarityAllSchema = z.union([z.literal(2), z.literal(3), z.literal(4)])

/** 属性码：200-205 / 300（流明） */
export const AttrCodeSchema = z.union([
  z.literal(200), z.literal(201), z.literal(202), z.literal(203),
  z.literal(204), z.literal(205), z.literal(300),
])
/** 职业码：1-7（含 7=锋御 Armorer） */
export const SpecCodeSchema = z.union([
  z.literal(1), z.literal(2), z.literal(3), z.literal(4),
  z.literal(5), z.literal(6), z.literal(7),
])

/** 语言字段（四语 + 代号） */
export const LocaleFieldsSchema = z.object({
  en: z.string().optional(),
  zh: z.string().optional(),
  ja: z.string().optional(),
  ko: z.string().optional(),
})

/** 特殊属性展示块（烈霜/玄墨/凛刃 等，见 DATA_GUIDE §3） */
export const SpecialElementSchema = z
  .object({
    name: z.string().optional(),
    title: z.string().optional(),
    desc: z.string().optional(),
    icon: z.string().optional(),
  })
  .catchall(z.unknown())

/* ---------- 名录 payloads ---------- */

export const CharacterListItemSchema = z
  .object({
    Id: z.number(),
    code: z.string().optional(),
    rank: RarityCharSchema.optional(),
    type: SpecCodeSchema.optional(),
    element: AttrCodeSchema.optional(),
    /** 特殊属性展示名（构建期由详情 special_element_type.name 注入，如「烈霜」） */
    special_element: z.string().optional(),
    hit: z.number().optional(),
    camp: z.number().optional(),
    /** 阵营展示名（构建期由详情 camp 注入，如「狡兔屋」） */
    camp_name: z.string().optional(),
    icon: z.string().optional(),
    en: z.string().optional(),
    zh: z.string().optional(),
    ja: z.string().optional(),
    ko: z.string().optional(),
    desc: z.string().optional(),
  })
  .catchall(z.unknown())

export const WEngineListItemSchema = z
  .object({
    Id: z.number(),
    icon: z.string().optional(),
    rank: RarityAllSchema.optional(),
    type: SpecCodeSchema.optional(),
    en: z.string().optional(),
    zh: z.string().optional(),
    ja: z.string().optional(),
    ko: z.string().optional(),
  })
  .catchall(z.unknown())

export const BangbooListItemSchema = z
  .object({
    Id: z.number(),
    icon: z.string().optional(),
    rank: RarityCharSchema.optional(),
    codename: z.string().optional(),
    en: z.string().optional(),
    zh: z.string().optional(),
    ja: z.string().optional(),
    ko: z.string().optional(),
    desc: z.string().optional(),
  })
  .catchall(z.unknown())

/** 本地化字段对象（驱动盘名录的 zh 等是对象） */
export const LocaleInfoSchema = z
  .object({
    name: z.string().optional(),
    desc2: z.string().optional(),
    desc4: z.string().optional(),
  })
  .catchall(z.unknown())

export const DiskDriveListItemSchema = z
  .object({
    Id: z.number(),
    icon: z.string().optional(),
    en: LocaleInfoSchema.optional(),
    zh: LocaleInfoSchema.optional(),
    ja: LocaleInfoSchema.optional(),
    ko: LocaleInfoSchema.optional(),
  })
  .catchall(z.unknown())

/* ---------- 详情 payloads ---------- */

/** 详情键值映射（weapon_type / element_type / stats 等） */
export const PropMapSchema = z.record(z.union([z.string(), z.number()]))

export const PartnerInfoSchema = z
  .object({
    birthday: z.string().optional(),
    full_name: z.string().optional(),
    gender: z.string().optional(),
    stature: z.string().optional(),
    profile_desc: z.string().optional(),
    impressions: z.array(z.string()).optional(),
    impression_f: z.string().optional(),
    impression_m: z.string().optional(),
  })
  .catchall(z.unknown())
  .nullable()

export const CharacterDetailSchema = z
  .object({
    Id: z.number().optional(),
    id: z.number().optional(),
    icon: z.string().optional(),
    name: z.string().optional(),
    code_name: z.string().optional(),
    rarity: z.number().optional(),
    weapon_type: PropMapSchema.optional(),
    element_type: PropMapSchema.optional(),
    special_element_type: SpecialElementSchema.optional(),
    hit_type: PropMapSchema.optional(),
    camp: PropMapSchema.optional(),
    gender: z.number().optional(),
    partner_info: PartnerInfoSchema.optional(),
    stats: z
      .record(z.union([z.number(), z.string(), z.array(z.unknown())]))
      .optional(),
    level: z.record(z.unknown()).optional(),
    extra_level: z.record(z.unknown()).optional(),
    skill: z.record(z.unknown()).optional(),
    talent: z.record(z.unknown()).optional(),
    passive: z.record(z.unknown()).optional(),
    potential_detail: z.record(z.unknown()).optional(),
    skin: z.record(z.unknown()).optional(),
  })
  .catchall(z.unknown())

export const WEngineDetailSchema = z
  .object({
    Id: z.number().optional(),
    id: z.number().optional(),
    code_name: z.string().optional(),
    name: z.string().optional(),
    desc: z.string().optional(),
    desc2: z.string().optional(),
    desc3: z.string().optional(),
    rarity: z.number().optional(),
    icon: z.string().optional(),
    weapon_type: PropMapSchema.optional(),
    base_property: z
      .object({ name: z.string().optional(), name2: z.string().optional(), format: z.string().optional(), value: z.number().optional() })
      .catchall(z.unknown())
      .optional(),
    rand_property: z
      .object({ name: z.string().optional(), name2: z.string().optional(), format: z.string().optional(), value: z.number().optional() })
      .catchall(z.unknown())
      .optional(),
    talents: z.record(z.unknown()).optional(),
  })
  .catchall(z.unknown())

export const BangbooDetailSchema = z
  .object({
    Id: z.number().optional(),
    code_name: z.string().optional(),
    name: z.string().optional(),
    desc: z.string().optional(),
    rarity: z.number().optional(),
    icon: z.string().optional(),
    stats: z
      .record(z.union([z.number(), z.string(), z.array(z.unknown())]))
      .optional(),
    level: z.record(z.unknown()).optional(),
    skill: z.record(z.unknown()).optional(),
  })
  .catchall(z.unknown())

export const DiskDriveDetailSchema = z
  .object({
    Id: z.number().optional(),
    name: z.string().optional(),
    desc2: z.string().optional(),
    desc4: z.string().optional(),
    story: z.string().optional(),
    icon: z.string().optional(),
  })
  .catchall(z.unknown())

/* ---------- manifest ---------- */

export const ManifestSchema = z.object({
  zzz: z
    .object({
      latest: z.string(),
      live: z.string().optional(),
      source: z.string().optional(),
    })
    .catchall(z.unknown()),
  generated: z.string().optional(),
})

/* ---------- 类型导出（前端经 src/data/types.ts 二次导出使用） ---------- */

export type PropMap = z.infer<typeof PropMapSchema>
export type SpecialElement = z.infer<typeof SpecialElementSchema>
export type CharacterListItem = z.infer<typeof CharacterListItemSchema>
export type WEngineListItem = z.infer<typeof WEngineListItemSchema>
export type BangbooListItem = z.infer<typeof BangbooListItemSchema>
export type DiskDriveListItem = z.infer<typeof DiskDriveListItemSchema>
export type LocaleInfo = z.infer<typeof LocaleInfoSchema>
export type CharacterDetail = z.infer<typeof CharacterDetailSchema>
export type WEngineDetail = z.infer<typeof WEngineDetailSchema>
export type BangbooDetail = z.infer<typeof BangbooDetailSchema>
export type DiskDriveDetail = z.infer<typeof DiskDriveDetailSchema>
export type Manifest = z.infer<typeof ManifestSchema>