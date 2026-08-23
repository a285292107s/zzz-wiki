// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useCatalogList } from '../src/composables/useCatalogList'

interface Item {
  Id: number
  element?: number
  type?: number
  camp?: number
  zh?: string
  en?: string
  camp_name?: string
}

const ITEMS: Item[] = [
  { Id: 1, element: 201, type: 1, camp: 1, zh: '朱鸢', camp_name: '刑侦特勤组' },
  { Id: 2, element: 202, type: 2, camp: 2, zh: '苍角', camp_name: '狡兔屋' },
  { Id: 3, element: 201, type: 3, camp: 3, zh: '星见雅', camp_name: '虚狩' },
]

const OPTS = {
  items: () => ITEMS,
  withAttrs: true,
  withProfs: true,
  withCamps: true,
  keywords: (row: Item) => [row.camp_name ?? ''],
}

describe('useCatalogList · 过滤逻辑', () => {
  it('筛属性 + 职业 + 查询词 + 关键词', () => {
    const host = defineComponent({
      setup() {
        const r = useCatalogList<Item>(OPTS)
        return () => h('div', { id: 'out' }, [JSON.stringify(r.filtered.value)])
      },
    })
    const w = mount(host)
    expect(JSON.parse(w.find('#out').text())).toHaveLength(3)
    w.unmount()
  })

  it('keywords 命中（搜索阵营名）', () => {
    const r = useCatalogListNoRouter()
    r.query.value = '狡兔'
    expect(r.filtered.value.map((x) => x.Id)).toEqual([2])
  })

  it('query 与 attr 组合过滤', () => {
    const r = useCatalogListNoRouter()
    r.attrFilter.value = 201
    r.query.value = '星见'
    expect(r.filtered.value.map((x) => x.Id)).toEqual([3])
  })

  it('camp 筛选', () => {
    const r = useCatalogListNoRouter()
    r.campFilter.value = 1
    expect(r.filtered.value.map((x) => x.Id)).toEqual([1])
  })

  it('camp 与 attr 组合过滤', () => {
    const r = useCatalogListNoRouter()
    r.campFilter.value = 1
    r.attrFilter.value = 201
    expect(r.filtered.value.map((x) => x.Id)).toEqual([1])
  })

  it('camp 重置回 all 后返回全部', () => {
    const r = useCatalogListNoRouter()
    r.campFilter.value = 2
    expect(r.filtered.value.map((x) => x.Id)).toEqual([2])
    r.campFilter.value = 'all'
    expect(r.filtered.value).toHaveLength(3)
  })
})

describe('useCatalogList · URL query 双向同步', () => {
  async function makeHarness(initialQuery: Record<string, string>) {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div/>' } }],
    })
    await router.push({ path: '/', query: initialQuery })
    await router.isReady()

    let api: ReturnType<typeof useCatalogList<Item>> | null = null
    const Host = defineComponent({
      setup() {
        api = useCatalogList<Item>({ ...OPTS, syncRoute: true })
        return () => h('div')
      },
    })
    const wrap = mount(Host, { global: { plugins: [router] } })
    return { api: () => api!, router, wrap }
  }

  it('从初始 query 恢复筛选', async () => {
    const hh = await makeHarness({ attr: '201' })
    await flushPromises()
    expect(hh.api()!.attrFilter.value).toBe(201)
    expect(hh.api()!.filtered.value.map((x) => x.Id)).toEqual([1, 3])
    hh.wrap.unmount()
  })

  it('筛选变化写回 URL query（replace）', async () => {
    const hh = await makeHarness({})
    await flushPromises()
    hh.api()!.attrFilter.value = 202
    await flushPromises()
    await hh.router.isReady()
    await new Promise((r) => setTimeout(r, 0)) // 让 fire-and-forget replace 落地
    expect(hh.router.currentRoute.value.query.attr).toBe('202')
    expect(hh.api()!.filtered.value.map((x) => x.Id)).toEqual([2])
    hh.wrap.unmount()
  })

  it('从初始 query 恢复 camp', async () => {
    const hh = await makeHarness({ camp: '2' })
    await flushPromises()
    expect(hh.api()!.campFilter.value).toBe(2)
    expect(hh.api()!.filtered.value.map((x) => x.Id)).toEqual([2])
    hh.wrap.unmount()
  })

  it('camp 变化写回 URL query', async () => {
    const hh = await makeHarness({})
    await flushPromises()
    hh.api()!.campFilter.value = 1
    await flushPromises()
    await hh.router.isReady()
    await new Promise((r) => setTimeout(r, 0))
    expect(hh.router.currentRoute.value.query.camp).toBe('1')
    expect(hh.api()!.filtered.value.map((x) => x.Id)).toEqual([1])
    hh.wrap.unmount()
  })

  it('写回保留无关 query 参数（如全局 ?ver=）', async () => {
    const hh = await makeHarness({ attr: '201', ver: 'latest' })
    await flushPromises()
    hh.api()!.attrFilter.value = 202
    await flushPromises()
    await hh.router.isReady()
    await new Promise((r) => setTimeout(r, 0))
    expect(hh.router.currentRoute.value.query.attr).toBe('202')
    expect(hh.router.currentRoute.value.query.ver).toBe('latest')
    hh.wrap.unmount()
  })

  it('清空筛选后本组旧参数从 query 清除，无关参数保留', async () => {
    const hh = await makeHarness({ attr: '201', ver: 'latest' })
    await flushPromises()
    hh.api()!.attrFilter.value = 'all'
    await flushPromises()
    await hh.router.isReady()
    await new Promise((r) => setTimeout(r, 0))
    const q = hh.router.currentRoute.value.query
    expect(q.attr).toBeUndefined()
    expect(q.ver).toBe('latest')
    hh.wrap.unmount()
  })
})

/** 裸调用（不启用 syncRoute），便于测过滤/搜索逻辑 */
function useCatalogListNoRouter() {
  return useCatalogList<Item>(OPTS)
}
