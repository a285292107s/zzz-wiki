// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { CharacterDetail } from '../src/data/types'

const HERO_FORM_KEY = 'zzz-wiki:hero-form'
const LANG_KEY = 'zzz-wiki:lang'

// usePageMeta 依赖 useRoute，测试环境无路由实例 → 提供最小 mock（同 styleguide-colors）
vi.mock('vue-router', () => ({
  useRoute: () => ({ meta: { title: '设置' } }),
  RouterLink: { template: '<a><slot /></a>' },
}))

/** 双形态角色样本：1551 佩洛伊斯在 hero-gender-variants.json 登记 Female/Male 两版 */
const dualDetail = {
  id: 1551,
  name: '佩洛伊斯',
  code_name: 'TEST',
  rarity: 5,
} as unknown as CharacterDetail

/** 形态偏好是模块级响应式状态（localStorage 持久化）：每个用例重置模块实例，避免跨用例污染 */
async function freshAgentHead() {
  vi.resetModules()
  return (await import('../src/components/detail/AgentHead.vue')).default
}

async function freshSettings() {
  vi.resetModules()
  return (await import('../src/views/SettingsView.vue')).default
}

/**
 * v-reveal 是 main.ts 注册的全局指令（测试无 app 实例）：补一个空指令，
 * 否则每个用例都刷一行 "Failed to resolve directive: reveal"。
 */
const mountOptions = { global: { directives: { reveal: () => {} } } }

/** 固定为「宽屏 + retina」，使 hero 走原图路径（jsdom 默认 matchMedia 恒 false） */
function stubMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query.includes('min-resolution'),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

describe('佩洛伊斯立绘形态：偏好入口在设置页', () => {
  beforeEach(() => {
    localStorage.clear()
    stubMatchMedia()
  })

  it('详情页不再有形态切换钮，只按存储的形态取图', async () => {
    localStorage.setItem(HERO_FORM_KEY, 'male')
    const AgentHead = await freshAgentHead()
    const w = mount(AgentHead, { props: { detail: dualDetail }, ...mountOptions })

    expect(w.find('.form-toggle').exists()).toBe(false)
    expect(w.find('.hero-bg img').attributes('src')).toBe(
      '/data/img/hero/Mindscape_1551_Male_2.webp',
    )
  })

  it('无存储时详情页取默认（女性）形态', async () => {
    const AgentHead = await freshAgentHead()
    const w = mount(AgentHead, { props: { detail: dualDetail }, ...mountOptions })

    expect(w.find('.hero-bg img').attributes('src')).toBe(
      '/data/img/hero/Mindscape_1551_Female_2.webp',
    )
  })
})

describe('设置页偏好选项板', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('默认选中女形态，且尚未写盘（未改动的偏好不产生存储）', async () => {
    const SettingsView = await freshSettings()
    const w = mount(SettingsView, mountOptions)

    // 第二块板是展示语言：默认「中文」（界面外壳中文，游戏内容取官方中文文本）
    const on = w.findAll('.plate.on .plate-label').map((el) => el.text())
    expect(on).toEqual(['女形态', '中文'])
    expect(localStorage.getItem(HERO_FORM_KEY)).toBe(null)
    expect(localStorage.getItem(LANG_KEY)).toBe(null)
  })

  it('点选男形态后写盘，选中态随之迁移', async () => {
    const SettingsView = await freshSettings()
    const w = mount(SettingsView, mountOptions)

    await w.findAll('input[name="hero-form"]')[1].setValue()

    expect(localStorage.getItem(HERO_FORM_KEY)).toBe('male')
    expect(w.findAll('.plate.on .plate-label').map((el) => el.text())).toEqual(['男形态', '中文'])
  })

  it('已存储的偏好决定进页时的选中行', async () => {
    localStorage.setItem(HERO_FORM_KEY, 'male')
    const SettingsView = await freshSettings()
    const w = mount(SettingsView, mountOptions)

    expect(w.findAll('.plate.on .plate-label').map((el) => el.text())).toEqual(['男形态', '中文'])
  })

  it('展示语言：点选即写盘，且已存语言决定进页时的选中行与 <html lang>', async () => {
    localStorage.setItem(LANG_KEY, 'ja')
    const SettingsView = await freshSettings()
    const w = mount(SettingsView, mountOptions)

    // 界面文案（含本页自己）随展示语言切换：语言存的是 ja，故选项组的选中标签是日文
    expect(w.findAll('.plate.on .plate-label').map((el) => el.text())).toEqual([
      '女性形態',
      '日本語',
    ])

    // 选韩文：偏好落盘（自称按钮的 value 即语言码）
    await w.findAll('input[name="display-lang"]')[3].setValue()
    expect(localStorage.getItem(LANG_KEY)).toBe('ko')
    expect(w.findAll('.plate.on .plate-label').map((el) => el.text())).toContain('한국어')
  })
})
