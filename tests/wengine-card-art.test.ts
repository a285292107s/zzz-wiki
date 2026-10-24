// /w-engines 名录卡的图片面：有解包产品大图的音擎走派生档（card 800w → 原图兜底），
// 没有的回落名录图标并居中收缩；两者同一 5:4 标本盒，故卡片几何一致。
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import { weaponArtCardSources, weaponArtSource, WEAPON_ART_RATIO } from '../src/data/weaponArt'

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

import WEnginesView from '../src/views/WEnginesView.vue'

function engine(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    Id: 14164,
    icon: 'Weapon_S_1641',
    rank: 4,
    type: 3,
    zh: '涅槃初翎',
    en: 'Zanshin Herb Case',
    ja: '涅槃初翎',
    ko: '열반초우',
    atk: 475,
    base_property: { name: '基础攻击力', value: 48, format: '{0:0.#}' },
    rand_property: { name: '异常掌控', value: 30, format: '{0:0.#%}' },
    effect_name: '破壳日',
    effect_desc: '装备者的异常精通提升90点。',
    effect_refine: 1,
    ...over,
  }
}

const ART_ENGINE = engine()
const ICON_ENGINE = engine({ Id: 13111, icon: 'Weapon_S_1021', rank: 4, zh: '仲裁者', effect_desc: '装备者攻击力提升。' })
const THIRD = engine({ Id: 13001, icon: 'Weapon_A_Common_01', rank: 3, zh: '异响猎手' })
const FOURTH = engine({ Id: 12001, icon: 'Weapon_B_Common_01', rank: 2, zh: '电磁暴-壹式' })

async function mountView(items = [ART_ENGINE, ICON_ENGINE, THIRD, FOURTH]) {
  listMock.mockImplementation((kind: string) => Promise.resolve(kind === 'weapon' ? items : []))
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/w-engines/:id', component: { template: '<div/>' } },
      { path: '/w-engines', component: { template: '<div/>' } },
      { path: '/:pathMatch(.*)*', component: { template: '<div/>' } },
    ],
  })
  await router.push('/w-engines')
  const w = mount(WEnginesView, { global: { plugins: [router], directives: { reveal: () => {} } } })
  await flushPromises()
  return w
}

beforeEach(() => {
  detailMock.mockReset()
  listMock.mockReset()
})

describe('weaponArtCardSources', () => {
  it('清单内的音擎给出「派生档 → 原图」候选链', () => {
    expect(weaponArtCardSources('Weapon_S_1641')).toEqual([
      '/data/img/weapon-art/card/Weapon_S_1641_GachaEF.webp',
      '/data/img/weapon-art/Weapon_S_1641_GachaEF.webp',
    ])
  })

  it('清单外的音擎/空值返回空候选（交给名录图标）', () => {
    expect(weaponArtCardSources('Weapon_S_1021')).toEqual([])
    expect(weaponArtCardSources(undefined)).toEqual([])
    expect(weaponArtCardSources('')).toEqual([])
  })

  it('详情页用的原图取值保持不变', () => {
    expect(weaponArtSource('Weapon_S_1641')).toBe(
      '/data/img/weapon-art/Weapon_S_1641_GachaEF.webp',
    )
    expect(weaponArtSource('Weapon_S_1021')).toBe('')
  })
})

describe('WEnginesView 卡片图片面', () => {
  it('有大图的音擎：图用派生档、5:4 标本盒、不加 icon-only', async () => {
    const w = await mountView()
    const card = w.findAll('.card-grid .card')[0]!
    const art = card.find('.card-art')
    expect(art.classes()).not.toContain('icon-only')
    expect(art.attributes('style')).toContain(`aspect-ratio: ${WEAPON_ART_RATIO}`)
    expect(art.find('img').attributes('src')).toBe(
      '/data/img/weapon-art/card/Weapon_S_1641_GachaEF.webp',
    )
    expect(art.find('img').attributes('alt')).toBe('')
  })

  it('无大图的音擎：回落名录图标，同一个 5:4 盒并居中收缩', async () => {
    const w = await mountView()
    const art = w.findAll('.card-grid .card')[1]!.find('.card-art')
    expect(art.classes()).toContain('icon-only')
    expect(art.attributes('style')).toContain(`aspect-ratio: ${WEAPON_ART_RATIO}`)
    expect(art.find('img').attributes('src')).toBe('/data/img/weapon/Weapon_S_1021.webp')
  })

  it('stretched link：链接只承载图与名称（可访问名=音擎名），规格/效果作为卡内文本留在链接外', async () => {
    const w = await mountView()
    const first = w.findAll('.card-grid .card')[0]!
    const link = first.find('a.card-link')
    expect(link.attributes('href')).toBe('/w-engines/14164')
    expect(link.attributes('aria-label')).toBeUndefined()
    expect(link.text().replace(/\s+/g, '')).toBe('涅槃初翎S异常')
    expect(link.find('.specs').exists()).toBe(false)
    expect(first.findAll('.card > .card-block')).toHaveLength(2)
  })

  it('稀有度徽标的读屏名带上档位（旧写法只念「稀有度」，S 被吃掉）', async () => {
    const w = await mountView()
    const first = w.findAll('.card-grid .card')[0]!
    expect(first.find('.card-meta .tier').attributes('aria-label')).toBe('稀有度 S')
  })

  it('首屏三张图 eager（LCP 动机），其余 lazy', async () => {
    const w = await mountView()
    const loadings = w.findAll('.card-grid .card .card-art img').map((i) => i.attributes('loading'))
    expect(loadings.slice(0, 3)).toEqual(['eager', 'eager', 'eager'])
    expect(loadings[3]).toBe('lazy')
  })

  it('满级属性账目与音擎效果仍在卡内陈列（信息面不因图片改版缩水）', async () => {
    const w = await mountView()
    const first = w.findAll('.card-grid .card')[0]!
    const text = first.text().replace(/\s+/g, ' ')
    expect(text).toContain('基础攻击力')
    expect(text).toContain('满级 Lv.60')
    expect(text).toContain('破壳日')
    expect(text).toContain('装备者的异常精通提升90点。')
  })
})
