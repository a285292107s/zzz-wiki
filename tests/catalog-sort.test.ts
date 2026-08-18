import { describe, expect, it } from 'vitest'
import { ref, computed } from 'vue'
import { useCatalogSort } from '../src/composables/useCatalogSort'

interface Row {
  id: number
  name: string
  rank?: number
}

const ROWS: Row[] = [
  { id: 1, name: '朱鸢', rank: 4 },
  { id: 2, name: '苍角', rank: 3 },
  { id: 3, name: '本', rank: 4 },
]

const COLS = [
  { key: 'name', value: (r: Row) => r.name },
  { key: 'rarity', value: (r: Row) => r.rank ?? -1 },
]

describe('useCatalogSort', () => {
  it('returns input order when no sort key', () => {
    const r = useCatalogSort(ref(ROWS), COLS)
    expect(r.sorted.value.map((x) => x.id)).toEqual([1, 2, 3])
  })

  it('sorts ascending by string key and flips direction on toggle', () => {
    const r = useCatalogSort(ref(ROWS), COLS)
    r.toggle('name')
    expect(r.sortKey.value).toBe('name')
    expect(r.sortDir.value).toBe('asc')
    // 中文按拼音排序：本 < 朱鸢 < 苍角（localeCompare zh-Hans）
    const names = r.sorted.value.map((x) => x.name)
    expect([...names].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))).toEqual(names)
    r.toggle('name')
    expect(r.sortDir.value).toBe('desc')
    expect(r.sorted.value.map((x) => x.name)).toEqual([...names].reverse())
  })

  it('sorts numerically by rank', () => {
    const r = useCatalogSort(ref(ROWS), COLS)
    r.toggle('rarity')
    expect(r.sorted.value.map((x) => x.id)).toEqual([2, 1, 3]) // rank 3 在前，rank 4 持平保稳定
  })

  it('switching key resets direction to asc', () => {
    const r = useCatalogSort(ref(ROWS), COLS)
    r.toggle('name')
    r.toggle('name') // desc
    r.toggle('rarity')
    expect(r.sortDir.value).toBe('asc')
    expect(r.sortKey.value).toBe('rarity')
  })

  it('dirFor reports direction only for active column', () => {
    const r = useCatalogSort(ref(ROWS), COLS)
    expect(r.dirFor('name')).toBeNull()
    r.toggle('name')
    expect(r.dirFor('name')).toBe('asc')
    expect(r.dirFor('rarity')).toBeNull()
  })

  it('handles a getter-based items source', () => {
    const list = ref(ROWS)
    const items = computed(() => list.value.filter((x) => x.rank === 4))
    const r = useCatalogSort(items, COLS)
    r.toggle('name')
    expect(r.sorted.value.map((x) => x.id).sort()).toEqual([1, 3])
  })
})
