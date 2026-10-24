// 音擎详情页右栏画像：有解包大图的音擎整幅展示产品图，没有的回落名录图标。
// 大图清单是 src/data/weapon-art.json（前端与导入脚本共用），此处固化两端的接线。
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi
    .fn()
    .mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
})

const { detailMock, listMock } = vi.hoisted(() => ({ detailMock: vi.fn(), listMock: vi.fn() }))
vi.mock('@/data/api', () => ({
  api: { detail: detailMock, list: listMock },
}))

import WEngineDetailView from '../src/views/WEngineDetailView.vue'

function makeEngineDetail(id: number, codeName: string) {
  return {
    id,
    name: '涅槃初翎',
    code_name: codeName,
    rarity: 4,
    atk_max: 475,
    icon: `Assets/NapResources/UI/Sprite/A1DynamicLoad/ItemIconWeapon/UnPacker/${codeName}.png`,
  }
}

async function mountView(engineDetail: object) {
  detailMock.mockResolvedValue(engineDetail)
  listMock.mockImplementation(() => Promise.resolve([]))
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/w-engines/:id', component: { template: '<div/>' } },
      { path: '/w-engines', component: { template: '<div/>' } },
      { path: '/:pathMatch(.*)*', component: { template: '<div/>' } },
    ],
  })
  await router.push(`/w-engines/${(engineDetail as { id: number }).id}`)
  const w = mount(WEngineDetailView, { global: { plugins: [router] } })
  await flushPromises()
  return w
}

beforeEach(() => {
  detailMock.mockReset()
  listMock.mockReset()
})

describe('WEngineDetailView 右栏画像', () => {
  it('清单内的音擎用解包大图，宽幅盒 + contain 整幅展示', async () => {
    const w = await mountView(makeEngineDetail(14164, 'Weapon_S_1641'))
    const box = w.find('.portrait')
    expect(box.classes()).toContain('wide')
    const img = box.find('.frame img')
    expect(img.attributes('src')).toBe('/data/img/weapon-art/Weapon_S_1641_GachaEF.webp')
    expect(img.classes()).toContain('fit-contain')
    expect(box.find('.frame').attributes('style')).toContain('aspect-ratio: 5 / 4')
  })

  it('清单外的音擎回落名录图标，保持 1:1 方盒裁切', async () => {
    const w = await mountView(makeEngineDetail(13111, 'Weapon_S_1021'))
    const box = w.find('.portrait')
    expect(box.classes()).not.toContain('wide')
    const img = box.find('.frame img')
    expect(img.attributes('src')).toBe('/data/img/weapon/Weapon_S_1021.webp')
    expect(img.classes()).toContain('fit-cover')
    expect(box.find('.frame').attributes('style')).toContain('aspect-ratio: 1 / 1')
  })
})
