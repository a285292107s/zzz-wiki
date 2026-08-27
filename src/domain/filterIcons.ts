/* ============================================================
 * 筛选图标映射 — 元素/职业/阵营 code → 本地素材（DESIGN.md 扩展）。
 * 命名规则：属性 Icon{English}（IconPhysical/Fire/Ice/Electric/Wind/Ether）
 *          职业 Icon{English}（IconAttack/Stun/Anomaly/Support/Defense/Rupture）
 *          阵营 IconCamp{English}（参考 zzz.nanoka.cc 阵营筛选，命名一致）
 * 资产清单单一事实源：src/data/filter-assets.json（构建期 icon-inventory.mjs
 * 读同一份下载到 /data/img/filter/；运行时零外部请求）。
 * 无专用图的（实测 404 / 未收录）不进清单，返回 null，前端用 SVG 占位：
 *   300 流明 → 已补图（IconLumen，纯本地资产，源站无此文件）
 *   7   锋御 → 无：返回 null，前端用 SVG 占位
 *   15/16/17 法厄同/罗斯凯利法/达识结社 → 暂无：返回 null，前端用 SVG 占位
 * ============================================================ */

import raw from '../data/filter-assets.json'
import type { AttrCode, SpecCode } from './enums'

/** 本地筛选图标根（构建期 icon-inventory.mjs 落地） */
const LOCAL_IMG = `${import.meta.env.BASE_URL ?? '/'}data/img/filter`

/** 有真实素材图的属性（键为数字码字符串）；其余返回 null → SVG 占位 */
export const ELEMENT_ICONS = raw.elements as Partial<Record<AttrCode, string>>

/** 有真实素材图的职业；其余如 7 锋御返回 null → SVG 占位 */
export const PROFESSION_ICONS = raw.professions as Partial<Record<SpecCode, string>>

/** 有真实素材图的阵营；新阵营 15/16/17 暂无 → SVG 占位 */
export const CAMP_ICONS = raw.camps as Partial<Record<number, string>>

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
