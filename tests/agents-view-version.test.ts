// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import AgentsView from '../src/views/AgentsView.vue'

const AGENTS_VIEW_KEY = 'zzz-wiki:agents-view'

vi.mock('../src/data/resources', () => ({
  listFor: () =>
    Promise.resolve([
      { Id: 1011, icon: 'IconRole01', camp: 1, camp_name: '狡兔屋', element: 203, type: 1, rank: 3 },
    ]),
}))

async function mountAgents() {
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

describe('AgentsView（名录页的陈列版本）', () => {
  beforeEach(() => {
    localStorage.clear()
  })

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
  })
})
