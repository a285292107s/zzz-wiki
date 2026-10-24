import { describe, expect, it } from 'vitest'
import { FeaturedPoolSchema, type FeaturedPool, type Framing } from '@/domain/featuredPool'
import {
  FRAMING_MODES,
  deriveFraming,
  deriveHeroFraming,
  framingFromRect,
  modeAspect,
  rectFromFraming,
} from '@/utils/cameraRect'
import poolJson from '@/data/featured-pool.json'

/** 常见素材画幅：宽幅全景（比所有模式都宽）与窄幅（只比 16:9 / hero 窄）。 */
const WIDE = { W: 2552, H: 1080 }
const NARROW = { W: 1326, H: 840 }

const framing = (p: Partial<Framing>): Framing => ({ pos: '50%', posY: '50%', zoom: 1, originY: 50, ...p })

describe('featured-pool.json 契约', () => {
  it('通过 FeaturedPoolSchema 校验，pool 非空', () => {
    const r = FeaturedPoolSchema.safeParse(poolJson)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.pool.length).toBeGreaterThan(0)
  })

  it('每个角色的每个画幅都是完整四件套，且画幅键都在登记表内', () => {
    const known = new Set<string>(FRAMING_MODES.map((m) => m.key))
    const cal = (poolJson as FeaturedPool).calibrated
    for (const [id, entry] of Object.entries(cal)) {
      expect(entry.modes['9:16'], `${id} 缺 9:16 母版`).toBeTruthy()
      for (const [mode, f] of Object.entries(entry.modes)) {
        expect(known.has(mode), `${id} 未知画幅 ${mode}`).toBe(true)
        expect(typeof f.pos).toBe('string')
        expect(typeof f.posY).toBe('string')
        expect(typeof f.zoom).toBe('number')
        expect(typeof f.originY).toBe('number')
        expect(f.zoom, `${id}/${mode} zoom 低于下限`).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('pool 与 calibrated 的 9:16 母版一致（入池子集由同一份取景派生，不许两处漂移）', () => {
    const cal = (poolJson as FeaturedPool).calibrated
    for (const item of poolJson.pool) {
      const master = cal[String(item.id)]?.modes['9:16']
      expect(master, `${item.id} 入池但无 9:16 校准`).toBeTruthy()
      expect({ pos: item.pos, zoom: item.zoom, originY: item.originY }).toEqual({
        pos: master!.pos,
        zoom: master!.zoom,
        originY: master!.originY,
      })
    }
  })
})

describe('cameraRect：取景参数 ↔ 相机窗口', () => {
  it('9:16 母版往返一致（pos / zoom / originY）', () => {
    const f = framing({ pos: '50%', zoom: 1.3, originY: 49.8 })
    const r = rectFromFraming(f, WIDE.W, WIDE.H, '9:16')
    expect(r.cx).toBeCloseTo(WIDE.W / 2, 3)
    expect(r.h).toBeCloseTo(WIDE.H / 1.3, 3)
    expect(r.w / r.h).toBeCloseTo(9 / 16, 6)
    const back = framingFromRect(r, WIDE.W, WIDE.H, '9:16')
    expect(back.pos).toBe('50%')
    expect(back.zoom).toBeCloseTo(1.3, 4)
    expect(back.originY).toBeCloseTo(49.8, 1)
  })

  it('所有画幅的窗口比例都等于画幅比，且完整落在源图内', () => {
    for (const { key } of FRAMING_MODES) {
      const W = key === 'hero' || key === '16:9' ? NARROW.W : WIDE.W
      const H = key === 'hero' || key === '16:9' ? NARROW.H : WIDE.H
      for (const f of [
        framing({ pos: '0%', posY: '0%' }),
        framing({ pos: '100%', posY: '100%' }),
        framing({ pos: '37%', posY: '63%', zoom: 1.7, originY: 30 }),
      ]) {
        const r = rectFromFraming(f, W, H, key)
        expect(r.w / r.h, `${key} 比例`).toBeCloseTo(modeAspect(key), 4)
        expect(r.cx - r.w / 2, `${key} 左缘`).toBeGreaterThanOrEqual(-1e-6)
        expect(r.cx + r.w / 2, `${key} 右缘`).toBeLessThanOrEqual(W + 1e-6)
        expect(r.cy - r.h / 2, `${key} 上缘`).toBeGreaterThanOrEqual(-1e-6)
        expect(r.cy + r.h / 2, `${key} 下缘`).toBeLessThanOrEqual(H + 1e-6)
      }
    }
  })

  it('源图比画幅窄时（hero / 16:9）：横向铺满不可平移，纵向由 posY 控制', () => {
    const top = rectFromFraming(framing({ pos: '0%', posY: '0%' }), NARROW.W, NARROW.H, 'hero')
    const bottom = rectFromFraming(framing({ pos: '100%', posY: '100%' }), NARROW.W, NARROW.H, 'hero')
    expect(top.w).toBeCloseTo(NARROW.W, 6)
    expect(top.cx).toBeCloseTo(bottom.cx, 6)
    expect(top.cy).toBeLessThan(bottom.cy)
    expect(top.cy - top.h / 2).toBeCloseTo(0, 6)
    expect(bottom.cy + bottom.h / 2).toBeCloseTo(NARROW.H, 6)
    expect(framingFromRect(top, NARROW.W, NARROW.H, 'hero').posY).toBe('0%')
    expect(framingFromRect(bottom, NARROW.W, NARROW.H, 'hero').posY).toBe('100%')
  })

  it('zoom 下限恒为 1（窗口不得大于源图，否则框外没有像素）', () => {
    const r = rectFromFraming(framing({ zoom: 0.5 }), WIDE.W, WIDE.H, '9:16')
    expect(r.h).toBeCloseTo(WIDE.H, 6)
    expect(framingFromRect(r, WIDE.W, WIDE.H, '9:16').zoom).toBe(1)
  })
})

describe('派生：9:16 母版 → 其他画幅的初始取景', () => {
  const { W, H } = WIDE
  const master = rectFromFraming(framing({ pos: '62%', zoom: 1.25, originY: 22 }), W, H, '9:16')

  it('新窗口把整块母版收进画面（画幅装得下时）', () => {
    for (const key of ['3:4', '1:1', '4:3', '16:9'] as const) {
      const r = rectFromFraming(deriveFraming(master, W, H, key), W, H, key)
      expect(r.cx - r.w / 2 - 1e-6).toBeLessThanOrEqual(master.cx - master.w / 2)
      expect(r.cx + r.w / 2 + 1e-6).toBeGreaterThanOrEqual(master.cx + master.w / 2)
      expect(r.cy - r.h / 2).toBeCloseTo(master.cy - master.h / 2, 0)
      expect(r.h).toBeGreaterThanOrEqual(master.h - 1e-6)
    }
  })

  it('装不下母版高度时保住上缘（头部），不是把头顶裁掉居中', () => {
    const narrowMaster = rectFromFraming(framing({ zoom: 1.2 }), NARROW.W, NARROW.H, '9:16')
    const r = rectFromFraming(deriveFraming(narrowMaster, NARROW.W, NARROW.H, 'hero'), NARROW.W, NARROW.H, 'hero')
    expect(r.h).toBeLessThan(narrowMaster.h)
    expect(r.cy - r.h / 2).toBeLessThan(narrowMaster.cy - narrowMaster.h / 2 + 0.03 * r.h)
    expect(r.cy - r.h / 2).toBeGreaterThanOrEqual(-1e-6)
  })

  it('hero 派生只平移不缩放（zoom 恒 1，窗口＝cover 窗口）', () => {
    const f = deriveHeroFraming(master, W, H)
    expect(f.zoom).toBe(1)
    const r = rectFromFraming(f, W, H, 'hero')
    // WIDE 的宽高比 2.36 < hero 画幅 2.8 ⇒ 横向铺满、纵向裁切（cover 窗口）
    expect(r.w).toBeCloseTo(W, 6)
    expect(r.h).toBeCloseTo(W / modeAspect('hero'), 6)
  })

  it('窄幅源图的 hero 派生：横向铺满、只平移纵向', () => {
    const narrowMaster = rectFromFraming(framing({ zoom: 1.2 }), NARROW.W, NARROW.H, '9:16')
    const f = deriveHeroFraming(narrowMaster, NARROW.W, NARROW.H)
    expect(f.zoom).toBe(1)
    expect(f.pos).toBe('50%')
    const r = rectFromFraming(f, NARROW.W, NARROW.H, 'hero')
    expect(r.w).toBeCloseTo(NARROW.W, 6)
    expect(r.cx).toBeCloseTo(NARROW.W / 2, 6)
  })
})
