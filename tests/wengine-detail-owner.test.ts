// WEngineDetailView head 归属代理人（反向交叉引用）：video-engine → owner agent。
// 用真实 memory router + mock api（detail/list），固化 marginalia 交叉引用的渲染与路由。
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

// jsdom 缺失的浏览器 API：matchMedia 命中 reduce → reveal 指令直接跳过
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi
    .fn()
    .mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
})

const { detailMock, listMock } = vi.hoisted(() => ({ detailMock: vi.fn(), listMock: vi.fn() }))
vi.mock('@/data/api', () => ({ api: { detail: detailMock, list: listMock } }))

import WEngineDetailView from '../src/views/WEngineDetailView.vue'

/** 可复现的构造器：detail 是详情，agents 是代理人名录（api.list 按 kind 返回）
 *  listMock 需按 kind 区分：'/agents' → character 名录，'/w-engines' → weapon 名录 */
function makeEngineDetail(codeName: string) {
  return { id: 14109, name: '霰落星殿', code_name: codeName, rarity: 4, atk_max: 475 }
}

async function mountView(engineDetail: object, agents: Array<{ Id: number; zh: string }>) {
  detailMock.mockResolvedValue(engineDetail)
  listMock.mockImplementation((kind: string) => {
    if (kind === 'character') return Promise.resolve(agents)
    if (kind === 'weapon') return Promise.resolve([])
    return Promise.resolve([])
  })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/w-engines/:id', component: { template: '<div/>' } },
      { path: '/agents/:id', component: { template: '<div/>' } },
      { path: '/:pathMatch(.*)*', component: { template: '<div/>' } },
    ],
  })
  await router.push('/w-engines/14109')
  const w = mount(WEngineDetailView, { global: { plugins: [router] } })
  await flushPromises()
  return w
}

beforeEach(() => {
  detailMock.mockReset()
  listMock.mockReset()
})

describe('WEngineDetailView 归属代理人交叉引用', () => {
  it('签名音擎（Weapon_S_<id> 命名）渲染归属代理人，链接指向 /agents/{Id}', async () => {
    const w = await mountView(
      makeEngineDetail('Weapon_S_1091'),
      [{ Id: 1091, zh: '雅' }],
    )
    const ref = w.find('.signature')
    expect(ref.exists()).toBe(true)
    expect(ref.attributes('href')).toBe('/agents/1091')
    expect(ref.find('.sig-label').text()).toBe('归属代理人')
    expect(ref.find('.sig-name').text()).toBe('雅')
    // 代理人头像素材是横幅（180×64）→ 宽扁盒 banner（与代理人列表同尺寸约定），避免被方盒压成细条
    expect(ref.find('.sig-icon').classes()).toContain('banner')
    // aria-label 作为 attribute 透传落到根 <a>
    expect(ref.attributes('aria-label')).toBe('归属代理人：雅，前往代理人详情')
  })

  it('公共池通用音擎（无 _<id> 命名）不渲染归属代理人交叉引用', async () => {
    const w = await mountView(
      makeEngineDetail('Weapon_S_Common_01'),
      [{ Id: 1091, zh: '雅' }],
    )
    expect(w.find('.signature').exists()).toBe(false)
  })

  it('名录未加载（agents 空）时不渲染交叉引用，不阻塞主内容', async () => {
    const w = await mountView(makeEngineDetail('Weapon_S_1091'), [])
    expect(w.find('.signature').exists()).toBe(false)
    // 主区块（基础属性）仍在
    expect(w.find('#props').exists()).toBe(true)
  })
})
