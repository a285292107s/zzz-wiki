// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { CharacterDetail } from '../src/data/types'

const HERO_FORM_KEY = 'zzz-wiki:hero-form'

vi.mock('vue-router', () => ({
  useRoute: () => ({ meta: { title: '设置' } }),
  RouterLink: { template: '<a><slot /></a>' },
}))

const dualDetail = {
  id: 1551,
  name: '佩洛伊斯',
  code_name: 'TEST',
  rarity: 5,
} as unknown as CharacterDetail

async function freshAgentHead() {
  return (await import('../src/components/detail/AgentHead.vue')).default
}

const mountOptions = { global: { directives: { reveal: () => {} } } }

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
})
