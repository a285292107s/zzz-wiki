/* ============================================================
 * 图标 URL 候选生成 — 按用户偏好顺序：
 *   1) zzz.honeyhunterworld.com（角色图已实测可用；其余品类该站暂 521）
 *   2) static.nanoka.cc /assets/zzz/{basename}.webp（全品类已实测可用）
 *   3) 什么都不返回 → <HollowImage> 文字占位兜底
 * 候选数组按优先级排列，HollowImage 依序尝试，全部失败后降为文字。
 * ============================================================ */

const HONEY = 'https://zzz.honeyhunterworld.com/img'
const NANOKA_ASSETS = 'https://static.nanoka.cc/assets/zzz'

/** 本地图标根（Q4b：download-icons.mjs 落地到 public/data/img） */
const LOCAL_IMG = `${import.meta.env.BASE_URL ?? '/'}data/img`

export type IconCategory = 'character' | 'weapon' | 'bangboo' | 'disc'
export type IconKind = 'list' | 'portrait'

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

/** 每个分类的 honeyhunterworld 猜测模板（角色类已确认路径） */
function honeyGuess(category: IconCategory, id: number | string): string {
  switch (category) {
    case 'character':
      return `${HONEY}/character/${id}-char_icon.webp`
    case 'weapon':
      return `${HONEY}/weapon/${id}-weapon_icon.webp`
    case 'bangboo':
      return `${HONEY}/bangboo/${id}-bangboo_icon.webp`
    case 'disc':
      return `${HONEY}/suit/${id}.webp`
  }
}

/**
 * 生成按优先级排列的图标候选：
 * - kind='portrait' 时角色使用立绘（char_role_icon），否则用列表头像（char_icon）
 */
export function iconSources(
  item: IconItem,
  kind: IconKind = 'list',
  category: IconCategory = 'character',
  opts?: { excludeHoney?: boolean },
): string[] {
  const id = item.Id
  const b = basename(item.icon ?? '')
  const out: string[] = []

  // 本地化优先（Q4b）：/data/img/{cat}/{base}.webp
  if (b) out.push(`${LOCAL_IMG}/${category}/${b}.webp`)

  if (id != null && String(id) !== '' && !opts?.excludeHoney) {
    const guess = honeyGuess(category, id)
    if (category === 'character' && kind === 'portrait') {
      out.push(`${HONEY}/character/${id}-char_role_icon.webp`)
    } else {
      out.push(guess)
    }
  }
  if (b) out.push(`${NANOKA_ASSETS}/${b}.webp`)
  return [...new Set(out.filter(Boolean))]
}

/** nanoka.cc 素材直链（备用导出） */
export function nanokaAssetUrl(basenamePart: string): string {
  return `${NANOKA_ASSETS}/${basenamePart.replace(/\.(png|webp)$/i, '')}.webp`
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