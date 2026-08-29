// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { CharacterDetail } from '../src/data/types'

const HERO_FORM_KEY = 'zzz-wiki:hero-form'

/** 双形态角色样本：1551 佩洛伊斯在 hero-gender-variants.json 登记 Female/Male 两版 */
const dualDetail = {
  id: 1551,
  name: '佩洛伊斯',
  code_name: 'TEST',
  rarity: 5,
} as unknown as CharacterDetail

/** 非双形态角色样本：1011 无性别变体登记（应按裸名 Mindscape_{id}_2 规则） */
const singleDetail = {
  id: 1011,
  name: '测试代理人',
  code_name: 'TEST',
  rarity: 4,
} as unknown as CharacterDetail

/** heroForm 为模块级响应式状态（localStorage 持久化）：每个用例重置模块实例并清空存储，避免跨用例污染 */
async function freshAgentHead() {
  vi.resetModules()
  return (await import('../src/components/detail/AgentHead.vue')).default
}

function heroImg(w: ReturnType<typeof mount>) {
  return w.find('.hero-bg img')
}

/** 组件含 RouterLink（专属音擎卡片）：此用例不传 signatureEngine，但需 stub 避免未解析告警 */
const mountOptions = {
  global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
}

describe('AgentHead 双形态切换钮（首页 hero 头图已移除，切换钮移至详情页）', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('双形态角色（1551 佩洛伊斯）显示形态切换钮，点击后切换 hero 头图并持久化', async () => {
    const AgentHead = await freshAgentHead()
    const w = mount(AgentHead, { props: { detail: dualDetail }, ...mountOptions })
    // 默认女性形态
    expect(w.find('.form-toggle').exists()).toBe(true)
    expect(heroImg(w).attributes('src')).toBe('/data/img/hero/Mindscape_1551_Female_2.webp')

    await w.find('.form-toggle').trigger('click')
    expect(heroImg(w).attributes('src')).toBe('/data/img/hero/Mindscape_1551_Male_2.webp')
    expect(localStorage.getItem(HERO_FORM_KEY)).toBe('male')
  })

  it('非双形态角色不显示形态切换钮', async () => {
    const AgentHead = await freshAgentHead()
    const w = mount(AgentHead, { props: { detail: singleDetail }, ...mountOptions })
    expect(w.find('.form-toggle').exists()).toBe(false)
  })
})
