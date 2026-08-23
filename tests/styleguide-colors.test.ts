// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import StyleGuideView from '../src/views/StyleGuideView.vue'

// usePageMeta 依赖 useRoute，测试环境无路由实例 → 提供最小 mock
vi.mock('vue-router', () => ({
  useRoute: () => ({ meta: {} }),
}))

/** 注入 :root 级 token（jsdom 不加载 CSS，经 inline style 提供 getComputedStyle 读取源） */
const TOKENS: Record<string, string> = {
  '--bg-0': '#0d0f11',
  '--bg-1': '#121518',
  '--bg-2': '#171b1f',
  '--bg-3': '#1d2227',
  '--line-0': '#262b30',
  '--line-1': '#2a3137',
  '--line-2': '#3d454c',
  '--ink-0': '#e8e4da',
  '--ink-1': '#a9a49a',
  '--ink-2': '#848076',
  '--ink-3': '#514d47',
  '--amber': '#d8a35c',
  '--amber-hi': '#eec28a',
  '--amber-dim': 'rgba(216, 163, 92, 0.14)',
  '--danger': '#c96155',
  '--ok': '#7ba05b',
  '--focus': 'var(--amber)',
  '--rank-s': '#f5d67b',
  '--rank-a': '#b98ad4',
  '--rank-b': '#7dae7a',
}

let swatchCrs: string[]

beforeAll(async () => {
  for (const [k, v] of Object.entries(TOKENS)) {
    document.documentElement.style.setProperty(k, v)
  }
  // mount + 显式 stub：ListPage 系纯模板容器（无 name 可配，真实渲染无副作用）；
  // 其余子组件按实际行为无关处理，仅穿透色彩区 DetailSection 的 slot
  const w = mount(StyleGuideView, {
    global: {
      stubs: {
        DetailSection: { template: '<div><slot /></div>' },
        RouterLink: { template: '<a><slot /></a>' },
        CatalogTable: { template: '<div />' },
        FilterDropdown: { template: '<div />' },
        SearchField: { template: '<div />' },
        DescRow: { template: '<div />' },
        KeyValueGrid: { template: '<div />' },
        HollowImage: { template: '<div />' },
        Rarity: { template: '<div />' },
        Tags: { template: '<div />' },
      },
    },
  })
  swatchCrs = w.findAll('.swatch .cr').map((s) => s.text())
})

describe('StyleGuideView · 色彩对比度标尺', () => {
  it('每枚 swatch 都带对比度徽标（面 4 + 线 3 + 墨 4 + 强调 5 + 语义 4 = 20 枚）', () => {
    expect(swatchCrs).toHaveLength(20)
  })

  it('正文级前景达标：ink-0 AAA、ink-1 / ink-2 / danger AA', () => {
    expect(swatchCrs).toContain('15.13 · AAA')
    expect(swatchCrs).toContain('7.74 · AAA')
    expect(swatchCrs).toContain('4.87 · AA')
    expect(swatchCrs).toContain('4.87 · AA') // danger
  })

  it('装饰性最弱层如实标注 LOW（ink-3 不承载信息）', () => {
    expect(swatchCrs).toContain('2.29 · LOW')
  })

  it('非 hex 展示不判级：amber-dim（rgba）与 focus（var 引用）为 —', () => {
    const dashes = swatchCrs.filter((t) => t === '—')
    expect(dashes).toHaveLength(2)
  })
})