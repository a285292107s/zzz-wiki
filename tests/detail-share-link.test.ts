// 详情页分享入口的**放置与门禁**契约（决策记录 0006）。
// 按钮复制的是 location.href 整份 URL，属页面级动作，故归 DetailPage 的 .page-actions
// 行；等级/精炼区块内不再有它。这里固化两条容易被改回去的性质：
//   1. 出现位置在页面动作行，且与等级是否默认无关；
//   2. 只在档案就绪时出现——.page-actions 在 AsyncState 之外，加载/404 也会渲染。
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
vi.mock('@/data/api', () => ({
  api: { detail: detailMock, list: listMock },
}))

import AgentDetailView from '../src/views/AgentDetailView.vue'
import WEngineDetailView from '../src/views/WEngineDetailView.vue'

const AGENT = {
  id: 1011,
  name: '安比',
  code_name: 'Agent_1011',
  rarity: 4,
  level: { '1': { HpMax: 617, AtkMax: 93, DefMax: 49 } },
  talent: {},
}

async function mountView(
  component: typeof AgentDetailView | typeof WEngineDetailView,
  path: string,
) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/agents/:id', component: { template: '<div/>' } },
      { path: '/w-engines/:id', component: { template: '<div/>' } },
      { path: '/:pathMatch(.*)*', component: { template: '<div/>' } },
    ],
  })
  await router.push(path)
  const w = mount(component, { global: { plugins: [router] } })
  await flushPromises()
  return { w, router }
}

beforeEach(() => {
  detailMock.mockReset()
  listMock.mockReset()
  listMock.mockResolvedValue([])
})

describe('详情页分享入口（页面级）', () => {
  it('出现在 .page-actions 行，且默认等级下也在（语义是「分享此页」而非「导出等级参数」）', async () => {
    detailMock.mockResolvedValue(AGENT)
    const { w } = await mountView(AgentDetailView, '/agents/1011')

    const actions = w.find('.page-actions')
    expect(actions.exists()).toBe(true)
    expect(actions.find('.copy-link').exists()).toBe(true)
    // 默认视图 URL 无状态，旧门禁（等级非默认）下这里会是 false——正是本次改动推翻的性质
    expect(actions.find('.back').exists()).toBe(true)
  })

  it('等级滑条区块内不再有分享入口', async () => {
    detailMock.mockResolvedValue(AGENT)
    const { w } = await mountView(AgentDetailView, '/agents/1011')

    const panel = w.find('#stats .stat-level')
    expect(panel.exists()).toBe(true)
    expect(panel.find('.copy-link').exists()).toBe(false)
    expect(w.find('#stats').find('.copy-link').exists()).toBe(false)
  })

  it('改等级不影响入口的存在（页面级动作不随区块状态出现/消失）', async () => {
    detailMock.mockResolvedValue(AGENT)
    const { w } = await mountView(AgentDetailView, '/agents/1011')
    const before = w.find('.page-actions .copy-link').exists()

    await w.find('#stats input.level-range').setValue('42')
    await flushPromises()

    expect(w.find('.page-actions .copy-link').exists()).toBe(before)
    expect(before).toBe(true)
  })

  it('音擎页精炼区块内不再有第二个分享入口（同页只有一个复制按钮）', async () => {
    detailMock.mockResolvedValue({
      id: 14162,
      name: '绯月银棺',
      rarity: 5,
      talents: {
        '3': { name: '永夜辗眠', desc: '装备者暴击率提升26%。' },
      },
    })
    const { w } = await mountView(WEngineDetailView, '/w-engines/14162')

    await w.find('#talents input.level-range').setValue('3')
    await flushPromises()

    expect(w.find('#talents .copy-link').exists()).toBe(false)
    // 整页只应有一个复制入口
    expect(w.findAll('.copy-link')).toHaveLength(1)
    expect(w.find('.page-actions .copy-link').exists()).toBe(true)
  })

  it('档案加载失败（404）时不出现——不给坏链接提供复制出口', async () => {
    detailMock.mockRejectedValue(new Error('HTTP 404'))
    const { w } = await mountView(AgentDetailView, '/agents/9999')

    expect(w.find('.page-actions').exists()).toBe(true) // 动作行本身在 AsyncState 之外
    expect(w.find('.page-actions .copy-link').exists()).toBe(false)
  })

  it('复制出去的就是当前完整 URL（含等级参数）——按钮的全部价值所在', async () => {
    detailMock.mockResolvedValue(AGENT)
    const { w, router } = await mountView(AgentDetailView, '/agents/1011')

    const written: string[] = []
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (t: string) => (written.push(t), Promise.resolve()) },
    })

    await w.find('#stats input.level-range').setValue('42')
    await flushPromises()
    // useCopyLink 读的是 location.href；memory history 不写 location，故这里手动对齐
    // （生产用 web history，location 本就等于当前视图 URL）。
    window.history.replaceState({}, '', '/agents/1011?lv=42')
    await w.find('.page-actions .copy-link').trigger('click')
    await flushPromises()

    // 改等级后 URL 已带 lv=42，复制到的必须是这一份（不是裸路径）
    expect(router.currentRoute.value.query.lv).toBe('42')
    expect(written).toHaveLength(1)
    expect(written[0]).toContain('/agents/1011')
    expect(written[0]).toContain('lv=42')

    // 反馈：按钮切到「已复制」（视觉 + role=status 读屏播报）
    expect(w.find('.page-actions .copy-link').text()).toContain('已复制')
  })
})
