// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import AgentHead from '../src/components/detail/AgentHead.vue'
import type { CharacterDetail, WEngineListItem } from '../src/data/types'

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

const signatureEngine = {
  Id: 14109,
  icon: 'Weapon_S_1091',
  zh: '霰落星殿',
} as unknown as WEngineListItem

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/w-engines/:id', component: { template: '<div/>' } },
      { path: '/:pathMatch(.*)*', component: { template: '<div/>' } },
    ],
  })
}

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

describe('AgentHead hero 身份图标', () => {
  it('稀有度/属性/职业各一枚本地图标，alt 保留文字语义', () => {
    mockMatchMedia({ narrow: false })
    const icons = mount(AgentHead, { props: { detail }, ...mountOptions }).findAll('.meta img')
    expect(icons.map((i) => i.attributes('src'))).toEqual([
      '/data/img/filter/IconRoleSSmall.webp',
      '/data/img/filter/IconFire.webp',
      '/data/img/filter/IconAttack.webp',
    ])
    expect(icons.map((i) => i.attributes('alt'))).toEqual(['稀有度 S', '火', '强攻'])
  })

  it('特殊属性角色改用专属属性图标（烈霜 → IconFrost），alt 用特殊属性名', () => {
    mockMatchMedia({ narrow: false })
    const w = mount(AgentHead, {
      props: {
        detail: {
          ...detail,
          element_type: { 202: 'Ice' },
          special_element_type: { name: '烈霜' },
        },
      },
      ...mountOptions,
    })
    const icons = w.findAll('.meta img')
    expect(icons[1].attributes('src')).toBe('/data/img/filter/IconFrost.webp')
    expect(icons[1].attributes('alt')).toBe('烈霜')
  })
})

describe('AgentHead hero 专属音擎注记', () => {
  it('传入 signatureEngine 时在封面内渲染注记，链接指向 /w-engines/{Id}', () => {
    mockMatchMedia({ narrow: false })
    const w = mount(AgentHead, {
      props: { detail, signatureEngine },
      global: { plugins: [makeRouter()] },
    })
    const sig = w.find('.ahead .signature')
    expect(sig.exists()).toBe(true)
    expect(sig.attributes('href')).toBe('/w-engines/14109')
    expect(sig.find('.sig-label').exists()).toBe(false)
    expect(sig.attributes('aria-label')).toBe('专属音擎：霰落星殿，前往音擎详情')
    expect(sig.find('.sig-name').text()).toBe('霰落星殿')
    expect(sig.find('img').attributes('src')).toBe('/data/img/weapon/Weapon_S_1091.webp')
  })

  it('未传入 signatureEngine（名录未加载/未覆盖）时不渲染注记', () => {
    mockMatchMedia({ narrow: false })
    const w = mount(AgentHead, { props: { detail }, global: { plugins: [makeRouter()] } })
    expect(w.find('.signature').exists()).toBe(false)
  })
})
