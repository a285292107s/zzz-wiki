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

const { detailMock, listMock } = vi.hoisted(() => ({
  detailMock: vi.fn(),
  listMock: vi.fn(),
}))
vi.mock('@/data/api', () => ({ api: { detail: detailMock, list: listMock } }))

import AgentDetailView from '../src/views/AgentDetailView.vue'

const detail = {
  id: 1091,
  name: '星见雅',
  code_name: 'MIYABI',
  rarity: 4,
  element_type: { 202: 'Ice' },
  weapon_type: { 1: 'Attack' },
  hit_type: { 101: 'Slash' },
  camp: { 6: '对空洞特别行动部第六课' },
  partner_info: {
    full_name: '星见雅',
    gender: '女',
    birthday: '6/28',
    stature: '172',
  },
}

const weapons = [{ Id: 14109, icon: 'Weapon_S_1091', zh: '霰落星殿' }]

async function mountDetail() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/agents', component: {} },
      { path: '/agents/:id', component: {} },
      { path: '/w-engines', component: {} },
      { path: '/w-engines/:id', component: {} },
    ],
  })
  await router.push('/agents/1091')
  const w = mount(AgentDetailView, { global: { plugins: [router] } })
  await flushPromises()
  return w
}

function dossierCell(w: Awaited<ReturnType<typeof mountDetail>>, label: string) {
  return w.findAll('#dossier .d-item').find((c) => c.find('dt').text() === label)
}

beforeEach(() => {
  detailMock.mockReset()
  listMock.mockReset()
  detailMock.mockResolvedValue(detail)
  listMock.mockResolvedValue(weapons)
})

describe('AgentDetailView 档案详情承接封面细节', () => {
  it('封面不再出现攻击类型（情报归档案详情）', async () => {
    const w = await mountDetail()
    expect(w.find('.ahead').text()).not.toContain('斩击')
  })

  it('攻击类型成为档案字段', async () => {
    const w = await mountDetail()
    const cell = dossierCell(w, '攻击类型')
    expect(cell).toBeTruthy()
    expect(cell?.find('dd').text()).toBe('斩击')
  })
})
