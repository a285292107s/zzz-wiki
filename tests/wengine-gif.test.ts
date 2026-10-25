// @vitest-environment jsdom
import fs from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { hasWEngineGif, wEngineGifPosterSources, wEngineGifSources } from '../src/data/wengineGif'
import gifs from '../src/data/wengine-gifs.json'

const { detailMock, listMock } = vi.hoisted(() => ({ detailMock: vi.fn(), listMock: vi.fn() }))
vi.mock('@/data/api', () => ({
  api: { detail: detailMock, list: listMock },
}))

import WEngineDetailView from '../src/views/WEngineDetailView.vue'

const LOCAL = '/data/img/wengine-gif'
const SAMPLE_ID = 14164

class StubIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: StubIntersectionObserver,
})

function mockReducedMotion(reduced: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn((query: string) => ({
      matches: query.includes('prefers-reduced-motion') ? reduced : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
}

async function mountView() {
  detailMock.mockResolvedValue({
    id: SAMPLE_ID,
    Id: SAMPLE_ID,
    name: '涅槃初翎',
    code_name: 'Nirvana',
    icon: 'UI/Sprite/A1DynamicLoad/IconWeapon/UnPacker/Weapon_S_14164.png',
    desc: '一段关于音擎的记述。',
    desc2: '支援代理人装备时生效。',
    desc3: '灼羽重燃。',
    talents: {},
  })
  listMock.mockResolvedValue([])
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/w-engines/:id', component: { template: '<div/>' } },
      { path: '/w-engines', component: { template: '<div/>' } },
      { path: '/:pathMatch(.*)*', component: { template: '<div/>' } },
    ],
  })
  await router.push(`/w-engines/${SAMPLE_ID}`)
  const wrapper = mount(WEngineDetailView, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  detailMock.mockReset()
  listMock.mockReset()
  mockReducedMotion(false)
})

describe('音擎动画清单', () => {
  const weapons = JSON.parse(fs.readFileSync('public/data/live/zh/weapon.json', 'utf8')) as Record<
    string,
    unknown
  >

  it('清单键都对应音擎数据，且都是 mihoyo 原始链接', () => {
    const ids = Object.keys(gifs)
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) {
      expect(weapons).toHaveProperty(id)
      const entry = (gifs as Record<string, { contentId: string; url: string }>)[id]
      expect(entry.contentId).toMatch(/^\d+$/)
      expect(entry.url).toMatch(/^https:\/\/act-upload\.mihoyo\.com\/.+\.gif$/)
    }
  })

  it('按音擎 Id 生成本地候选，未登记的 Id 返回空', () => {
    expect(hasWEngineGif(SAMPLE_ID)).toBe(true)
    expect(wEngineGifSources(SAMPLE_ID)).toEqual([`${LOCAL}/${SAMPLE_ID}.webp`])
    expect(wEngineGifPosterSources(String(SAMPLE_ID))).toEqual([`${LOCAL}/poster/${SAMPLE_ID}.webp`])
    expect(hasWEngineGif(99999)).toBe(false)
    expect(wEngineGifSources(99999)).toEqual([])
  })
})

describe('WEngineDetailView 头图画幅', () => {
  it('默认播放动画，按钮可切到静帧', async () => {
    const wrapper = await mountView()
    const img = wrapper.find('.portrait .frame img')
    expect(img.attributes('src')).toBe(`${LOCAL}/${SAMPLE_ID}.webp`)

    const toggle = wrapper.find('.motion-toggle')
    expect(toggle.attributes('aria-label')).toBe('暂停动画')
    await toggle.trigger('click')
    expect(wrapper.find('.portrait .frame img').attributes('src')).toBe(
      `${LOCAL}/poster/${SAMPLE_ID}.webp`,
    )
    expect(wrapper.find('.motion-toggle').attributes('aria-label')).toBe('播放动画')
  })

  it('系统减动效时默认静帧', async () => {
    mockReducedMotion(true)
    const wrapper = await mountView()
    expect(wrapper.find('.portrait .frame img').attributes('src')).toBe(
      `${LOCAL}/poster/${SAMPLE_ID}.webp`,
    )
    expect(wrapper.find('.motion-toggle').attributes('aria-label')).toBe('播放动画')
  })
})
