import { describe, expect, it } from 'vitest'
import { heroVariantFile } from '../src/data/heroGenderVariants'

describe('heroVariantFile', () => {
  it('1551 女性形态取 defaultFile（默认展示版）', () => {
    expect(heroVariantFile(1551, 'female')).toBe('Mindscape_1551_Female_2')
  })

  it('1551 男性形态取非 defaultFile 的 variants 项', () => {
    expect(heroVariantFile(1551, 'male')).toBe('Mindscape_1551_Male_2')
  })

  it('非双形态角色返回 null（调用方回落裸名规则）', () => {
    expect(heroVariantFile(1011, 'female')).toBeNull()
    expect(heroVariantFile(1011, 'male')).toBeNull()
  })

  it('id 缺失返回 null', () => {
    expect(heroVariantFile(undefined, 'female')).toBeNull()
  })
})
