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
  it('clicking a sortable header emits update:sort with the column key', async () => {
    const w = mount(CatalogTable, { props: { columns, items: rows } })
    await w.findAll('button')[0].trigger('click')
    expect(w.emitted('update:sort')![0]).toEqual(['name'])
  })

  it('non-sortable header is inert — clicking emits nothing', async () => {
    const w = mount(CatalogTable, { props: { columns, items: rows } })
    await w.findAll('th')[1].trigger('click') // '代号' 列不可排序
    expect(w.emitted('update:sort')).toBeUndefined()
  })

  it('active column exposes sort direction via aria-sort; others stay neutral', () => {
    const w = mount(CatalogTable, {
      props: { columns, items: rows, sort: 'rarity', sortDir: 'desc' },
    })
    const btns = w.findAll('th button')
    expect(btns[0].attributes('aria-sort')).toBeUndefined() // name 未激活
    expect(btns[1].attributes('aria-sort')).toBe('descending') // rarity 激活且降序
  })
})