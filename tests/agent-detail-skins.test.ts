// 皮肤区块展示条件：单套默认皮肤也渲染 #skins（详见 AgentDetailView.vue）
// 条件由 navItems 与 DetailSection 两处同步驱动，此处固化防回归。
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

// jsdom 缺失的浏览器 API：matchMedia 命中 reduce → reveal 指令直接跳过（不触发 IO）
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi
    .fn()
    .mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
})

const { detailMock } = vi.hoisted(() => ({ detailMock: vi.fn() }))
vi.mock('@/data/api', () => ({ api: { detail: detailMock } }))

import AgentDetailView from '../src/views/AgentDetailView.vue'

function makeDetail(skinCount: number) {
  const skin: Record<string, unknown> = {}
  for (let i = 0; i < skinCount; i++) {
    skin[`3110${i}00`] = { name: `皮肤${i + 1}`, desc: `描述${i + 1}`, image: `IconRole1${i}` }
  }
  return { name: '探针角色', skin }
}

/** 挂载整页（真实 memory router + mock 详情数据），返回渲染完的 wrapper */
async function mountDetail() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/agents/:id', component: {} }],
  })
  await router.push('/agents/1051')
  const w = mount(AgentDetailView, { global: { plugins: [router] } })
  await flushPromises()
  return w
}

beforeEach(() => {
  detailMock.mockReset()
})

describe('AgentDetailView 皮肤区块', () => {
  it('仅 1 套默认皮肤也渲染皮肤区块与条目', async () => {
    detailMock.mockResolvedValue(makeDetail(1))
    const w = await mountDetail()
    const section = w.find('#skins')
    expect(section.exists()).toBe(true)
    expect(section.findAll('.skin')).toHaveLength(1)
    expect(section.find('.skin-index').text()).toBe('着装 · 01')
    expect(section.find('.skin-name').text()).toBe('皮肤1')
  })

  it('2 套皮肤完整展示（回归）', async () => {
    detailMock.mockResolvedValue(makeDetail(2))
    const w = await mountDetail()
    expect(w.findAll('#skins .skin')).toHaveLength(2)
  })

  it('无 skin 数据时不渲染皮肤区块', async () => {
    detailMock.mockResolvedValue({ name: '探针角色' })
    const w = await mountDetail()
    expect(w.find('#skins').exists()).toBe(false)
    expect(w.text()).not.toContain('皮肤')
  })
})