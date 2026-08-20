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
 * - 本地优先（/data/img/{category}/{basename}.webp）
 * - nanoka CDN 兜底（static.nanoka.cc/assets/zzz/{basename}.webp）
 * - 全部失败由 <HollowImage> 降为文字占位
 */
export function iconSources(
  item: IconItem,
  category: IconCategory = 'character',
): string[] {
  const b = basename(item.icon ?? '')
  const out: string[] = []

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

export type SkillSlot = 'basic' | 'dodge' | 'special' | 'chain' | 'assist' | 'core'

/** 各技能槽位的主图标资产名（首个）+ 候选兜底 */
export const SKILL_ICON_ASSETS: Record<SkillSlot, string[]> = {
  basic: ['Icon_Normal'],
  dodge: ['Icon_Evade'],
  special: ['Icon_Special', 'Icon_SpecialReady'],
  chain: ['Icon_UltimateReady', 'Icon_QTE'],
  assist: ['Icon_Switch'],
  core: ['Icon_Core', 'Icon_Normal'], // Icon_Core 暂无资产，兜底普通键
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