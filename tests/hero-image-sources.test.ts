// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  LOCAL_HERO,
  heroDetailPrimarySrc,
  heroDetailSources,
  heroDetailViewport,
} from '@/data/heroImageSources'

describe('详情页 hero 候选链（渲染与预取的单一事实源）', () => {
  it('窄屏或低密度屏：mobile 派生在前，原图与 CDN 依次兜底', () => {
    const srcs = heroDetailSources('Mindscape_1011_2', { narrow: true, retina: false })
    expect(srcs.map((s) => s.src)).toEqual([
      `${LOCAL_HERO}/mobile/Mindscape_1011_2.webp`,
      `${LOCAL_HERO}/Mindscape_1011_2.webp`,
      'https://static.nanoka.cc/assets/zzz/Mindscape_1011_2.webp',
    ])
  })

  it('宽屏低密度屏也走 mobile 派生（1168 布局宽用 1400w 足够，省 ~265KB）', () => {
    expect(heroDetailSources('Mindscape_1011_2', { narrow: false, retina: false })[0]!.src).toBe(
      `${LOCAL_HERO}/mobile/Mindscape_1011_2.webp`,
    )
  })

  it('宽屏高密度屏：直接用原图（派生档会放大）', () => {
    const srcs = heroDetailSources('Mindscape_1011_2', { narrow: false, retina: true })
    expect(srcs.map((s) => s.src)).toEqual([
      `${LOCAL_HERO}/Mindscape_1011_2.webp`,
      'https://static.nanoka.cc/assets/zzz/Mindscape_1011_2.webp',
    ])
  })

  it('首选地址 = 真正会请求的那一份（预取算错档位等于白下一张）', () => {
    expect(heroDetailPrimarySrc('Mindscape_1011_2', { narrow: true, retina: true })).toBe(
      `${LOCAL_HERO}/mobile/Mindscape_1011_2.webp`,
    )
    expect(heroDetailPrimarySrc('Mindscape_1011_2', { narrow: false, retina: true })).toBe(
      `${LOCAL_HERO}/Mindscape_1011_2.webp`,
    )
  })

  it('视口判定读的是与 AgentHead 同一条媒体查询（jsdom 无 matchMedia → 保守取原图档）', () => {
    const vp = heroDetailViewport()
    expect(typeof vp.narrow).toBe('boolean')
    expect(typeof vp.retina).toBe('boolean')
  })
})

