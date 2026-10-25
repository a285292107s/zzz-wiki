// 音擎详情「精炼效果」：5 阶是同一段效果的不同数值，逐阶并列 5 行 = 同一段话抄 5 遍。
// 这里固化改后的契约：**只渲染当前阶那一份** + 滑条选阶（默认 1 阶）+ `?rf=` 深链 + 缺档如实标注。
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

import {
  refineRowAt,
  W_ENGINE_REFINE_MAX,
  W_ENGINE_REFINE_MIN,
  type DetailRow,
} from '../src/domain/sections'

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

import WEngineDetailView from '../src/views/WEngineDetailView.vue'

/** 造一份 talents 字典：阶数 → 效果行（数值随阶数递增，便于断言「当前显示哪一阶」） */
function makeTalents(tiers: number[] = [1, 2, 3, 4, 5]) {
  return Object.fromEntries(
    tiers.map((t) => [
      String(t),
      { name: '永夜辗眠', desc: `装备者暴击率提升${20 + t * 2}%；造成的伤害无视目标10%属性伤害抗性。` },
    ]),
  )
}

async function mountView(query = '', tiers?: number[]) {
  detailMock.mockResolvedValue({
    id: 14162,
    name: '绯月银棺',
    code_name: 'Weapon_S_14162',
    rarity: 5,
    talents: makeTalents(tiers),
  })
  listMock.mockImplementation((kind: string) =>
    Promise.resolve(kind === 'character' ? [] : []),
  )
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/w-engines/:id', component: { template: '<div/>' } },
      { path: '/agents/:id', component: { template: '<div/>' } },
      { path: '/:pathMatch(.*)*', component: { template: '<div/>' } },
    ],
  })
  await router.push(`/w-engines/14162${query}`)
  const w = mount(WEngineDetailView, { global: { plugins: [router] } })
  await flushPromises()
  return { w, router }
}

/** 区块内的正文文本（去掉空白，便于按数值断言） */
const refineText = (w: Awaited<ReturnType<typeof mountView>>['w']) =>
  w.find('#talents .refine-desc').text().replace(/\s+/g, '')

beforeEach(() => {
  detailMock.mockReset()
  listMock.mockReset()
})

describe('refineRowAt', () => {
  const rows: DetailRow[] = [1, 2, 3, 4, 5].map((no) => ({ no, name: 'x', desc: String(no) }))

  it('有该档时按序号精确取行', () => {
    expect(refineRowAt(rows, 3)?.no).toBe(3)
    expect(refineRowAt(rows, W_ENGINE_REFINE_MIN)?.no).toBe(1)
    expect(refineRowAt(rows, W_ENGINE_REFINE_MAX)?.no).toBe(5)
  })

  it('缺该档时取序号最接近的一档（截断取最高档、缺低档取下位档），不留空白', () => {
    const truncated = rows.slice(0, 3) // 只有 1-3 阶
    expect(refineRowAt(truncated, 5)?.no).toBe(3)
    const missingLow = rows.slice(1) // 缺 1 阶
    expect(refineRowAt(missingLow, 1)?.no).toBe(2)
  })

  it('没有档位数据时返回 null（交由视图走空态）', () => {
    expect(refineRowAt([], 5)).toBeNull()
  })
})

describe('音擎详情 精炼效果（一阶一段）', () => {
  it('默认 1 阶：只渲染一份效果名与正文，不再逐阶重复 5 行', async () => {
    const { w } = await mountView()
    expect(w.findAll('#talents .refine-name')).toHaveLength(1)
    expect(w.findAll('#talents .refine-desc')).toHaveLength(1)
    expect(w.find('#talents .refine-name').text()).toBe('永夜辗眠')
    // 1 阶数值 = 20 + 1*2 = 22%，且不含其它阶的数值
    expect(refineText(w)).toContain('22%')
    expect(refineText(w)).not.toContain('30%')
    // 区块内不承载动作位（决策记录 0006：页面级动作归 DetailPage 的 .page-actions，不回到数据区块）
    expect(w.find('#talents .refine-actions').exists()).toBe(false)
    expect(w.find('#talents').text()).toContain('精炼 1 阶')
  })

  it('拖滑条换阶：正文换成该阶数值、URL 带 ?rf=', async () => {
    const { w, router } = await mountView()
    const slider = w.find('#talents input.level-range')
    expect(slider.attributes('aria-valuetext')).toBe('精炼 1 阶')

    await slider.setValue('3')
    await flushPromises()

    expect(refineText(w)).toContain('26%') // 3 阶 = 20 + 3*2
    expect(refineText(w)).not.toContain('22%')
    expect(w.find('#talents').text()).toContain('精炼 3 阶')
    expect(slider.attributes('aria-valuetext')).toBe('精炼 3 阶')
    expect(router.currentRoute.value.query.rf).toBe('3')

    // 回到默认档（1 阶）：参数被移除
    await slider.setValue(String(W_ENGINE_REFINE_MIN))
    await flushPromises()
    expect(router.currentRoute.value.query.rf).toBeUndefined()
  })

  it('?rf= 深链：直接落在该阶，默认档不写参数', async () => {
    const { w } = await mountView(`?rf=${W_ENGINE_REFINE_MAX}`)
    expect(w.find('#talents input.level-range').attributes('aria-valuetext')).toBe('精炼 5 阶')
    expect(refineText(w)).toContain('30%') // 5 阶 = 20 + 5*2
    expect(w.find('#talents').text()).toContain('精炼 5 阶')
  })

  it('数据缺默认档时如实标注实际档数，不留空白', async () => {
    const { w } = await mountView('', [2, 3, 4, 5])
    expect(w.find('#talents .refine-desc').exists()).toBe(true)
    expect(w.find('#talents').text()).toContain('精炼 2 阶')
    expect(refineText(w)).toContain('24%')
  })

  it('完全没有精炼数据时走空态（—），滑条不渲染', async () => {
    const { w } = await mountView('', [])
    expect(w.find('#talents .refine-desc').exists()).toBe(false)
    expect(w.find('#talents .empty').text()).toBe('—')
  })
})
