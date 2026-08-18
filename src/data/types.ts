/* ============================================================
   Data model types — 由 src/domain/schema.ts（zod 单一事实源）派生。
   本文件只做类型再导出：新增/修改字段先改 schema，禁止在视图里裸 as。
   所在关系：schema（定义）→ 本文件（派生导出）→ api/resources（消费）。
   ============================================================ */

export { ELEMENTS, PROFESSIONS, RANK_TO_TIER } from '@/domain/enums'
export type { AttrCode, SpecCode, RarityChar, RarityAll } from '@/domain/enums'

export type {
  AttrCodeSchema,
  SpecCodeSchema,
  RarityCharSchema,
  RarityAllSchema,
  LocaleFieldsSchema,
  CharacterListItemSchema,
  WEngineListItemSchema,
  BangbooListItemSchema,
  LocaleInfoSchema,
  DiskDriveListItemSchema,
  PropMapSchema,
  SpecialElementSchema,
  PartnerInfoSchema,
  CharacterDetailSchema,
  WEngineDetailSchema,
  BangbooDetailSchema,
  DiskDriveDetailSchema,
  ManifestSchema,
} from '@/domain/schema'

export type {
  PropMap,
  SpecialElement,
  CharacterListItem,
  WEngineListItem,
  BangbooListItem,
  DiskDriveListItem,
  LocaleInfo,
  CharacterDetail,
  WEngineDetail,
  BangbooDetail,
  DiskDriveDetail,
  Manifest,
} from '@/domain/schema'
