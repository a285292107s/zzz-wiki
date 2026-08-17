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
    expect(w.findAll('img.chip-ic').length).toBeGreaterThanOrEqual(12)
  })

  it('attribute chips use Icon{English} urls (no color swatch)', () => {
    const w = mount(FilterChips, { props: { attr: 'all', prof: 'all' } })
    const fire = w.findAll('img.chip-ic').find(i => (i.attributes('alt') || '') === '火')!
    expect(fire.attributes('src')).toBe(elementIconUrl(201))
    // 不再渲染色块
    expect(w.find('.swatch').exists()).toBe(false)
  })

  it('stream element (300) uses SVG placeholder, not img', () => {
    const w = mount(FilterChips, { props: { attr: 'all', prof: 'all' } })
    // 流明：应无 img（elementIconUrl(300) is null），有 SVG 占位
    const lumifluxImg = w.findAll('img.chip-ic').find(i => (i.attributes('alt') || '') === '流明')
    expect(lumifluxImg).toBeUndefined()
    // 流明按钮含 SVG 占位
    const lumifluxChip = w.findAll('.chip').find(b => b.text().includes('流明'))!
    expect(lumifluxChip.find('svg.chip-fallback').exists()).toBe(true)
  })

  it('profession chips use Icon{English} urls', () => {
    const w = mount(FilterChips, { props: { attr: 'all', prof: 'all' } })
    const sup = w.findAll('img.chip-ic').find(i => (i.attributes('alt') || '') === '支援')!
    expect(sup.attributes('src')).toBe(professionIconUrl(4))
  })

  it('armorer profession (7) uses SVG placeholder', () => {
    const w = mount(FilterChips, { props: { attr: 'all', prof: 'all' } })
    const armorerChip = w.findAll('.chip').find(b => b.text().includes('锋御'))!
    expect(armorerChip.find('svg.chip-fallback').exists()).toBe(true)
    expect(armorerChip.find('img').exists()).toBe(false)
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
