// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DescRow from '../src/components/detail/DescRow.vue'

describe('DescRow', () => {
  it('renders text2 lore note under the description when provided', () => {
    const w = mount(DescRow, {
      props: { no: '01', title: '凛冬前兆', text: '机制描述', text2: '寒风是凛冬的前兆。' },
    })
    const note = w.find('.note')
    expect(note.exists()).toBe(true)
    expect(note.text()).toContain('寒风是凛冬的前兆。')
    expect(note.find('.note-rule').exists()).toBe(true)
  })

  it('skips the note element when text2 is absent', () => {
    const w = mount(DescRow, { props: { no: '01', title: '影画一', text: '机制描述' } })
    expect(w.find('.note').exists()).toBe(false)
  })

  it('keeps html/text mutually exclusive; note still renders with html', () => {
    const w = mount(DescRow, {
      props: { no: '01', title: '普攻', html: '<b>倍率</b>', text2: '札记' },
    })
    expect(w.find('.desc').html()).toContain('<b>倍率</b>')
    expect(w.find('.note').exists()).toBe(true)
  })
})