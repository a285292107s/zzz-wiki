/* ============================================================
 * featuredPool — 图片取景校准 + 首页「今日角色」精选池契约（zod 单一事实源，DESIGN.md §5.1）。
 * 数据文件：src/data/featured-pool.json（校准工具 dev 中间件读写）。
 * 依赖方向：schema ← build/校验脚本/工具页读取；运行时可只用类型（不把 zod 带进前端 bundle，
 * 前端用 type-only import + 防御性结构检查）。含义与模式清单见 IMG_GUIDE.md。
 * ============================================================ */

import { z } from 'zod'
import { FRAMING_MODES } from '../utils/cameraRect'

/** 单图单画幅构图参数：pos/posY 为百分比字符串（object-position 的水平/垂直），zoom 放大倍数，
 *  originY 变换原点 Y%。四种模式共用同一形状，无效的那一路在对应画幅下天然无作用（见 cameraRect）。 */
export const FramingSchema = z.object({
  pos: z.string(),
  posY: z.string(),
  zoom: z.number(),
  originY: z.number(),
})

/** 入池条目：构图参数 + 角色号（id 居首，便于阅读/输出稳定） */
export const PoolItemSchema = z.object({ id: z.number(), pos: z.string(), zoom: z.number(), originY: z.number() })

const MODE_KEYS: readonly string[] = FRAMING_MODES.map((m) => m.key)

/** 各画幅的显式校准（缺项＝该画幅未单独调过，运行时按 9:16 母版派生） */
export const FramingModesSchema = z
  .record(z.string(), FramingSchema)
  .refine((modes) => Object.keys(modes).every((k) => MODE_KEYS.includes(k)), {
    message: '未知的校准模式',
  })

/** 校准状态条目：是否入池（决定首页「今日角色」轮换）+ 各画幅取景。 */
export const CalibratedEntrySchema = z.object({
  inPool: z.boolean(),
  modes: FramingModesSchema,
})

/** featured-pool.json 契约：pool 为入池轮换（首页读取，由 calibrated 中 inPool=true 的 9:16 取景派生）。 */
export const FeaturedPoolSchema = z.object({
  pool: z.array(PoolItemSchema),
  calibrated: z.record(z.string(), CalibratedEntrySchema),
})

export type Framing = z.infer<typeof FramingSchema>
export type PoolItem = z.infer<typeof PoolItemSchema>
export type CalibratedEntry = z.infer<typeof CalibratedEntrySchema>
export type FeaturedPool = z.infer<typeof FeaturedPoolSchema>
