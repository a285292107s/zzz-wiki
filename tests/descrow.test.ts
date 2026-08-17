// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DescRow from '../src/components/detail/DescRow.vue'
import DetailSection from '../src/components/detail/DetailSection.vue'

describe('DescRow', () => {
  it('renders title and plain text (variant talent)', () => {
    const w = mount(DescRow, {
      props: { no: '01', title: '影画一', text: '描述文本', variant: 'talent' },
    })
    expect(w.text()).toContain('01')
    expect(w.text()).toContain('影画一')
    expect(w.text()).toContain('描述文本')
    expect(w.find('p.desc').element.textContent).toBe('描述文本')
  })

  it('renders html through v-html in rich mode', () => {
    const w = mount(DescRow, {
      props: { no: '1', title: '技能', html: '<span style="color:#fff">金</span>', variant: 'skill' },
    })
    expect(w.find('p.desc').html()).toContain('<span style="color:#fff">金</span>')
    expect(w.find('h4').classes()).toContain('title-skill')
  })

  it('defaults variant to title-default styling', () => {
    const w = mount(DescRow, { props: { no: '1', title: 'x' } })
    expect(w.find('h4').classes()).toContain('title-default')
  })
})

describe('DetailSection', () => {
  it('renders no, title and slot content', () => {
    const w = mount(DetailSection, {
      props: { no: '02', title: '技能' },
      slots: { default: '<p class="inner">内容</p>' },
    })
    expect(w.find('.no').text()).toBe('02')
    expect(w.find('h2').text()).toBe('技能')
    expect(w.find('p.inner').text()).toBe('内容')
  })
})
