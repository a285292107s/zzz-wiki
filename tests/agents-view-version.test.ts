// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

const AGENTS_VIEW_KEY = 'zzz-wiki:agents-view'

/** 名录取数在组件挂载时才触发：用一份最小条目替掉数据层，避免测试打网络 */
vi.mock('../src/data/resources', () => ({
  listFor: () =>
    Promise.resolve([
      { Id: 1011, icon: 'IconRole01', camp: 1, camp_name: '狡兔屋', element: 203, type: 1, rank: 3 },
    ]),
}))

/** 版本偏好是模块级响应式状态（localStorage 持久化）：每个用例重置模块实例，避免跨用例污染 */
async function fresh() {
  vi.resetModules()
  return await import('../src/composables/useAgentsViewVersion')
}

/** 超时放宽：/agents 视图静态依赖两版名录（表格 + 卡片栅格），resetModules 后要重走整条导入链 */
const HEAVY_IMPORT_TIMEOUT = 20000

async function mountAgents() {
  vi.resetModules()
  const AgentsView = (await import('../src/views/AgentsView.vue')).default
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/agents', component: { template: '<div />' } }],
  })
  await router.push('/agents')
  await router.isReady()
  const w = mount(AgentsView, {
    global: {
      plugins: [router],
      directives: { reveal: () => {} },
      stubs: {
        AgentCardList: true,
        AgentTableList: true,
        FilterDropdown: true,
        SearchField: true,
      },
    },
  })
  await flushPromises()
  return { w, router }
}

describe('useAgentsViewVersion（代理人名录版本偏好）', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('无存储时默认卡片名录', async () => {
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

describe('AgentsView（名录页的陈列版本）', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('默认渲染卡片名录，切换钮两级都带选中态', async () => {
    const { w } = await mountAgents()
    expect(w.find('agent-card-list-stub').exists()).toBe(true)
    expect(w.find('agent-table-list-stub').exists()).toBe(false)
    const [cardsBtn, tableBtn] = w.findAll('.view-switch button')
    expect(cardsBtn!.attributes('aria-pressed')).toBe('true')
    expect(tableBtn!.attributes('aria-pressed')).toBe('false')
    w.unmount()
  }, HEAVY_IMPORT_TIMEOUT)

  it('偏好为表格时渲染表格名录', async () => {
    localStorage.setItem(AGENTS_VIEW_KEY, 'table')
    const { w } = await mountAgents()
    expect(w.find('agent-table-list-stub').exists()).toBe(true)
    expect(w.find('agent-card-list-stub').exists()).toBe(false)
    w.unmount()
  }, HEAVY_IMPORT_TIMEOUT)

  it('点切换钮即换陈列、落盘，且地址栏保持干净（版本不进 URL）', async () => {
    const { w, router } = await mountAgents()
    const [, tableBtn] = w.findAll('.view-switch button')

    await tableBtn!.trigger('click')
    expect(localStorage.getItem(AGENTS_VIEW_KEY)).toBe('table')
    expect(w.find('agent-table-list-stub').exists()).toBe(true)
    expect(w.find('agent-card-list-stub').exists()).toBe(false)
    expect(router.currentRoute.value.fullPath).toBe('/agents')

    const [cardsBtn] = w.findAll('.view-switch button')
    await cardsBtn!.trigger('click')
    expect(localStorage.getItem(AGENTS_VIEW_KEY)).toBe('cards')
    expect(w.find('agent-card-list-stub').exists()).toBe(true)
    expect(router.currentRoute.value.fullPath).toBe('/agents')
    w.unmount()
  }, HEAVY_IMPORT_TIMEOUT)
})
