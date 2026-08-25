import { describe, expect, it } from 'vitest'
import { FeaturedPoolSchema } from '@/domain/featuredPool'
import { rectFromParams, paramsFromRect, formatPos } from '@/utils/cameraRect'
import poolJson from '@/data/featured-pool.json'

describe('featured-pool.json 契约', () => {
  it('通过 FeaturedPoolSchema 校验，且 pool 非空', () => {
    const r = FeaturedPoolSchema.safeParse(poolJson)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.pool.length).toBeGreaterThan(0)
      for (const p of r.data.pool) {
        expect(typeof p.id).toBe('number')
        expect(typeof p.pos).toBe('string')
        expect(typeof p.zoom).toBe('number')
        expect(typeof p.originY).toBe('number')
      }
    }
  })
})

describe('cameraRect 双向映射', () => {
  const W = 2552
  const H = 1080

  it('params → rect → params 往返一致', () => {
    const r = rectFromParams(50, 1.3, 49.8, W, H)
    expect(r.cx).toBeCloseTo(W / 2, 3)
    expect(r.h).toBeCloseTo(H / 1.3, 3)
    const back = paramsFromRect(r, W, H)
    expect(back.pos).toBe(50)
    expect(back.zoom).toBeCloseTo(1.3, 4)
    expect(back.originY).toBeCloseTo(49.8, 1)
  })

  it('pos 0%/100% 时矩形中心落在对应侧，且保持 9:16', () => {
    const l = rectFromParams(0, 1.3, 50, W, H)
    const rgt = rectFromParams(100, 1.3, 50, W, H)
    expect(l.cx).toBeLessThan(rgt.cx)
    expect(l.cx).toBeCloseTo((9 / 16) * 0.5 * H, 3)
    expect(rgt.cx).toBeCloseTo(W - (9 / 16) * 0.5 * H, 3)
    // 9:16
    expect(rgt.w / rgt.h).toBeCloseTo(9 / 16, 4)
  })

  it('formatPos 输出 "NN%"', () => {
    expect(formatPos(50)).toBe('50%')
    expect(formatPos(62)).toBe('62%')
  })

  it('originY 偏离 50 时矩形仍在图内且反向一致（修取景框与预览错位）', () => {
    const r = rectFromParams(55, 1.25, 72, W, H)
    // 矩形应完全落在图内（否则取景框会与预览错位）
    expect(r.cx - r.w / 2).toBeGreaterThanOrEqual(0)
    expect(r.cx + r.w / 2).toBeLessThanOrEqual(W)
    expect(r.cy - r.h / 2).toBeGreaterThanOrEqual(0)
    expect(r.cy + r.h / 2).toBeLessThanOrEqual(H)
    const back = paramsFromRect(r, W, H)
    expect(back.pos).toBe(55)
    expect(back.zoom).toBeCloseTo(1.25, 4)
    expect(back.originY).toBeCloseTo(72, 1)
  })
})
