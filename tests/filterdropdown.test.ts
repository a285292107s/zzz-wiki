// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FilterDropdown from '../src/components/list/FilterDropdown.vue'
import { elementIconUrl, professionIconUrl, campIconUrl } from '../src/domain/filterIcons'

const CAMP_OPTIONS = [
  { code: 1, name: '狡兔屋' },
  { code: 2, name: '维多利亚家政' },
  { code: 15, name: '法厄同' }, // 无素材图 → SVG 占位
]

describe('FilterDropdown', () => {
  it('renders trigger buttons with all-labels', () => {
    const w = mount(FilterDropdown, { props: { attr: 'all', prof: 'all' } })
    expect(w.text()).toContain('全部属性')
    expect(w.text()).toContain('全部职业')
    // 下拉面板默认收起
    expect(w.find('.popover').exists()).toBe(false)
  })

  it('clicking trigger opens its popover with options', async () => {
    const w = mount(FilterDropdown, { props: { attr: 'all', prof: 'all' } })
    const triggers = w.findAll('.trigger')
    await triggers[0].trigger('click')
    const popover = w.find('.popover')
    expect(popover.exists()).toBe(true)
    expect(popover.text()).toContain('物理')
    expect(popover.text()).toContain('以太')
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

  it('trigger reflects selected value with label', () => {
    const w = mount(FilterDropdown, { props: { attr: 201, prof: 'all' } })
    expect(w.text()).toContain('火')
    expect(w.find('.trigger.active').exists()).toBe(true)
  })

  it('attribute options use Icon{English} urls (no color swatch)', async () => {
    const w = mount(FilterDropdown, { props: { attr: 'all', prof: 'all' } })
    await w.findAll('.trigger')[0].trigger('click')
    const fire = w.findAll('.opt').find((o) => o.text().includes('火'))!
    expect(fire.find('img.opt-ic').attributes('src')).toBe(elementIconUrl(201))
  })

  it('stream element (300) uses real icon since IconLumen landed', async () => {
    const w = mount(FilterDropdown, { props: { attr: 'all', prof: 'all' } })
    await w.findAll('.trigger')[0].trigger('click')
    const lumiflux = w.findAll('.opt').find((o) => o.text().includes('流明'))!
    expect(lumiflux.find('img.opt-ic').attributes('src')).toBe(elementIconUrl(300))
    expect(lumiflux.find('svg.opt-fallback').exists()).toBe(false)
  })

  it('profession options use Icon{English} urls', async () => {
    const w = mount(FilterDropdown, { props: { attr: 'all', prof: 'all' } })
    await w.findAll('.trigger')[1].trigger('click')
    const sup = w.findAll('.opt').find((o) => o.text().includes('支援'))!
    expect(sup.find('img.opt-ic').attributes('src')).toBe(professionIconUrl(4))
  })

  it('armorer profession (7) uses SVG placeholder in options', async () => {
    const w = mount(FilterDropdown, { props: { attr: 'all', prof: 'all' } })
    await w.findAll('.trigger')[1].trigger('click')
    const armorer = w.findAll('.opt').find((o) => o.text().includes('锋御'))!
    expect(armorer.find('svg.opt-fallback').exists()).toBe(true)
    expect(armorer.find('img').exists()).toBe(false)
  })

  it('selected option is marked aria-selected', async () => {
    const w = mount(FilterDropdown, { props: { attr: 201, prof: 'all' } })
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

  it('renders camp dropdown when camps provided', async () => {
    const w = mount(FilterDropdown, { props: { attr: 'all', prof: 'all', camps: CAMP_OPTIONS } })
    expect(w.text()).toContain('全部阵营')
    await w.findAll('.trigger').find((t) => t.text().includes('阵营'))!.trigger('click')
    expect(w.find('.popover').text()).toContain('狡兔屋')
    expect(w.find('.popover').text()).toContain('维多利亚家政')
  })

  it('emits update:camp when camp option selected', async () => {
    const w = mount(FilterDropdown, { props: { attr: 'all', prof: 'all', camps: CAMP_OPTIONS } })
    await w.findAll('.trigger').find((t) => t.text().includes('阵营'))!.trigger('click')
    const chip = w.findAll('.opt').find((o) => o.text().includes('狡兔屋'))!
    await chip.trigger('click')
    expect(w.emitted('update:camp')![0]).toEqual([1])
  })

  it('camp options use IconCamp urls; missing asset falls back to SVG', async () => {
    const w = mount(FilterDropdown, { props: { attr: 'all', prof: 'all', camps: CAMP_OPTIONS } })
    await w.findAll('.trigger').find((t) => t.text().includes('阵营'))!.trigger('click')
    const rabbit = w.findAll('.opt').find((o) => o.text().includes('狡兔屋'))!
    expect(rabbit.find('img.opt-ic').attributes('src')).toBe(campIconUrl(1))
    const phaethon = w.findAll('.opt').find((o) => o.text().includes('法厄同'))!
    // 无素材图 → 16px SVG 圆环占位（与其他选项图标同尺寸）
    expect(phaethon.find('svg.opt-fallback').exists()).toBe(true)
    expect(phaethon.find('img').exists()).toBe(false)
  })

  it('hides camp dropdown when camps not provided', () => {
    const w = mount(FilterDropdown, { props: { attr: 'all', prof: 'all' } })
    expect(w.text()).not.toContain('全部阵营')
  })

  it('hides attribute dropdown when showAttr=false', () => {
    const w = mount(FilterDropdown, { props: { attr: 'all', prof: 'all', showAttr: false } })
    expect(w.text()).not.toContain('全部属性')
    expect(w.text()).toContain('全部职业')
  })

  it('clicking outside closes an open dropdown', async () => {
    const w = mount(FilterDropdown, { props: { attr: 'all', prof: 'all' } })
    await w.findAll('.trigger')[0].trigger('click')
    expect(w.find('.popover').exists()).toBe(true)
    await w.find('.group').trigger('mousedown') // 点击组件内部不关闭
    expect(w.find('.popover').exists()).toBe(true)
  })
})
