// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import FilterDropdown from '../src/components/list/FilterDropdown.vue'

const CAMP_OPTIONS = [
  { code: 1, name: '狡兔屋' },
  { code: 15, name: '法厄同' },
]

describe('FilterDropdown', () => {
  it('renders triggers with all-labels; popovers stay closed initially', () => {
    const w = mount(FilterDropdown, { props: { attr: 'all', prof: 'all' } })
    expect(w.text()).toContain('全部属性')
    expect(w.text()).toContain('全部职业')
    expect(w.find('[role="listbox"]').exists()).toBe(false)
  })

  it('clicking a trigger opens a listbox labeled with the group', async () => {
    const w = mount(FilterDropdown, { props: { attr: 'all', prof: 'all' } })
    await w.findAll('.trigger')[0].trigger('click')
    const listbox = w.find('[role="listbox"]')
    expect(listbox.exists()).toBe(true)
    expect(listbox.text()).toContain('物理')
    expect(listbox.attributes('aria-label')).toBe('属性')
  })

  it('selecting an option emits the value and closes the listbox', async () => {
    const w = mount(FilterDropdown, { props: { attr: 'all', prof: 'all' } })
    await w.findAll('.trigger')[0].trigger('click')
    const fire = w.findAll('.opt').find((o) => o.text().includes('火'))!
    await fire.trigger('click')
    expect(w.emitted('update:attr')![0]).toEqual([201])
    expect(w.find('[role="listbox"]').exists()).toBe(false)
  })

  it('trigger reflects the selected value; chosen option marked aria-selected', async () => {
    const w = mount(FilterDropdown, { props: { attr: 201, prof: 'all' } })
    expect(w.text()).toContain('火')
    await w.findAll('.trigger')[0].trigger('click')
    const fire = w.findAll('.opt').find((o) => o.text().includes('火'))!
    expect(fire.attributes('aria-selected')).toBe('true')
  })

  it('selecting 全部 emits all', async () => {
    const w = mount(FilterDropdown, { props: { attr: 201, prof: 'all' } })
    await w.findAll('.trigger')[0].trigger('click')
    const all = w.findAll('.opt').find((o) => o.text().includes('全部属性'))!
    await all.trigger('click')
    expect(w.emitted('update:attr')![0]).toEqual(['all'])
  })

  it('camp dropdown renders from camps prop and emits update:camp', async () => {
    const w = mount(FilterDropdown, { props: { attr: 'all', prof: 'all', camps: CAMP_OPTIONS } })
    expect(w.text()).toContain('全部阵营')
    const campTrigger = w.findAll('.trigger').find((t) => t.text().includes('阵营'))!
    await campTrigger.trigger('click')
    expect(w.find('[role="listbox"]').text()).toContain('狡兔屋')
    const chip = w.findAll('.opt').find((o) => o.text().includes('狡兔屋'))!
    await chip.trigger('click')
    expect(w.emitted('update:camp')![0]).toEqual([1])
  })

  it('hides camp dropdown when camps absent; showAttr=false hides attribute', () => {
    const w = mount(FilterDropdown, { props: { attr: 'all', prof: 'all' } })
    expect(w.text()).not.toContain('全部阵营')
    const w2 = mount(FilterDropdown, { props: { attr: 'all', prof: 'all', showAttr: false } })
    expect(w2.text()).not.toContain('全部属性')
    expect(w2.text()).toContain('全部职业')
  })

  /* ---------- listbox roving tabindex（ARIA 键盘模型） ---------- */

  it('opened listbox exposes exactly one tabbable option (roving tabindex)', async () => {
    const w = mount(FilterDropdown, { props: { attr: 'all', prof: 'all' }, attachTo: document.body })
    await w.findAll('.trigger')[0].trigger('click')
    const opts = w.findAll('.opt')
    const tabbable = opts.filter((o) => o.attributes('tabindex') === '0')
    expect(tabbable).toHaveLength(1) // 仅活跃项进 Tab 序，取代逐项 8 次 Tab
    expect(tabbable[0].text()).toContain('全部属性') // 打开时活跃项复位到首项
    w.unmount()
  })

  it('ArrowDown/ArrowUp move both focus and the roving tabindex inside the listbox', async () => {
    const w = mount(FilterDropdown, { props: { attr: 'all', prof: 'all' }, attachTo: document.body })
    await w.findAll('.trigger')[0].trigger('click')
    const first = w.findAll('.opt')[0]
    ;(first.element as HTMLElement).focus()

    await first.trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    let active = w.findAll('.opt').find((o) => o.attributes('tabindex') === '0')!
    expect(active.text()).toContain('物理')
    expect(document.activeElement).toBe(active.element)

    await active.trigger('keydown', { key: 'ArrowUp' })
    await nextTick()
    active = w.findAll('.opt').find((o) => o.attributes('tabindex') === '0')!
    expect(active.text()).toContain('全部属性')
    expect(document.activeElement).toBe(active.element)
    w.unmount()
  })

  it('selecting an option returns focus to its trigger', async () => {
    const w = mount(FilterDropdown, { props: { attr: 'all', prof: 'all' }, attachTo: document.body })
    const trigger = w.findAll('.trigger')[0]
    await trigger.trigger('click')
    const fire = w.findAll('.opt').find((o) => o.text().includes('火'))!
    await fire.trigger('click')
    await nextTick()
    expect(document.activeElement).toBe(trigger.element)
    w.unmount()
  })
})