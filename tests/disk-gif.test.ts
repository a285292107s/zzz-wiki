// @vitest-environment jsdom
import fs from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { discGifPosterSources, discGifSources, hasDiscGif } from '../src/data/discGif'
import gifs from '../src/data/disc-gifs.json'

const { detailMock, listMock } = vi.hoisted(() => ({ detailMock: vi.fn(), listMock: vi.fn() }))
vi.mock('@/data/api', () => ({
  api: { detail: detailMock, list: listMock },
}))

import DiskDetailView from '../src/views/DiskDetailView.vue'

const LOCAL = '/data/img/disc-gif'

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
    Id: 34200,
    name: '荆棘玫瑰',
    desc2: '防御力+16%。',
    desc4: '装备者造成的伤害提升15%。',
    story: '流传于维尔乌姆的歌谣。',
    icon: 'UI/Sprite/A1DynamicLoad/IconSuit/UnPacker/SuitThornedRose.png',
  })
  listMock.mockResolvedValue([])
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/disks/:id', component: { template: '<div/>' } },
      { path: '/disks', component: { template: '<div/>' } },
      { path: '/:pathMatch(.*)*', component: { template: '<div/>' } },
    ],
  })
  await router.push('/disks/34200')
  const wrapper = mount(DiskDetailView, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  detailMock.mockReset()
  listMock.mockReset()
  mockReducedMotion(false)
})

describe('驱动盘动画清单', () => {
  const equipment = JSON.parse(
    fs.readFileSync('public/data/live/zh/equipment.json', 'utf8'),
  ) as Record<string, unknown>

  it('清单键与驱动盘数据一一对应，且都是 mihoyo 原始链接', () => {
    const ids = Object.keys(gifs)
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) {
      expect(equipment).toHaveProperty(id)
      const entry = (gifs as Record<string, { contentId: string; url: string }>)[id]
      expect(entry.contentId).toMatch(/^\d+$/)
      expect(entry.url).toMatch(/^https:\/\/act-upload\.mihoyo\.com\/.+\.gif$/)
    }
  })

  it('按驱动盘 Id 生成本地候选，未登记的 Id 返回空', () => {
    expect(hasDiscGif(34200)).toBe(true)
    expect(discGifSources(34200)).toEqual([`${LOCAL}/34200.webp`])
    expect(discGifPosterSources('34200')).toEqual([`${LOCAL}/poster/34200.webp`])
    expect(hasDiscGif(99999)).toBe(false)
    expect(discGifSources(99999)).toEqual([])
  })
})

describe('DiskDetailView 头图画幅', () => {
  it('默认播放动画，按钮可切到静帧', async () => {
    const wrapper = await mountView()
    const img = wrapper.find('.portrait .frame img')
    expect(img.attributes('src')).toBe(`${LOCAL}/34200.webp`)

    const toggle = wrapper.find('.motion-toggle')
    expect(toggle.attributes('aria-label')).toBe('暂停动画')
    await toggle.trigger('click')
    expect(wrapper.find('.portrait .frame img').attributes('src')).toBe(`${LOCAL}/poster/34200.webp`)
    expect(wrapper.find('.motion-toggle').attributes('aria-label')).toBe('播放动画')
  })

  it('系统减动效时默认静帧', async () => {
    mockReducedMotion(true)
    const wrapper = await mountView()
    expect(wrapper.find('.portrait .frame img').attributes('src')).toBe(`${LOCAL}/poster/34200.webp`)
    expect(wrapper.find('.motion-toggle').attributes('aria-label')).toBe('播放动画')
  })
})
