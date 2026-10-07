/* ============================================================
 * 图标 URL 候选生成 — 按用户偏好顺序：
 *   1) 本地化图标（/data/img/{category}/{basename}.webp，download:icons 落地）
 *   2) static.nanoka.cc /assets/zzz/{basename}.webp（全品类已实测可用）
 *   3) 什么都不返回 → <HollowImage> 文字占位兜底
 * 候选数组按优先级排列，HollowImage 依序尝试，全部失败后降为文字。
 * ============================================================ */

const NANOKA_ASSETS = 'https://static.nanoka.cc/assets/zzz'

/** 本地图标根（Q4b：download-icons.mjs 落地到 public/data/img） */
const LOCAL_IMG = `${import.meta.env.BASE_URL ?? '/'}data/img`

export type IconCategory = 'character' | 'weapon' | 'bangboo' | 'disc'

export interface IconItem {
  Id?: number | string | null
  icon?: string | null
}

/** 取裸文件名（去目录、去扩展名），如 "IconRole01" / "SuitWoodpeckerElectro" */
function basename(p: string | null | undefined): string {
  if (!p) return ''
  const last = p.split('/').pop() ?? ''
  return last.replace(/\.(png|webp)$/i, '')
}

/**
 * 生成按优先级排列的图标候选：
 * - variant='thumb' 时优先名录用小图（`{cat}/thumb/{base}.webp`，最长边 128px ≈ 4KB）：
 *   名录行展示格仅 38×38 CSS px，原图 400-512px（31-50KB）超采约 10×；小图缺失自动
 *   落到原图，不破图。详情页展示 ~278px，不传此参数，直接用原图。
 * - 本地优先（/data/img/{category}/{basename}.webp）
 * - nanoka CDN 兜底（static.nanoka.cc/assets/zzz/{basename}.webp）
 * - 全部失败由 <HollowImage> 降为文字占位
 */
export function iconSources(
  item: IconItem,
  category: IconCategory = 'character',
  variant?: 'thumb',
): string[] {
  const b = basename(item.icon ?? '')
  const out: string[] = []

  if (b && variant === 'thumb') out.push(`${LOCAL_IMG}/${category}/thumb/${b}.webp`)
  // 本地化优先（Q4b）：/data/img/{cat}/{base}.webp
  if (b) out.push(`${LOCAL_IMG}/${category}/${b}.webp`)

  // nanoka 素材 CDN 兜底
  if (b) out.push(`${NANOKA_ASSETS}/${b}.webp`)
  return [...new Set(out.filter(Boolean))]
}

/* ============================================================
 * 技能键位图标 — 资产名取自游戏富文本标记 <IconMap:Icon_XXX>
 * （nanoka 素材 CDN 已实测）。候选链依序尝试，若全 404 由调用方
 * 显示文字/纹章兜底。
 * 页面展示直接走 nanoka 素材 CDN。
 * ============================================================ */

export type SkillSlot = 'basic' | 'dodge' | 'special' | 'chain' | 'ultimate' | 'assist' | 'core'

/** 各技能槽位的主图标资产名（首个）+ 候选兜底 */
export const SKILL_ICON_ASSETS: Record<SkillSlot, string[]> = {
  basic: ['Icon_Normal'],
  dodge: ['Icon_Evade'],
  special: ['Icon_Special', 'Icon_SpecialReady'],
  chain: ['Icon_QTE'], // 连携技为 QTE
  ultimate: ['Icon_UltimateReady'], // 终结技
  assist: ['Icon_Switch'],
  core: ['Icon_Normal'], // 核心技复用普通攻击键位图标（Icon_Core 在 CDN 无资产，曾是必然 404 的死候选，已移除）
}

/** 生成技能键位图标的候选 URL 数组（本地优先，走 /data/img/skill） */
export function skillIconSources(slot: SkillSlot): string[] {
  return (SKILL_ICON_ASSETS[slot] ?? []).map((a) =>
    `${LOCAL_IMG}/skill/${a}.webp`,
  ).concat(
    (SKILL_ICON_ASSETS[slot] ?? []).map((a) => `${NANOKA_ASSETS}/${a}.webp`),
  )
}

/** 单个技能键资产名 → 候选 URL（描述内 <IconMap:Icon_XXX> 用） */
export function skillAssetSources(asset: string): string[] {
  const name = asset.replace(/\.(png|webp)$/i, '')
  return [`${LOCAL_IMG}/skill/${name}.webp`, `${NANOKA_ASSETS}/${name}.webp`]
}

/* ============================================================
 * 已知源站缺失的按键图标
 *
 * 背景：游戏文本里引用的 <IconMap:…> 有个别资产**源站从未提供**。这类资产走常规候选链
 * 会：本地 404 → 回源 CDN 一次（违反「数据面零外部请求」的初衷）→ 仍 404 → 虚线占位方框
 * （视觉空洞）。既然已知两端皆无，就该**直接渲染文字键位**：省掉白试的跨域请求，
 * 也给读者可读的信息。
 *
 * 清单存在 `known-missing-assets.json`（**单一事实源**）：门禁 scripts/verify-icons.mjs
 * 读同一份文件，把这类缺口记为「已记录」而不是失败。新增条目必须写明依据（实测时间、
 * 探测过的 URL 与状态码、本地是否存在）——这里是记录事实，不是「缺失就忽略」的抽屉。
 * ============================================================ */
import knownMissingJson from '@/data/known-missing-assets.json'

const KNOWN_MISSING_KEY_ASSETS: Record<string, { reason: string }> = Object.fromEntries(
  Object.entries(knownMissingJson as Record<string, unknown>).filter(([k]) => !k.startsWith('_')),
) as Record<string, { reason: string }>

/** 该按键资产是否已知两端皆缺（缺则渲染文字键位，不发请求） */
export function knownMissingKeyAsset(asset: string): boolean {
  const name = asset.replace(/\.(png|webp)$/i, '')
  return Object.prototype.hasOwnProperty.call(KNOWN_MISSING_KEY_ASSETS, name)
}

/** 文字键位的短标签：取最后一段下划线后缀并大写（Icon_SpecialReady_Ep → EP） */
export function keyAssetLabel(asset: string): string {
  const name = asset.replace(/\.(png|webp)$/i, '')
  const parts = name.split('_').filter(Boolean)
  const last = parts[parts.length - 1] ?? name
  return last.length <= 4 ? last.toUpperCase() : name
}