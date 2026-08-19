import { describe, expect, it } from 'vitest'
import { pickName } from '../src/utils/names'

describe('pickName / locName', () => {
  it('prefers zh over other locales', () => {
    expect(pickName({ en: 'Anby', zh: '安比', ja: 'アンビー' })).toBe('安比')
  })

  it('falls back to en when zh missing', () => {
    expect(pickName({ en: 'Anby', ja: 'アンビー' })).toBe('Anby')
  })

  it('uses codename as final fallback', () => {
    expect(pickName({ codename: 'Penguin' })).toBe('Penguin')
  })

  it('skips empty-string fields', () => {
    expect(pickName({ zh: '', en: 'Anby', code: 'A' })).toBe('Anby')
  })

  it('returns em dash when nothing available', () => {
    expect(pickName({})).toBe('—')
    expect(pickName(null)).toBe('—')
    expect(pickName(undefined)).toBe('—')
  })
})
