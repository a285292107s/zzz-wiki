// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

// dataVersion 为模块级响应式状态 + localStorage 持久化：重置模块实例并清空存储，避免跨用例污染
let VERSION_QUERY_KEY = 'ver'
beforeEach(async () => {
  vi.resetModules()
  localStorage.clear()
  // 随模块实例取导出常量（测试内不硬编码键名，防重构漂移）
  VERSION_QUERY_KEY = (await import('../src/composables/useVersionSync')).VERSION_QUERY_KEY
})

async function makeHarness(initial: { query?: Record<string, string>; hash?: string } = {}) {
  const { dataVersion, setDataVersion } = await import('../src/data/api')
  const { useVersionSync } = await import('../src/composables/useVersionSync')

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/agents', component: { template: '<div/>' } },
    ],
  })
  await router.push({ path: '/', query: initial.query ?? {}, hash: initial.hash ?? '' })
  await router.isReady()

  const Host = defineComponent({
    setup() {
      useVersionSync()
      return () => h('div')
    },
  })
  const wrap = mount(Host, { global: { plugins: [router] } })
  await flushPromises()
  return { wrap, router, dataVersion, setDataVersion }
}

/** 等 fire-and-forget 的 router.replace 落地（同 catalog-list harness） */
async function settle() {
  await flushPromises()
  await new Promise((r) => setTimeout(r, 0))
}

describe('useVersionSync · URL query 双向同步', () => {
  it('初始 ?ver=latest 直达：状态采纳 URL 且不被覆盖', async () => {
    const hh = await makeHarness({ query: { [VERSION_QUERY_KEY]: 'latest' } })
    await settle()
    expect(hh.dataVersion.value).toBe('latest')
    expect(hh.router.currentRoute.value.query[VERSION_QUERY_KEY]).toBe('latest')
    hh.wrap.unmount()
  })

  it('无参地址：URL 规范化为当前版本（复制即分享）', async () => {
    const hh = await makeHarness()
    await settle()
    expect(hh.dataVersion.value).toBe('live')
    expect(hh.router.currentRoute.value.query[VERSION_QUERY_KEY]).toBe('live')
    hh.wrap.unmount()
  })

  it('localStorage 偏好 + 无参 URL：规范化为持久化档位', async () => {
    // 本用例需按预置存储重新加载 api 模块（其余用例由 beforeEach 加载，值为默认 live）
    vi.resetModules()
    localStorage.setItem('zzz-wiki:data-version', 'latest')
    const hh = await makeHarness()
    await settle()
    expect(hh.dataVersion.value).toBe('latest')
    expect(hh.router.currentRoute.value.query[VERSION_QUERY_KEY]).toBe('latest')
    hh.wrap.unmount()
  })

  it('切换版本写回 URL 并保留 hash 锚点', async () => {
    const hh = await makeHarness({ query: { [VERSION_QUERY_KEY]: 'live' }, hash: '#kit' })
    await settle()
    hh.setDataVersion('latest')
    await settle()
    expect(hh.dataVersion.value).toBe('latest')
    const r = hh.router.currentRoute.value
    expect(r.query[VERSION_QUERY_KEY]).toBe('latest')
    expect(r.hash).toBe('#kit')
    hh.wrap.unmount()
  })

  it('站内导航（丢弃 query）后补回版本参数', async () => {
    const hh = await makeHarness({ query: { [VERSION_QUERY_KEY]: 'latest' } })
    await settle()
    await hh.router.push('/agents')
    await settle()
    expect(hh.router.currentRoute.value.path).toBe('/agents')
    expect(hh.router.currentRoute.value.query[VERSION_QUERY_KEY]).toBe('latest')
    hh.wrap.unmount()
  })

  it('手动移除版本参数后被补回（URL 强同步语义）', async () => {
    const hh = await makeHarness({ query: { [VERSION_QUERY_KEY]: 'latest' } })
    await settle()
    await hh.router.replace({ query: { foo: 'bar' } }) // 模拟编辑地址栏删掉 ver
    await settle()
    expect(hh.router.currentRoute.value.query[VERSION_QUERY_KEY]).toBe('latest')
    expect(hh.router.currentRoute.value.query.foo).toBe('bar')
    hh.wrap.unmount()
  })

  it('非法档位忽略并规范为当前版本', async () => {
    const hh = await makeHarness({ query: { [VERSION_QUERY_KEY]: 'beta' } })
    await settle()
    expect(hh.dataVersion.value).toBe('live')
    expect(hh.router.currentRoute.value.query[VERSION_QUERY_KEY]).toBe('live')
    hh.wrap.unmount()
  })

  it('URL 手动变更（前进/后退语义）：状态跟随', async () => {
    const hh = await makeHarness()
    await settle()
    await hh.router.replace({ query: { [VERSION_QUERY_KEY]: 'latest' } })
    await settle()
    expect(hh.dataVersion.value).toBe('latest')
    hh.wrap.unmount()
  })

  it('URL 已携带同档版本时不再重复 replace（幂等）', async () => {
    const hh = await makeHarness({ query: { [VERSION_QUERY_KEY]: 'latest' } })
    await settle()
    const replaceSpy = vi.spyOn(hh.router, 'replace')
    await hh.router.replace({ query: { [VERSION_QUERY_KEY]: 'latest', attr: '202' } })
    await settle()
    // 应只有外部触发的那一次写回；useVersionSync 不得追加补写
    expect(replaceSpy).toHaveBeenCalledTimes(1)
    replaceSpy.mockRestore()
    hh.wrap.unmount()
  })
})