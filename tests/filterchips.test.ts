// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FilterChips from '../src/components/list/FilterChips.vue'
import { elementIconUrl, professionIconUrl } from '../src/domain/filterIcons'

describe('FilterChips', () => {
  it('renders attribute and profession filters with icons', () => {
    const w = mount(FilterChips, { props: { attr: 'all', prof: 'all' } })
    const text = w.text()
    expect(text).toContain('全部属性')
    expect(text).toContain('全部职业')
    expect(text).toContain('物理')
    expect(text).toContain('强攻')
    // 图标 img 存在
    const imgs = w.findAll('img.chip-ic')
    expect(imgs.length).toBeGreaterThanOrEqual(12)
  })

  it('attribute chips use Icon{English} urls', () => {
    const fire = mount(FilterChips, { props: { attr: 'all', prof: 'all' } })
      .findAll('img.chip-ic')
      .find(i => (i.attributes('alt') || '') === '火')!
    expect(fire.attributes('src')).toBe(elementIconUrl(201))
  })

  it('profession chips use Icon{English} urls', () => {
    const sup = mount(FilterChips, { props: { attr: 'all', prof: 'all' } })
      .findAll('img.chip-ic')
      .find(i => (i.attributes('alt') || '') === '支援')!
    expect(sup.attributes('src')).toBe(professionIconUrl(4))
  })

  it('emits update:attr when fire clicked', async () => {
    const w = mount(FilterChips, { props: { attr: 'all', prof: 'all' } })
    const fire = w.findAll('.chip').find(b => b.text().includes('火'))!
    await fire.trigger('click')
    expect(w.emitted('update:attr')![0]).toEqual([201])
  })

  it('hides attribute group when showAttr=false', () => {
    const w = mount(FilterChips, { props: { attr: 'all', prof: 'all', showAttr: false } })
    expect(w.text()).not.toContain('全部属性')
    expect(w.text()).toContain('全部职业')
  })
})
