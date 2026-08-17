/* ============================================================
 * 详情页区块通用类型与纯函数 — 单一定义（DESIGN.md P2）。
 * AgentDetailView / WEngineDetailView 共用的行结构、网格项、
 * 技能槽位常量与字典→行转换。无 Vue 依赖，可单测。
 * ============================================================ */

/** 序号行（影画/精炼/技能描述共用） */
export interface DetailRow {
  no: number
  name?: string
  desc?: string
}

/** 技能行（键位、中文名、描述组） */
export interface SkillRow {
  key: SkillSlotKey
  zh: string
  keyEn: string
  descriptions?: Array<{ name?: string; desc?: string }>
}

/** KeyValueGrid 数值项 */
export interface StatItem {
  /** 标签（生命值/攻击力…） */
  label: string
  /** 显示值（已格式化） */
  value: string
  /** 可选角标（主属性/副属性） */
  tag?: string
}

/** 皮肤行（含缩略图资源名） */
export interface SkinRow {
  id: string
  name: string
  desc: string
  img: string
}

/** 将按键排序的字典（影画/精炼）转为 DetailRow[] */
export function dictToRows(
  dict: Record<string, unknown> | undefined | null,
): DetailRow[] {
  if (!dict) return []
  return Object.entries(dict)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([k, v]) => {
      const o = (v ?? {}) as { name?: string; desc?: string }
      return { no: Number(k), name: o.name, desc: o.desc }
    })
}

/* ---------- 技能槽位（角色详情） ---------- */

export const SKILL_ORDER = ['basic', 'dodge', 'special', 'chain', 'assist', 'core'] as const
export type SkillSlotKey = (typeof SKILL_ORDER)[number]


export const SKILL_ZH: Record<SkillSlotKey, string> = {
  basic: '普通攻击',
  dodge: '闪避',
  special: '特殊技',
  chain: '连携技',
  assist: '支援技',
  core: '核心技',
}

/** 技能键位纹章：等宽键名 */
export const SKILL_KEYS: Record<SkillSlotKey, { en: string }> = {
  basic: { en: 'NORMAL' },
  dodge: { en: 'DODGE' },
  special: { en: 'SPECIAL' },
  chain: { en: 'CHAIN' },
  assist: { en: 'ASSIST' },
  core: { en: 'CORE' },
}

/** 从角色详情的 skill 字典构建有序 SkillRow[]（按游戏 UI 顺序） */
export function buildSkillRows(
  skill: Record<string, unknown> | undefined | null,
): SkillRow[] {
  if (!skill) return []
  return SKILL_ORDER.filter((k) => skill[k] != null).map((k) => ({
    key: k,
    zh: SKILL_ZH[k] ?? k,
    keyEn: SKILL_KEYS[k]?.en ?? k.toUpperCase(),
    descriptions: (skill[k] as { description?: unknown })?.description as
      | Array<{ name?: string; desc?: string }>
      | undefined,
  }))
}

/** 从皮肤字典构建有序 SkinRow[]（按皮肤 id 排序） */
export function buildSkinRows(
  skins: Record<string, unknown> | undefined | null,
): SkinRow[] {
  if (!skins) return []
  return Object.entries(skins)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([k, v]) => ({
      id: k,
      name: (v as { name?: string }).name ?? '',
      desc: (v as { desc?: string }).desc ?? '',
      img: (v as { image?: string }).image ?? '',
    }))
}