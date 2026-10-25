// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AgentHead from '../src/components/detail/AgentHead.vue'
import type { CharacterDetail } from '../src/data/types'

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

const mountOptions = {
  global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
}

describe('AgentHead hero 底图候选链', () => {
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

  it('桌面横幅取 hero 画幅校准、移动端取 9:16 母版（两种画幅不串用）', () => {
    mockMatchMedia({ narrow: false })
    const style = mount(AgentHead, { props: { detail }, ...mountOptions }).find('.hero-bg img').attributes('style') ?? ''
    expect(style).toContain('--hero-wide-pos: 50%')
    expect(style).toContain('--hero-wide-posY: 28%')
    expect(style).toContain('--hero-pos: 12%')
  })
})
