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

/** 桌面表头排序按钮（jsdom 无媒体查询，桌面/移动两个 tbody 同时渲染） */
const headButtons = (w: ReturnType<typeof mount>) => w.findAll('thead th button')

describe('CatalogTable', () => {
  it('clicking a sortable header emits update:sort with the column key', async () => {
    const w = mount(CatalogTable, { props: { columns, items: rows } })
    await headButtons(w)[0].trigger('click')
    expect(w.emitted('update:sort')![0]).toEqual(['name'])
  })

  it('non-sortable header is inert — clicking emits nothing', async () => {
    const w = mount(CatalogTable, { props: { columns, items: rows } })
    await w.findAll('thead th')[1].trigger('click') // '代号' 列不可排序
    expect(w.emitted('update:sort')).toBeUndefined()
  })

  it('active column exposes sort direction via aria-sort; others stay neutral', () => {
    const w = mount(CatalogTable, {
      props: { columns, items: rows, sort: 'rarity', sortDir: 'desc' },
    })
    const btns = headButtons(w)
    expect(btns[0].attributes('aria-sort')).toBeUndefined() // name 未激活
    expect(btns[1].attributes('aria-sort')).toBe('descending') // rarity 激活且降序
  })

  /* ---------- 移动端堆叠行（<721px 断点，jsdom 下与桌面结构同时存在） ---------- */

  it('mobile row keeps main column render and meta cells for middle columns', () => {
    const w = mount(CatalogTable, { props: { columns, items: rows } })
    const main = w.find('.m-row .m-main')
    expect(main.text()).toBe('A') // 名称列（首列）
    const meta = w.findAll('.m-meta-row .m-cell')
    expect(meta.length).toBe(rows.length) // 每数据行一个 meta cell：中间列只有「代号」，稀有度已入右格
    expect(meta[0].text()).toBe('a')
  })

  it('right column cell wraps in a sort button that toggles sort', async () => {
    const w = mount(CatalogTable, { props: { columns, items: rows } })
    const sorts = w.findAll('.m-sort')
    expect(sorts.length).toBe(rows.length)
    await sorts[0].trigger('click')
    expect(w.emitted('update:sort')!.at(-1)).toEqual(['rarity']) // 右格=稀有度（align right）
  })
})