import { describe, expect, it } from 'vitest'
import { contrastRatio, luminance } from '../src/utils/contrast'

describe('luminance', () => {
  it('returns 0 for pure black, 1 for pure white', () => {
    expect(luminance('#000000')).toBeCloseTo(0, 6)
    expect(luminance('#ffffff')).toBeCloseTo(1, 6)
  })

  it('is monotonic: darker hex has lower relative luminance', () => {
    expect(luminance('#0d0f11')).toBeLessThan(luminance('#848076'))
    expect(luminance('#848076')).toBeLessThan(luminance('#e8e4da'))
  })
})

describe('contrastRatio', () => {
  it('returns 21 for black/white, 1 for identical colors', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBe(21)
    expect(contrastRatio('#d8a35c', '#d8a35c')).toBe(1)
  })

  it('is order-independent and ≥ 1', () => {
    const a = '#0d0f11'
    const b = '#e8e4da'
    expect(contrastRatio(a, b)).toBe(contrastRatio(b, a))
    expect(contrastRatio(a, b)).toBeGreaterThanOrEqual(1)
  })

  it('matches known pairs (warm paper ink on page ground)', () => {
    expect(contrastRatio('#e8e4da', '#0d0f11')).toBeCloseTo(15.13, 2)
    expect(contrastRatio('#848076', '#0d0f11')).toBeCloseTo(4.87, 2)
  })

  it('returns null for non-6-digit hex inputs (rgba / var / shorthand)', () => {
    expect(contrastRatio('rgba(0,0,0,0.5)', '#ffffff')).toBeNull()
    expect(contrastRatio('var(--bg-0)', '#ffffff')).toBeNull()
    expect(contrastRatio('#fff', '#000000')).toBeNull()
  })
})