import { describe, expect, it } from 'vitest'
import {
  BangbooListItemSchema,
  CharacterDetailSchema,
  CharacterListItemSchema,
  DiskDriveListItemSchema,
  ManifestSchema,
  WEngineListItemSchema,
} from '../src/domain/schema'

describe('list schemas', () => {
  it('accepts a valid character list item (unknown fields preserved)', () => {
    const item = { Id: 1011, zh: '安比', en: 'Anby', camp: 3, unknownField: 'x' }
    const r = CharacterListItemSchema.safeParse(item)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.unknownField).toBe('x')
  })

  it('rejects a list item without Id', () => {
    expect(CharacterListItemSchema.safeParse({ zh: '无Id' }).success).toBe(false)
  })

  it('accepts weapon / bangboo / disk list items', () => {
    expect(WEngineListItemSchema.safeParse({ Id: 12001, rank: 3 }).success).toBe(true)
    expect(BangbooListItemSchema.safeParse({ Id: 53001, rank: 4 }).success).toBe(true)
    expect(
      DiskDriveListItemSchema.safeParse({ Id: 31000, zh: { name: '啄木鸟' } }).success,
    ).toBe(true)
  })
})

describe('detail schemas', () => {
  it('accepts a minimal character detail', () => {
    const d = { id: 1011, name: '安比', stats: { hp_max: 5000 } }
    expect(CharacterDetailSchema.safeParse(d).success).toBe(true)
  })

  it('accepts stats.tags array (real-world shape)', () => {
    const d = { id: 1011, stats: { tags: ['1', '2'], attack: 100 } }
    const r = CharacterDetailSchema.safeParse(d)
    expect(r.success).toBe(true)
  })

  it('accepts partner_info absent or null', () => {
    expect(CharacterDetailSchema.safeParse({ id: 1, partner_info: null }).success).toBe(true)
    expect(CharacterDetailSchema.safeParse({ id: 1 }).success).toBe(true)
  })
})

describe('manifest schema', () => {
  it('requires zzz.latest', () => {
    expect(ManifestSchema.safeParse({ zzz: { latest: '3.2.3' } }).success).toBe(true)
    expect(ManifestSchema.safeParse({ zzz: {} }).success).toBe(false)
  })
})
