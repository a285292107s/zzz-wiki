/* ============================================================
 * 筛选图标映射 — 元素/职业 code → nanoka 素材资源名（DESIGN.md 扩展）。
 * 命名规则：属性 Icon{English}（IconPhysical/Fire/Ice/Electric/Wind/Ether）
 *          职业 Icon{English}（IconAttack/Stun/Anomaly/Support/Defense/Rupture）
 * 已验证 12 个全部可达（HEAD 200）；两个无专用图（实测 404）用语义兜底：
 *   300 流明 → IconEther（以太系紫色调）
 *   7   锋御 → IconRupture（同为破盾系）
 * ============================================================ */

import type { AttrCode, SpecCode } from './enums'

const NANOKA = 'https://static.nanoka.cc/assets/zzz'

export const ELEMENT_ICONS: Record<AttrCode, string> = {
  200: 'IconPhysical',
  201: 'IconFire',
  202: 'IconIce',
  203: 'IconElectric',
  204: 'IconWind',
  205: 'IconEther',
  300: 'IconEther', // 流明无专用图，以太兜底
}

export const PROFESSION_ICONS: Record<SpecCode, string> = {
  1: 'IconAttack',
  2: 'IconStun',
  3: 'IconAnomaly',
  4: 'IconSupport',
  5: 'IconDefense',
  6: 'IconRupture',
  7: 'IconRupture', // 锋御无专用图，命破兜底
}

/** 元素 code → 图标完整 URL */
export function elementIconUrl(code: AttrCode): string {
  return `${NANOKA}/${ELEMENT_ICONS[code]}.webp`
}

/** 职业 code → 图标完整 URL */
export function professionIconUrl(code: SpecCode): string {
  return `${NANOKA}/${PROFESSION_ICONS[code]}.webp`
}
