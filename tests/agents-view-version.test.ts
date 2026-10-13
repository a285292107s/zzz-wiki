// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

const AGENTS_VIEW_KEY = 'zzz-wiki:agents-view'

/** 版本偏好是模块级响应式状态（localStorage 持久化）：每个用例重置模块实例，避免跨用例污染 */
async function fresh() {
  vi.resetModules()
  return await import('../src/composables/useAgentsViewVersion')
}

async function freshRoute() {
  vi.resetModules()
  return (await import('../src/views/AgentsRouteView.vue')).default
}

describe('useAgentsViewVersion（代理人名录版本偏好）', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('无存储时默认新版卡片名录', async () => {
    const { agentsViewVersion } = await fresh()
    expect(agentsViewVersion.value).toBe('cards')
  })

  it('读取已持久化的版本', async () => {
    localStorage.setItem(AGENTS_VIEW_KEY, 'table')
    const { agentsViewVersion } = await fresh()
    expect(agentsViewVersion.value).toBe('table')
  })

  it('非法存储值回退默认卡片名录', async () => {
    localStorage.setItem(AGENTS_VIEW_KEY, 'grid')
    const { agentsViewVersion } = await fresh()
    expect(agentsViewVersion.value).toBe('cards')
  })

  it('setAgentsViewVersion 改状态并落盘', async () => {
    const { agentsViewVersion, setAgentsViewVersion } = await fresh()
    setAgentsViewVersion('table')
    expect(agentsViewVersion.value).toBe('table')
    expect(localStorage.getItem(AGENTS_VIEW_KEY)).toBe('table')
    setAgentsViewVersion('cards')
    expect(agentsViewVersion.value).toBe('cards')
    expect(localStorage.getItem(AGENTS_VIEW_KEY)).toBe('cards')
  })
})

describe('AgentsRouteView（/agents 的版本外壳）', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  /** 两版名录都是它的静态依赖：此处 stub 掉，只验「按偏好择一渲染」 */
  const stubs = { AgentsCardsView: true, AgentsView: true }

  it('默认渲染卡片名录', async () => {
    const AgentsRouteView = await freshRoute()
    const w = mount(AgentsRouteView, { global: { stubs } })
    expect(w.find('agents-cards-view-stub').exists()).toBe(true)
    expect(w.find('agents-view-stub').exists()).toBe(false)
  })

  it('偏好为表格时渲染表格名录', async () => {
    localStorage.setItem(AGENTS_VIEW_KEY, 'table')
    const AgentsRouteView = await freshRoute()
    const w = mount(AgentsRouteView, { global: { stubs } })
    expect(w.find('agents-view-stub').exists()).toBe(true)
    expect(w.find('agents-cards-view-stub').exists()).toBe(false)
  })
})
