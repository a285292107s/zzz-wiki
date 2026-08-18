// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CatalogTable, { type CatalogColumn } from '../src/components/list/CatalogTable.vue'

const columns: CatalogColumn[] = [
  { key: 'name', label: '名称', sortable: true },
  { key: 'code', label: '代号' },
  { key: 'rarity', label: '稀有度', align: 'right', sortable: true },
]

const rows = [
  { Id: 1, name: 'A', code: 'a', rarity: 4 },
  { Id: 2, name: 'B', code: 'b', rarity: 3 },
]

describe('CatalogTable', () => {
  it('renders sortable headers as buttons, others as text', () => {
    const w = mount(CatalogTable, { props: { columns, items: rows } })
    const ths = w.findAll('th')
    expect(ths.length).toBe(3)
    expect(ths[0].find('button.sort-btn').exists()).toBe(true)
    expect(ths[1].find('button.sort-btn').exists()).toBe(false)
    expect(ths[2].find('button.sort-btn').exists()).toBe(true)
  })

  it('emits update:sort with the column key on header click', async () => {
    const w = mount(CatalogTable, { props: { columns, items: rows } })
    await w.findAll('button.sort-btn')[0].trigger('click')
    expect(w.emitted('update:sort')![0]).toEqual(['name'])
  })

  it('shows direction arrow and aria-sort for the active column', () => {
    const w = mount(CatalogTable, {
      props: { columns, items: rows, sort: 'rarity', sortDir: 'desc' },
    })
    const rbtn = w.findAll('button.sort-btn')[1]
    expect(rbtn.classes()).toContain('active')
    expect(rbtn.attributes('aria-sort')).toBe('descending')
    expect(rbtn.text()).toContain('▼')
  })
})
