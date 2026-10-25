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
  return {
    pos: e.pos,
    posY: e.posY,
    zoom: e.zoom,
    originY: e.originY,
    ...(e.flipH === true ? { flipH: true } : {}),
  }
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
