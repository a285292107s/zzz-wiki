import { describe, expect, it } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'
import {
  AGENT_DETAIL_ROUTE_NAME,
  HOME_ROUTE_NAME,
  VT_SHARED_ATTR,
  VT_SHARED_NAME,
  VT_SUPPORTED,
  awaitSharedEndImage,
  consumeDeckCard,
  deckTargetPath,
  isAgentDetailOf,
  isAgentDetailToDeck,
  isDeckToAgentDetail,
  rememberDeckCard,
  waitSharedEndMounted,
  waitUntil,
  type VtEnd,
} from '@/utils/viewTransition/config'

/** 判据只读 name / path / params：造一个够用的路由对象即可（vitest 跑 node 环境，没有真 router） */
function route(name: string, path: string, id?: string): RouteLocationNormalized {
  return { name, path, params: id ? { id } : {} } as RouteLocationNormalized
}

const HOME = route(HOME_ROUTE_NAME, '/')
const DETAIL = route(AGENT_DETAIL_ROUTE_NAME, '/agents/1011', '1011')
const WENGINE_DETAIL = route('w-engines-detail', '/w-engines/12001', '12001')
const AGENTS_LIST = route('agents', '/agents')

describe('共享元素过渡的路由判据', () => {
  it('详情路由前缀取自 catalog（不手写第二份类目路径）', () => {
    expect(deckTargetPath()).toBe('/agents')
  })

  it('去程只认「首页 → 代理人详情」', () => {
    expect(isDeckToAgentDetail(DETAIL, HOME)).toBe(true)
  })

  it('其余导航一律不参与（名录、音擎详情、同类目详情之间）', () => {
    expect(isDeckToAgentDetail(AGENTS_LIST, HOME)).toBe(false) // 首页 → 名录
    expect(isDeckToAgentDetail(DETAIL, AGENTS_LIST)).toBe(false) // 名录 → 详情（没有起飞端）
    expect(isDeckToAgentDetail(WENGINE_DETAIL, HOME)).toBe(false) // 别的类目详情
    expect(isDeckToAgentDetail(route('atlas', '/atlas'), HOME)).toBe(false)
  })

  it('回程只认「代理人详情 → 首页」', () => {
    expect(isAgentDetailToDeck(HOME, DETAIL)).toBe(true)
    expect(isAgentDetailToDeck(HOME, WENGINE_DETAIL)).toBe(false)
    expect(isAgentDetailToDeck(DETAIL, HOME)).toBe(false) // 反了就不是回程
  })

  it('详情比对上卡片的 id（FeaturedDeck 的 to 由卡片 id 拼出）', () => {
    expect(isAgentDetailOf(DETAIL, 1011)).toBe(true)
    expect(isAgentDetailOf(DETAIL, '1011')).toBe(true)
    expect(isAgentDetailOf(DETAIL, 1021)).toBe(false)
    expect(isAgentDetailOf(HOME, 1011)).toBe(false)
  })

  it('共享元素名是单一来源（组件、CSS 与测试读同一份常量）', () => {
    expect(VT_SHARED_NAME).toBe('deck-frame')
    expect(typeof VT_SUPPORTED).toBe('boolean')
  })

  it('端点标记取值：prop 名与两端取值都收在这里（两端取值必须不同才认得出「新状态那端」）', () => {
    expect(VT_SHARED_ATTR).toBe('data-vt-shared')
    // 组件侧写死同样两个字面量（模板里无法引常量做属性名）：改这里就要同步
    // FeaturedDeck 的 VT_ITEM_MARK（'deck'）与 AgentHead 的 data-vt-shared="hero"
    const ends: VtEnd[] = ['deck', 'hero']
    expect(new Set(ends).size).toBe(2)
  })
})

describe('共享元素过渡的落地等待', () => {
  it('waitUntil：条件已成立时立即返回', async () => {
    const t0 = Date.now()
    await waitUntil(() => true, 500)
    expect(Date.now() - t0).toBeLessThan(50)
  })

  it('waitUntil：条件稍后成立即返回，不等满上限', async () => {
    let flag = false
    setTimeout(() => {
      flag = true
    }, 30)
    const t0 = Date.now()
    await waitUntil(() => flag, 1000)
    const elapsed = Date.now() - t0
    expect(elapsed).toBeGreaterThanOrEqual(25)
    expect(elapsed).toBeLessThan(400) // 远小于上限：是「等到了」而不是「等超时」
  })

  it('waitUntil：条件永不成立时按上限放行（过渡不能被挂死）', async () => {
    const t0 = Date.now()
    await waitUntil(() => false, 60)
    const elapsed = Date.now() - t0
    expect(elapsed).toBeGreaterThanOrEqual(55)
    expect(elapsed).toBeLessThan(600)
  })

  it('非 DOM 环境（本测试跑 node）等共享元素的画：直接放行而不是抛错', async () => {
    await expect(awaitSharedEndImage('hero', 50)).resolves.toBeUndefined()
    await expect(awaitSharedEndImage('deck', 50)).resolves.toBeUndefined()
  })

  it('非 DOM 环境等端点登上舞台：直接放行', async () => {
    await expect(waitSharedEndMounted('hero', 50)).resolves.toBeUndefined()
  })
})

describe('起飞登记：回程落回同一张卡', () => {
  it('登记 → 取走一次 → 再取为空（消费语义，不会跨次复用）', () => {
    rememberDeckCard(1011)
    expect(consumeDeckCard()).toBe(1011)
    expect(consumeDeckCard()).toBeNull()
  })

  it('非法 id（路由参数缺失）登记成空，回程落回第 1 张', () => {
    rememberDeckCard(Number(undefined))
    expect(consumeDeckCard()).toBeNull()
  })
})
