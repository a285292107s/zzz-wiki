/* ============================================================
 * heroCalibration — 图片取景校准的运行时访问器（单一事实源：featured-pool.json 的 calibrated 表）。
 *
 * 每个角色按画幅存一组 { pos, posY, zoom, originY }（画幅清单见 utils/cameraRect 的 FRAMING_MODES：
 * 1:1 / 3:4 / 4:3 / 9:16 / 16:9 / hero）。页面只需说明自己是谁：
 *   · 代理人名录卡片、详情页移动端头图 → getCardFraming（9:16 母版，卡片即按它定的）
 *   · 详情页桌面 hero 横幅         → getHeroFraming（hero 画幅 2.8:1，版式定死、只平移不缩放）
 *   · 其他画幅的新页面             → getFraming(id, mode)
 * 缺项（新角色 / 未单独校准的画幅）返回 null，调用方回落到居中取景，页面不破。
 * 语义与「为什么这么拍」见 IMG_GUIDE.md。
 * ============================================================ */

import type { FeaturedPool, Framing } from '@/domain/featuredPool'
import type { FramingMode } from '@/utils/cameraRect'
import poolJson from '@/data/featured-pool.json'

/** 校准表（防御性检查：非法/缺失则空表，调用方安全回落）。 */
const CALIBRATED: Record<string, unknown> = (poolJson as FeaturedPool)?.calibrated ?? {}

function pick(id: number | undefined, mode: FramingMode): Framing | null {
  if (id == null) return null
  const entry = CALIBRATED[String(id)] as { modes?: Record<string, Partial<Framing>> } | undefined
  const e = entry?.modes?.[mode]
  if (!e || typeof e.pos !== 'string' || typeof e.posY !== 'string' || typeof e.zoom !== 'number' || typeof e.originY !== 'number') {
    return null
  }
  return { pos: e.pos, posY: e.posY, zoom: e.zoom, originY: e.originY }
}

/** 任一画幅的显式校准；未校准（或不存在该角色）返回 null。 */
export function getFraming(id: number | undefined, mode: FramingMode): Framing | null {
  return pick(id, mode)
}

/** 9:16 母版取景：代理人名录卡片与详情页移动端头图共用（同一套窄画幅构图）。 */
export function getCardFraming(id: number | undefined): Framing | null {
  return pick(id, '9:16')
}

/** 详情页桌面 hero 横幅取景（hero 画幅，只平移不缩放）。 */
export function getHeroFraming(id: number | undefined): Framing | null {
  return pick(id, 'hero')
}
