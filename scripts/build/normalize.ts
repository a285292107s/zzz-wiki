/* ============================================================
 * normalize.ts — 规整纯函数（原 build-data.mjs 迁出）。
 * 英文枚举值改从 src/domain/enums.ts 复用（DESIGN.md §5.2）：
 * 前端 domain 与 build 管线共享同一事实源，杜绝 PROFESSIONS 漂移。
 * ============================================================ */

import { ELEMENTS, HIT_TYPES, PROFESSIONS } from '../../src/domain/enums'

/** 资源路径 → 裸文件名（去目录、去扩展名），图标 CDN 命名规则 */
export const basename = (p: string | null | undefined): string =>
  (p || '').split('/').pop()?.replace(/\.(png|webp)$/i, '') ?? ''

/** 属性/职业/攻击方式 → 英文名（由 domain/enums 生成） */
export const ELEMENT_EN: Record<string, string> = Object.fromEntries(
  Object.entries(ELEMENTS).map(([k, v]) => [k as string, v.en]),
)
export const SPECIALTY_EN: Record<string, string> = Object.fromEntries(
  Object.entries(PROFESSIONS).map(([k, v]) => [k as string, v.en]),
)
export const HIT_EN: Record<string, string> = Object.fromEntries(
  Object.entries(HIT_TYPES).map(([k, v]) => [k as string, v.en]),
)

/** nanoka 素材 CDN 已知缺口：这些皮肤的美术图未上传（实测 404），回退默认立绘避免死链。 */
export const SKIN_IMAGE_FALLBACK: Record<string, string> = {
  'IconRole34_03': 'IconRole34', // 哲 第 3 套皮肤
  'IconRole33_03': 'IconRole33', // 铃 第 3 套皮肤
}

/**
 * 角色头像统一采用「IconRoleGeneral 系列横幅图」（DESIGN.md 扩展决策）。
 * 规则：角色默认立绘 IconRole{N} → 头像用同号段 IconRoleGeneral{N}。
 * 覆盖表 AVATAR_OVERRIDE 可显式指定个别角色（键=数字 id，值=资产名）。
 * 列表 icon 字段在构建期落地为最终头像名，前端 icons.ts / HollowImage 零改动，
 * 运行时零外部请求。前端候选链仍保留 IconRole 兜底，个别资源 404 时自动回退原头像。
 */
export const AVATAR_OVERRIDE: Record<number, string> = {
  // 无号段/需特判的角色在此显式指定：蕾米埃尔（默认 IconRole67）→ General67
  1581: 'IconRoleGeneral67',
}

/** 数字 id → 默认矢量图标号段（IconRole{N} 的 N）；无则 null。 */
export function roleIconNumber(id: number | undefined, asset: string | undefined): number | null {
  if (id == null) return null
  // 覆盖表优先
  if (AVATAR_OVERRIDE[id]) return null // 由 override 全量接管（含 General 名）
  const m = (asset ?? '').match(/IconRole(\d+)/)
  if (m && m[1] && AVATAR_OVERRIDE[id] === undefined) return Number(m[1])
  return null
}

/**
 * 应用头像名：给定时角色 id 与原始列表 icon，返回最终头像资产名。
 * 优先级：显式覆盖 > 号段自动 General > 原资产（原样）。
 */
export function applyAvatarOverride(id: number | undefined, asset: string | undefined): string {
  const override = id != null ? AVATAR_OVERRIDE[id] : undefined
  if (override) return override
  const n = roleIconNumber(id, asset)
  if (n != null) return `IconRoleGeneral${String(n).padStart(2, '0')}`
  return asset ?? ''
}

/** 详情规整：键名与旧 Dimbreath 管线输出契约一致；值规整 + 透传。 */
export function normalizeCharacterDetail(d: Record<string, unknown>): Record<string, unknown> {
  const enVal = (m: Record<string, unknown> | undefined): Record<string, unknown> => {
    if (!m) return {}
    const k = Object.keys(m)[0]
    if (!k) return m
    return { [k]: (ELEMENT_EN[k] ?? SPECIALTY_EN[k] ?? HIT_EN[k] ?? String(m[k])) }
  }
  const out: Record<string, unknown> = {
    id: d.id,
    icon: applyAvatarOverride(Number(d.id), d.icon as string | undefined),
    name: d.name,
    code_name: d.code_name,
    rarity: d.rarity,
    weapon_type: enVal(d.weapon_type as Record<string, unknown> | undefined),
    element_type: enVal(d.element_type as Record<string, unknown> | undefined),
    hit_type: enVal(d.hit_type as Record<string, unknown> | undefined),
    camp: d.camp ?? {},
    gender: d.gender,
    partner_info: d.partner_info ?? {},
    stats: d.stats ?? {},
    skill: d.skill ?? {},
    talent: d.talent ?? {},
    passive: d.passive ?? {},
    skin: skinImages((d.skin as Record<string, Record<string, unknown>>) ?? {}),
    // 新字段（v2 增值）：原样透传
    special_element_type: d.special_element_type ?? {},
    skill_list: d.skill_list ?? {},
    skill_priority: d.skill_priority ?? [],
    fairy_recommend: d.fairy_recommend ?? {},
    strategy: d.strategy ?? [],
    potential: d.potential ?? [],
    potential_detail: d.potential_detail ?? {},
    level: d.level ?? {},
    extra_level: d.extra_level ?? {},
    level_exp: d.level_exp ?? [],
    live2_d: d.live2_d ?? '',
  }
  return out
}

/** 皮肤 image 回退（沿用旧管线 SKIN_IMAGE_FALLBACK） */
export function skinImages(
  skin: Record<string, Record<string, unknown>>,
): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {}
  for (const [k, v] of Object.entries(skin)) {
    out[k] = { ...v, image: SKIN_IMAGE_FALLBACK[String(v.image)] ?? v.image }
  }
  return out
}

/** 名录：hakushin 列表条目 ID 是对象 key；注入 id + Id 大写 + icon 裸名 */
export function toListDict(
  listRaw: Record<string, Record<string, unknown>>,
): Record<string, Record<string, unknown>> {
  const dict: Record<string, Record<string, unknown>> = {}
  for (const [k, v] of Object.entries(listRaw)) {
    const id = Number(k)
    if (!Number.isFinite(id)) continue
    dict[k] = {
      ...v,
      Id: id,
      icon: applyAvatarOverride(id, basename(v.icon as string | null | undefined)),
    }
  }
  return dict
}