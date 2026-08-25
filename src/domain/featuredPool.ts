/* ============================================================
 * featuredPool — 首页「今日角色」精选池契约（zod 单一事实源，DESIGN.md §5.1）。
 * 数据文件：src/data/featured-pool.json（校准工具 dev 中间件读写）。
 * 依赖方向：schema ← build/校验脚本/工具页读取；运行时可只用类型（不把 zod 带进前端 bundle，
 * 前端用 type-only import + 防御性结构检查）。含义见 IMG_GUIDE.md。
 * ============================================================ */

import { z } from 'zod'

/** 单图构图参数：pos 为百分比字符串（如 '50%'，object-position 水平）；zoom 放大倍数；originY 变换原点 Y%（percent） */
export const FeaturedParamsSchema = z.object({
  pos: z.string(),
  zoom: z.number(),
  originY: z.number(),
})

/** 入池条目：构图参数 + 角色号（id 居首，便于阅读/输出稳定） */
export const PoolItemSchema = z.object({ id: z.number(), ...FeaturedParamsSchema.shape })

/** 校准状态条目：构图参数 + 是否入池（不入池即不用，无需单独的"跳过"标记；构图本身即"已校准"）。 */
export const CalibratedEntrySchema = z.object({
  ...FeaturedParamsSchema.shape,
  inPool: z.boolean(),
})

/** featured-pool.json 契约：pool 为入池轮换（App 读取，由 calibrated 中 inPool=true 派生）。 */
export const FeaturedPoolSchema = z.object({
  pool: z.array(PoolItemSchema),
  calibrated: z.record(z.string(), CalibratedEntrySchema),
})

export type FeaturedParams = z.infer<typeof FeaturedParamsSchema>
export type PoolItem = z.infer<typeof PoolItemSchema>
export type CalibratedEntry = z.infer<typeof CalibratedEntrySchema>
export type FeaturedPool = z.infer<typeof FeaturedPoolSchema>
