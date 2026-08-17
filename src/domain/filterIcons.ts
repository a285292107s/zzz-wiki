/* ============================================================
 * 筛选图标映射 — 元素/职业 code → nanoka 素材资源名（DESIGN.md 扩展）。
 * 命名规则：属性 Icon{English}（IconPhysical/Fire/Ice/Electric/Wind/Ether）
 *          职业 Icon{English}（IconAttack/Stun/Anomaly/Support/Defense/Rupture）
 * 已验证 12 个全部可达（HEAD 200）。无专用图的（实测 404）：
 *   300 流明 → 无：返回 null，前端用 SVG 占位
 *   7   锋御 → 无：返回 null，前端用 SVG 占位
 * ============================================================ */

import type { AttrCode, SpecCode } from './enums'

const NANOKA = 'https://static.nanoka.cc/assets/zzz'

/** 有真实素材图的属性（其余如 300 流明返回 null → SVG 占位） */
export const ELEMENT_ICONS: Partial<Record<AttrCode, string>> = {
  200: 'IconPhysical',
  201: 'IconFire',
  202: 'IconIce',
  203: 'IconElectric',
  204: 'IconWind',
  205: 'IconEther',
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

/** 元素 code → 图标完整 URL；无真实图返回 null（调用方显示 SVG 占位）。 */
export function elementIconUrl(code: AttrCode): string | null {
  const asset = ELEMENT_ICONS[code]
  return asset ? `${NANOKA}/${asset}.webp` : null
}

/** 职业 code → 图标完整 URL；无真实图返回 null（调用方显示 SVG 占位）。 */
export function professionIconUrl(code: SpecCode): string | null {
  const asset = PROFESSION_ICONS[code]
  return asset ? `${NANOKA}/${asset}.webp` : null
}
