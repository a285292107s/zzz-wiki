/* ============================================================
 * 筛选图标映射 — 元素/职业/阵营 code → 本地素材（DESIGN.md 扩展）。
 * 命名规则：属性 Icon{English}（IconPhysical/Fire/Ice/Electric/Wind/Ether）
 *          职业 Icon{English}（IconAttack/Stun/Anomaly/Support/Defense/Rupture）
 *          阵营 IconCamp{English}（参考 zzz.nanoka.cc 阵营筛选，命名一致）
 * 素材下载：download-icons.mjs 的 FILTER_ASSETS 清单落地到 /data/img/filter/
 * （构建期本地化，运行时零外部请求）。无专用图的（实测 404）返回 null，
 * 前端用 SVG 占位：
 *   300 流明 → 已补图（IconLumen，纯本地资产，nanoka CDN 暂无此名）
 *   7   锋御 → 无：返回 null，前端用 SVG 占位
 *   15/16/17 法厄同/罗斯凯利法/达识结社 → 暂无：返回 null，前端用 SVG 占位
 * ============================================================ */

import type { AttrCode, SpecCode } from './enums'

/** 本地筛选图标根（构建期 download-icons.mjs 落地） */
const LOCAL_IMG = `${import.meta.env.BASE_URL ?? '/'}data/img/filter`

/** 有真实素材图的属性（无图的返回 null → SVG 占位） */
export const ELEMENT_ICONS: Partial<Record<AttrCode, string>> = {
  200: 'IconPhysical',
  201: 'IconFire',
  202: 'IconIce',
  203: 'IconElectric',
  204: 'IconWind',
  205: 'IconEther',
  300: 'IconLumen',
}

/** 有真实素材图的职业（其余如 7 锋御返回 null → SVG 占位） */
export const PROFESSION_ICONS: Partial<Record<SpecCode, string>> = {
  1: 'IconAttack',
  2: 'IconStun',
  3: 'IconAnomaly',
  4: 'IconSupport',
  5: 'IconDefense',
  6: 'IconRupture',
}

/** 有真实素材图的阵营（已实测 13 个全部可达；新阵营 15/16/17 暂无 → SVG 占位） */
export const CAMP_ICONS: Partial<Record<number, string>> = {
  1: 'IconCampGentleHouse',
  2: 'IconCampVictoriaHousekeepingCo.',
  3: 'IconCampBelobogIndustries',
  4: 'IconCampSonsOfCalydon',
  5: 'IconCampObols',
  6: 'IconCampH.S.O-S6',
  7: 'IconCampN.E.P.S.',
  8: 'IconCampStarsOfLyra',
  9: 'IconCampMockingBird',
  10: 'IconCampSuibian',
  11: 'IconCampSpookShack',
  12: 'IconCampBlackRoot',
  13: 'IconCampAngelsOfDelusion',
}

/** 元素 code → 本地图标 URL；无真实图返回 null（调用方显示 SVG 占位）。 */
export function elementIconUrl(code: AttrCode): string | null {
  const asset = ELEMENT_ICONS[code]
  return asset ? `${LOCAL_IMG}/${asset}.webp` : null
}

/** 职业 code → 本地图标 URL；无真实图返回 null（调用方显示 SVG 占位）。 */
export function professionIconUrl(code: SpecCode): string | null {
  const asset = PROFESSION_ICONS[code]
  return asset ? `${LOCAL_IMG}/${asset}.webp` : null
}

/** 阵营 code → 本地图标 URL；无真实图返回 null（调用方显示 SVG 占位）。 */
export function campIconUrl(code: number): string | null {
  const asset = CAMP_ICONS[code]
  return asset ? `${LOCAL_IMG}/${asset}.webp` : null
}
