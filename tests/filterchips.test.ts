// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FilterChips from '../src/components/list/FilterChips.vue'

describe('FilterChips', () => {
  it('renders attribute and profession filters by default', () => {
    const w = mount(FilterChips, { props: { attr: 'all', prof: 'all' } })
    const text = w.text()
    expect(text).toContain('全部属性')
    expect(text).toContain('全部职业')
    expect(text).toContain('物理')
    expect(text).toContain('火')
    expect(text).toContain('强攻')
    expect(text).toContain('支援')
  })

  it('emits update:attr when fire chip clicked', async () => {
    const w = mount(FilterChips, { props: { attr: 'all', prof: 'all' } })
    const fire = w.findAll('.chip').find(b => b.text().includes('火'))!
    await fire.trigger('click')
    expect(w.emitted('update:attr')![0]).toEqual([201])
  })

  it('emits update:prof when support chip clicked', async () => {
    const w = mount(FilterChips, { props: { attr: 'all', prof: 'all' } })
    const support = w.findAll('.chip').find(b => b.text().includes('支援'))!
    await support.trigger('click')
    expect(w.emitted('update:prof')![0]).toEqual([4])
  })

  it('hides attribute group when showAttr=false (weapons)', () => {
    const w = mount(FilterChips, { props: { attr: 'all', prof: 'all', showAttr: false } })
    expect(w.text()).not.toContain('全部属性')
    expect(w.text()).toContain('全部职业')
  })
})
