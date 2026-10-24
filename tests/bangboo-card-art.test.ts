// /bangboos 名录卡的图片面：有解包产品图的邦布走派生档（card 800w → 原图兜底），
// 没有的回落名录图标并居中收缩；两者同一 5:4 标本盒，故卡片几何一致。
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import { bangbooArtCardSources, bangbooArtSource, BANGBOO_ART_RATIO } from '../src/data/bangbooArt'

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('prefers-reduced-motion'),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
})

const { detailMock, listMock } = vi.hoisted(() => ({ detailMock: vi.fn(), listMock: vi.fn() }))
vi.mock('@/data/api', () => ({
  api: { detail: detailMock, list: listMock },
}))

import BangboosView from '../src/views/BangboosView.vue'

function bangboo(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    Id: 54023,
    icon: 'BangbooGarageRole07',
    rank: 4,
    codename: 'Ariel',
    zh: '艾瑞儿',
    en: 'Ariel',
    ja: 'エアリエル',
    ko: '에어리얼',
    ...over,
  }
}

const ART = bangboo()
const ICON = bangboo({ Id: 53001, icon: 'BangbooGarageRole12', rank: 3, codename: 'Devilboo', zh: '恶魔布' })
const THIRD = bangboo({ Id: 54022, icon: 'BangbooGarageRole09', codename: 'Ultra Jako', zh: '超极杰克' })
const FOURTH = bangboo({ Id: 54021, icon: 'BangbooGarageRole10', codename: 'Sprout', zh: '芽芽' })
const FIFTH = bangboo({ Id: 54020, icon: 'BangbooGarageRole13', codename: 'Birkblick', zh: '比克布利克' })

async function mountView(items = [ART, ICON, THIRD, FOURTH, FIFTH]) {
  listMock.mockImplementation((kind: string) => Promise.resolve(kind === 'bangboo' ? items : []))
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/bangboos/:id', component: { template: '<div/>' } },
      { path: '/bangboos', component: { template: '<div/>' } },
      { path: '/:pathMatch(.*)*', component: { template: '<div/>' } },
    ],
  })
  await router.push('/bangboos')
  const w = mount(BangboosView, { global: { plugins: [router], directives: { reveal: () => {} } } })
  await flushPromises()
  return w
}

beforeEach(() => {
  detailMock.mockReset()
  listMock.mockReset()
})

describe('bangbooArtCardSources', () => {
  it('清单内的邦布给出「派生档 → 原图」候选链', () => {
    expect(bangbooArtCardSources('BangbooGarageRole07')).toEqual([
      '/data/img/bangboo-art/card/BangbooGarageRole07_GaChaEF.webp',
      '/data/img/bangboo-art/BangbooGarageRole07_GaChaEF.webp',
    ])
  })

  it('清单外/空值返回空候选（交给名录图标）', () => {
    expect(bangbooArtCardSources('BangbooGarageRole12')).toEqual([])
    expect(bangbooArtCardSources(undefined)).toEqual([])
    expect(bangbooArtCardSources('')).toEqual([])
  })

  it('单图取值走原图（详情页/分享图用）', () => {
    expect(bangbooArtSource('BangbooGarageRole07')).toBe(
      '/data/img/bangboo-art/BangbooGarageRole07_GaChaEF.webp',
    )
    expect(bangbooArtSource('BangbooGarageRole12')).toBe('')
  })
})

describe('BangboosView 卡片图片面', () => {
  it('有产品图的邦布：图用派生档、5:4 标本盒、不加 icon-only', async () => {
    const w = await mountView()
    const card = w.findAll('.card-grid .card')[0]!
    const art = card.find('.card-art')
    expect(art.classes()).not.toContain('icon-only')
    expect(art.attributes('style')).toContain(`aspect-ratio: ${BANGBOO_ART_RATIO}`)
    expect(art.find('img').attributes('src')).toBe(
      '/data/img/bangboo-art/card/BangbooGarageRole07_GaChaEF.webp',
    )
    expect(art.find('img').attributes('alt')).toBe('')
  })

  it('无产品图的邦布：回落名录图标，同一个 5:4 盒并居中收缩', async () => {
    const w = await mountView()
    const art = w.findAll('.card-grid .card')[4]!.find('.card-art')
    expect(art.classes()).toContain('icon-only')
    expect(art.attributes('style')).toContain(`aspect-ratio: ${BANGBOO_ART_RATIO}`)
    expect(art.find('img').attributes('src')).toBe('/data/img/bangboo/BangbooGarageRole12.webp')
  })

  it('卡面链接指向详情页，卡名与编号在链接内、稀有度独立成徽标', async () => {
    const w = await mountView()
    const first = w.findAll('.card-grid .card')[0]!
    const link = first.find('a.card-link')
    expect(link.attributes('href')).toBe('/bangboos/54023')
    expect(link.text().replace(/\s+/g, '')).toBe('艾瑞儿SAriel')
    expect(first.find('.card-meta .code').text()).toBe('Ariel')
  })

  it('首屏四张图 eager（LCP 动机，单列手机首屏可见），其余 lazy', async () => {
    const w = await mountView()
    const loadings = w.findAll('.card-grid .card .card-art img').map((i) => i.attributes('loading'))
    expect(loadings.slice(0, 4)).toEqual(['eager', 'eager', 'eager', 'eager'])
    expect(loadings[4]).toBe('lazy')
  })

  it('编号列不再丢：卡内保留代号文本（默认编号倒序）', async () => {
    const w = await mountView()
    const codes = w.findAll('.card-grid .card .card-meta .code').map((c) => c.text())
    expect(codes).toEqual(['Ariel', 'Ultra Jako', 'Sprout', 'Birkblick', 'Devilboo'])
  })
})
