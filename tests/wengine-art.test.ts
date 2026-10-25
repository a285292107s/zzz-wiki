// 音擎详情页右栏画像的优先级：装备动画 > 解包大图（整幅 contain）> 名录图标（1:1 裁切）。
// 大图清单是 src/data/weapon-art.json、动画清单是 src/data/wengine-gifs.json（前端与导入脚本共用），此处固化接线。
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

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
})

const { detailMock, listMock } = vi.hoisted(() => ({ detailMock: vi.fn(), listMock: vi.fn() }))
vi.mock('@/data/api', () => ({
  api: { detail: detailMock, list: listMock },
}))

import WEngineDetailView from '../src/views/WEngineDetailView.vue'

/** 14164 在动画清单里；14163（禁罪囚笼）没有动画词条，用来考察大图/图标两级回落 */
const WITH_MOTION = 14164
const WITHOUT_MOTION = 14163

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
  it('有装备动画的音擎优先放动画，1:1 方盒 + 播放按钮（减动效时默认静帧）', async () => {
    const w = await mountView(makeEngineDetail(WITH_MOTION, 'Weapon_S_1641'))
    const box = w.find('.portrait')
    expect(box.classes()).not.toContain('wide')
    const img = box.find('.frame img')
    expect(img.attributes('src')).toBe(`/data/img/wengine-gif/poster/${WITH_MOTION}.webp`)
    expect(img.classes()).toContain('fit-cover')
    expect(box.find('.frame').attributes('style')).toContain('aspect-ratio: 1 / 1')
    expect(box.find('.motion-toggle').attributes('aria-label')).toBe('播放动画')
  })

  it('没有动画、但有大图的音擎用解包大图，宽幅盒 + contain 整幅展示', async () => {
    const w = await mountView(makeEngineDetail(WITHOUT_MOTION, 'Weapon_S_1641'))
    const box = w.find('.portrait')
    expect(box.classes()).toContain('wide')
    const img = box.find('.frame img')
    expect(img.attributes('src')).toBe('/data/img/weapon-art/Weapon_S_1641_GachaEF.webp')
    expect(img.classes()).toContain('fit-contain')
    expect(box.find('.frame').attributes('style')).toContain('aspect-ratio: 5 / 4')
    expect(box.find('.motion-toggle').exists()).toBe(false)
  })

  it('既无动画也无大图的音擎回落名录图标，保持 1:1 方盒裁切', async () => {
    const w = await mountView(makeEngineDetail(WITHOUT_MOTION, 'Weapon_S_9999'))
    const box = w.find('.portrait')
    expect(box.classes()).not.toContain('wide')
    const img = box.find('.frame img')
    expect(img.attributes('src')).toBe('/data/img/weapon/Weapon_S_9999.webp')
    expect(img.classes()).toContain('fit-cover')
    expect(box.find('.frame').attributes('style')).toContain('aspect-ratio: 1 / 1')
  })
})
