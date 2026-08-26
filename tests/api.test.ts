import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CATALOG } from '../src/domain/catalog'

const MANIFEST = { zzz: { live: '3.1' }, generated: '' }

function mockFetch(impl: (url: string) => unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const body = impl(url)
      if (body instanceof Error) throw body
      return { ok: true, status: 200, json: async () => body }
    }),
  )
}

function mockHttpError(status: number) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: false, status, json: async () => ({}) })),
  )
}

const fetchMock = () => fetch as unknown as ReturnType<typeof vi.fn>

describe('api.list / api.detail', () => {
  beforeEach(() => {
    vi.resetModules() // 隔离 api 模块级缓存（DESIGN.md P1：cache 只进不出）
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('normalizes list payloads: dict → array with Id attached', async () => {
    const { api } = await import('../src/data/api')
    mockFetch((url) => {
      if (url.endsWith('/manifest.json')) return MANIFEST
      return { 1011: { en: 'Anby', zh: '安比' }, 1012: { en: 'Nekomata', zh: '猫又' } }
    })
    const rows = await api.list<{ Id: number; zh?: string }>('character')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ Id: 1011, zh: '安比' })
    expect(rows[1]).toMatchObject({ Id: 1012, zh: '猫又' })
  })

  it('compat characters() hits the same kind endpoint', async () => {
    const { api } = await import('../src/data/api')
    mockFetch((url) => {
      if (url.endsWith('/manifest.json')) return MANIFEST
      return { 1: { zh: '单条' } }
    })
    const rows = await api.characters()
    expect(rows).toHaveLength(1)
    expect(rows[0].Id).toBe(1)
  })

  it('detail() builds lang/kind/id path (default zh)', async () => {
    const { api } = await import('../src/data/api')
    const seen: string[] = []
    mockFetch((url) => {
      seen.push(url)
      if (url.endsWith('/manifest.json')) return MANIFEST
      return { name: '安比' }
    })
    const detail = await api.detail<{ name?: string }>('character', 1011)
    expect(detail.name).toBe('安比')
    expect(seen.some((u) => u.endsWith('/data/zh/character/1011.json'))).toBe(true)
  })

  it('caches repeated requests (single manifest fetch)', async () => {
    const { api } = await import('../src/data/api')
    mockFetch((url) => {
      if (url.endsWith('/manifest.json')) return MANIFEST
      return { 1: { zh: 'a' } }
    })
    await api.list('character')
    await api.list('character')
    const calls = fetchMock().mock.calls.map((c) => String(c[0]))
    expect(calls.filter((u) => u.endsWith('/manifest.json'))).toHaveLength(1)
    expect(calls.filter((u) => u.endsWith('/character.json'))).toHaveLength(1)
  })

  it('throws DataError with kind http and status on 500', async () => {
    const { api } = await import('../src/data/api')
    mockHttpError(500)
    await expect(api.list('character')).rejects.toMatchObject({
      name: 'DataError',
      kind: 'http',
      status: 500,
    })
  })

  it('throws DataError kind network when fetch rejects', async () => {
    const { api } = await import('../src/data/api')
    mockFetch(() => new TypeError('Failed to fetch'))
    await expect(api.list('weapon')).rejects.toMatchObject({
      name: 'DataError',
      kind: 'network',
    })
  })

  it('throws DataError kind manifest when manifest.live missing', async () => {
    const { api } = await import('../src/data/api')
    mockFetch(() => ({ zzz: {} }))
    await expect(api.list('character')).rejects.toMatchObject({
      kind: 'manifest',
    })
  })

  it('serves the single live layout: list at /data/{kind}.json', async () => {
    const { api } = await import('../src/data/api')
    const seen: string[] = []
    mockFetch((url) => {
      seen.push(url)
      if (url.endsWith('/manifest.json')) return MANIFEST
      return { 1: { zh: 'a' } }
    })
    await api.list('character')
    await api.list('character')
    expect(seen.some((u) => u.endsWith('/data/character.json'))).toBe(true)
    // 单版本固定路径 + 模块级缓存：名录只请求一次
    expect(seen.filter((u) => u.endsWith('/data/character.json'))).toHaveLength(1)
  })

  it('dataVersions exposes live version number from root manifest', async () => {
    const { dataVersions } = await import('../src/data/api')
    mockFetch(() => MANIFEST)
    const v = await dataVersions()
    expect(v.live).toBe('3.1')
    expect(v.generated).toBe('')
  })
})

describe('resources (catalog-driven)', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('listFor uses catalog.listFile', async () => {
    const { listFor } = await import('../src/data/resources')
    mockFetch((url) => {
      if (url.endsWith('/manifest.json')) return MANIFEST
      if (url.endsWith('/character.json')) return { 1: { zh: 'a' } }
      return {}
    })
    const entry = CATALOG.find((c) => c.path === '/agents')!
    const rows = await listFor<{ Id: number }>(entry)
    expect(rows[0].Id).toBe(1)
  })

  it('detailFor uses catalog.detailDir', async () => {
    const { detailFor } = await import('../src/data/resources')
    const seen: string[] = []
    mockFetch((url) => {
      seen.push(url)
      if (url.endsWith('/manifest.json')) return MANIFEST
      return { name: 'x' }
    })
    const entry = CATALOG.find((c) => c.path === '/agents')!
    await detailFor<{ name?: string }>(entry, 1011)
    expect(seen.some((u) => u.endsWith('/data/zh/character/1011.json'))).toBe(true)
    expect(fetchMock().mock.calls.length).toBeLessThanOrEqual(2)
  })
})