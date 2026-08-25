/* ============================================================
 * heroCalibration — 角色详情页（AgentHead）移动端 hero 头图构图参数访问器。
 *
 * 「今日角色」校准工具（/calibrate）为每张 Mindscape 全景图校准了 { pos, zoom, originY }
 * （9:16 卡片构图；含义见 IMG_GUIDE.md），存于 src/data/featured-pool.json 的 calibrated 表。
 * 详情页 AgentHead 移动端头图复用这份校准。这三者是源图相对构参数——pos 为水平脸焦点分数、
 * zoom 放大到内容高度、originY 为内容垂直中心——语义可跨宽高比套用；因移动端 hero 比 9:16 卡
 * 更宽，取景框横向上下文会更多，并非逐帧等价（技巧归属 IMG_GUIDE.md）。
 * 取不到（未校准，无 hero 图 / 双形态角色 / 数据缺失）返回 null，调用方回落到居中取景。
 * ============================================================ */

import type { FeaturedPool } from '@/domain/featuredPool'
import poolJson from '@/data/featured-pool.json'

/** 单图移动端 hero 构图参数（pos 为 'NN%' 字符串，可直接作 object-position 值）。 */
export interface HeroCalibration {
  pos: string
  zoom: number
  originY: number
}

/** 校准表（防御性检查：非法/缺失则空表，调用方安全回落）。 */
const CALIBRATED: Record<string, unknown> =
  (poolJson as FeaturedPool)?.calibrated ?? {}

/** 取某角色已校准的 hero 构图参数；未校准（或不存在该角色的校准条目）返回 null。 */
export function getHeroCalibration(id: number | undefined): HeroCalibration | null {
  if (id == null) return null
  const e = CALIBRATED[String(id)] as Partial<HeroCalibration> | undefined
  if (!e || typeof e.pos !== 'string' || typeof e.zoom !== 'number' || typeof e.originY !== 'number') {
    return null
  }
  return { pos: e.pos, zoom: e.zoom, originY: e.originY }
}
