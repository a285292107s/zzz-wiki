// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AgentHead from '../src/components/detail/AgentHead.vue'
import type { CharacterDetail } from '../src/data/types'

/** 最小角色样本：只需 hero 逻辑涉及的字段（id 驱动 Mindscape 场景图命名） */
const detail = {
  id: 1011,
  name: '测试代理人',
  code_name: 'TEST',
  rarity: 4,
  element_type: { 201: 'Fire' },
  weapon_type: { 1: 'Attack' },
  hit_type: { 101: 'Slash' },
  special_element_type: null,
} as unknown as CharacterDetail

/**
 * hero 取图按**两条媒体条件**分支：窄屏（≤860px）与高密度屏（min-resolution ≥1.5dppx）。
 * 两者都取 1400w 派生，只有「宽屏且 DPR≥1.5」才用 2552px 原图——宽屏 DPR 1 用原图
 * 是 2.2 倍超采（311KB vs 46KB），桌面 LCP 因此被拖住。测试需显式给出 DPR 条件，
 * 否则 jsdom 下 matchMedia 恒 false，等于在测「DPR 1 桌面」这一条分支。
 */
function mockMatchMedia(opts: { narrow?: boolean; retina?: boolean } = {}) {
  const { narrow = false, retina = false } = opts
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query.includes('max-width') ? narrow : query.includes('min-resolution') ? retina : false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

afterEach(() => {
  // @ts-expect-error 清掉本文件注入的模拟，避免污染其他用例
  delete window.matchMedia
})

function heroImg(w: ReturnType<typeof mount>) {
  return w.find('.hero-bg img')
}

/** 组件含 RouterLink（专属音擎卡片）：不传 signatureEngine 时不渲染，但需 stub 避免未解析告警 */
const mountOptions = {
  global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
}

describe('AgentHead hero 底图（按屏宽 + DPR 选派生 / 本地优先 + CDN 兜底）', () => {
  it('宽屏 DPR 1：取 1400w 派生（46KB），不用 2.2 倍超采的原图', () => {
    mockMatchMedia({ narrow: false, retina: false })
    const w = mount(AgentHead, { props: { detail }, ...mountOptions })
    expect(heroImg(w).attributes('src')).toBe('/data/img/hero/mobile/Mindscape_1011_2.webp')
  })

  it('宽屏 DPR ≥1.5（retina）：取原图', () => {
    mockMatchMedia({ narrow: false, retina: true })
    const w = mount(AgentHead, { props: { detail }, ...mountOptions })
    expect(heroImg(w).attributes('src')).toBe('/data/img/hero/Mindscape_1011_2.webp')
  })

  it('窄屏：取 1400w 派生', () => {
    mockMatchMedia({ narrow: true, retina: true })
    const w = mount(AgentHead, { props: { detail }, ...mountOptions })
    expect(heroImg(w).attributes('src')).toBe('/data/img/hero/mobile/Mindscape_1011_2.webp')
  })

  it('已校准角色（1011）在 img 上注入移动端构图自定义属性（来源 featured-pool.json calibrated）', () => {
    mockMatchMedia({ narrow: true })
    const w = mount(AgentHead, { props: { detail }, ...mountOptions })
    const el = heroImg(w).element as HTMLElement
    expect(el.style.getPropertyValue('--hero-pos')).toBe('44%')
    expect(el.style.getPropertyValue('--hero-zoom')).toBe('1.32')
    expect(el.style.getPropertyValue('--hero-originY')).toBe('47.5%')
  })

  it('派生变体缺失时逐级回退：先原图，再 nanoka CDN', async () => {
    mockMatchMedia({ narrow: true })
    const w = mount(AgentHead, { props: { detail }, ...mountOptions })
    expect(heroImg(w).attributes('src')).toBe('/data/img/hero/mobile/Mindscape_1011_2.webp')
    await heroImg(w).trigger('error')
    expect(heroImg(w).attributes('src')).toBe('/data/img/hero/Mindscape_1011_2.webp')
    await heroImg(w).trigger('error')
    expect(heroImg(w).attributes('src')).toBe(
      'https://static.nanoka.cc/assets/zzz/Mindscape_1011_2.webp',
    )
  })

  it('候选链耗尽时隐藏底图（降为底色，不渲染 img）', async () => {
    mockMatchMedia({ narrow: true })
    const w = mount(AgentHead, { props: { detail }, ...mountOptions })
    await heroImg(w).trigger('error')
    await heroImg(w).trigger('error')
    await heroImg(w).trigger('error')
    expect(heroImg(w).exists()).toBe(false)
  })

  it('切换角色（组件复用）时游标重置回候选链首项', async () => {
    mockMatchMedia({ narrow: true })
    const w = mount(AgentHead, { props: { detail }, ...mountOptions })
    await heroImg(w).trigger('error')
    await heroImg(w).trigger('error')
    expect(heroImg(w).attributes('src')).toContain('static.nanoka.cc')
    await w.setProps({ detail: { ...detail, id: 1021 } })
    expect(heroImg(w).attributes('src')).toBe('/data/img/hero/mobile/Mindscape_1021_2.webp')
  })
})
