// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

// heroForm 为模块级响应式状态 + localStorage 持久化：重置模块实例并清空存储，避免跨用例污染
const HERO_FORM_KEY = 'zzz-wiki:hero-form'

async function freshUseHeroForm() {
  vi.resetModules()
  return await import('../src/composables/useHeroForm')
}

describe('useHeroForm', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('无存储时默认女性形态', async () => {
    const { heroForm } = await freshUseHeroForm()
    expect(heroForm.value).toBe('female')
  })

  it('读取已持久化的形态', async () => {
    localStorage.setItem(HERO_FORM_KEY, 'male')
    const { heroForm } = await freshUseHeroForm()
    expect(heroForm.value).toBe('male')
  })

  it('非法存储值回退默认女性', async () => {
    localStorage.setItem(HERO_FORM_KEY, 'enby')
    const { heroForm } = await freshUseHeroForm()
    expect(heroForm.value).toBe('female')
  })

  it('toggle 翻转形态并写入 localStorage', async () => {
    const { heroForm, useHeroForm } = await freshUseHeroForm()
    const { toggleHeroForm } = useHeroForm()
    toggleHeroForm()
    expect(heroForm.value).toBe('male')
    expect(localStorage.getItem(HERO_FORM_KEY)).toBe('male')
    toggleHeroForm()
    expect(heroForm.value).toBe('female')
    expect(localStorage.getItem(HERO_FORM_KEY)).toBe('female')
  })
})
