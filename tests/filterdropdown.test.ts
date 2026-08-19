// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FilterDropdown from '../src/components/list/FilterDropdown.vue'

const CAMP_OPTIONS = [
  { code: 1, name: '狡兔屋' },
  { code: 15, name: '法厄同' }, // 无素材图 → SVG 占位
]

describe('FilterDropdown', () => {
  it('renders trigger buttons with all-labels; popover stays closed', () => {
    const w = mount(FilterDropdown, { props: { attr: 'all', prof: 'all' } })
    expect(w.text()).toContain('全部属性')
    expect(w.text()).toContain('全部职业')
    expect(w.find('.popover').exists()).toBe(false)
  })

  it('clicking trigger opens its popover with options', async () => {
    const w = mount(FilterDropdown, { props: { attr: 'all', prof: 'all' } })
    await w.findAll('.trigger')[0].trigger('click')
    const popover = w.find('.popover')
    expect(popover.exists()).toBe(true)
    expect(popover.text()).toContain('物理')
    expect(popover.attributes('aria-label')).toBe('属性')
  })

  it('selecting an option emits update:attr and closes', async () => {
    const w = mount(FilterDropdown, { props: { attr: 'all', prof: 'all' } })
    await w.findAll('.trigger')[0].trigger('click')
    const fire = w.findAll('.opt').find((o) => o.text().includes('火'))!
    await fire.trigger('click')
    expect(w.emitted('update:attr')![0]).toEqual([201])
    expect(w.find('.popover').exists()).toBe(false)
  })

  it('trigger reflects selected value; option marked aria-selected', async () => {
    const w = mount(FilterDropdown, { props: { attr: 201, prof: 'all' } })
    expect(w.text()).toContain('火')
    expect(w.find('.trigger.active').exists()).toBe(true)
    await w.findAll('.trigger')[0].trigger('click')
    const fire = w.findAll('.opt').find((o) => o.text().includes('火'))!
    expect(fire.attributes('aria-selected')).toBe('true')
    expect(fire.classes()).toContain('selected')
  })

  it('selecting 全部 emits all', async () => {
    const w = mount(FilterDropdown, { props: { attr: 201, prof: 'all' } })
    await w.findAll('.trigger')[0].trigger('click')
    const all = w.findAll('.opt').find((o) => o.text().includes('全部属性'))!
    await all.trigger('click')
    expect(w.emitted('update:attr')![0]).toEqual(['all'])
  })

  it('renders camp dropdown with options and emits update:camp', async () => {
    const w = mount(FilterDropdown, { props: { attr: 'all', prof: 'all', camps: CAMP_OPTIONS } })
    expect(w.text()).toContain('全部阵营')
    await w.findAll('.trigger').find((t) => t.text().includes('阵营'))!.trigger('click')
    expect(w.find('.popover').text()).toContain('狡兔屋')
    const chip = w.findAll('.opt').find((o) => o.text().includes('狡兔屋'))!
    await chip.trigger('click')
    expect(w.emitted('update:camp')![0]).toEqual([1])
  })

  it('camp option without asset falls back to SVG placeholder', async () => {
    const w = mount(FilterDropdown, { props: { attr: 'all', prof: 'all', camps: CAMP_OPTIONS } })
    await w.findAll('.trigger').find((t) => t.text().includes('阵营'))!.trigger('click')
    const phaethon = w.findAll('.opt').find((o) => o.text().includes('法厄同'))!
    expect(phaethon.find('svg.opt-fallback').exists()).toBe(true)
    expect(phaethon.find('img').exists()).toBe(false)
  })

  it('armorer profession (7) uses SVG placeholder in options', async () => {
    const w = mount(FilterDropdown, { props: { attr: 'all', prof: 'all' } })
    await w.findAll('.trigger')[1].trigger('click')
    const armorer = w.findAll('.opt').find((o) => o.text().includes('锋御'))!
    expect(armorer.find('svg.opt-fallback').exists()).toBe(true)
    expect(armorer.find('img').exists()).toBe(false)
  })

  it('hides camp dropdown when camps not provided; showAttr=false hides attribute', () => {
    const w = mount(FilterDropdown, { props: { attr: 'all', prof: 'all' } })
    expect(w.text()).not.toContain('全部阵营')
    const w2 = mount(FilterDropdown, { props: { attr: 'all', prof: 'all', showAttr: false } })
    expect(w2.text()).not.toContain('全部属性')
    expect(w2.text()).toContain('全部职业')
  })
})