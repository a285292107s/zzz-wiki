import { describe, expect, it } from 'vitest'
import {
  iconSources,
  skillAssetSources,
  skillIconSources,
} from '../src/data/icons'

const LOCAL = '/data/img'

describe('iconSources · 本地优先（Q4b）', () => {
  it('prepends a local candidate derived from the asset basename', () => {
    const urls = iconSources({ Id: 1011, icon: 'UI/.../IconRoleGeneral01.png' }, 'list', 'character')
    expect(urls[0]).toBe(`${LOCAL}/character/IconRoleGeneral01.webp`)
  })

  it('keeps nanoka candidate as fallback after local', () => {
    const urls = iconSources({ Id: 1011, icon: 'IconRoleGeneral01' }, 'list', 'character')
    expect(urls[0]).toContain('/data/img/')
    // 本地 + nanoka，去重后至少两条
    expect(urls.length).toBeGreaterThanOrEqual(2)
    expect(urls.some((u) => u.includes('static.nanoka.cc'))).toBe(true)
  })

  it('uses category-specific local path', () => {
    const weapon = iconSources({ Id: 12001, icon: 'Weapon_B_Common_01' }, 'list', 'weapon')
    expect(weapon[0]).toBe(`${LOCAL}/weapon/Weapon_B_Common_01.webp`)
    const disc = iconSources({ Id: 31000, icon: 'SuitWoodpeckerElectro' }, 'list', 'disc')
    expect(disc[0]).toBe(`${LOCAL}/disc/SuitWoodpeckerElectro.webp`)
  })

  it('returns empty when no icon/id provided', () => {
    expect(iconSources({}, 'list', 'character')).toEqual([])
  })
})

describe('skill icons · 本地优先（Q4b）', () => {
  it('skillIconSources prefers local skill path then nanoka', () => {
    const urls = skillIconSources('basic') // Icon_Normal
    expect(urls[0]).toBe(`${LOCAL}/skill/Icon_Normal.webp`)
    expect(urls[1]).toContain('static.nanoka.cc')
  })

  it('skillAssetSources emits local + nanoka candidates', () => {
    const urls = skillAssetSources('Icon_Switch')
    expect(urls[0]).toBe(`${LOCAL}/skill/Icon_Switch.webp`)
    expect(urls[1]).toContain('static.nanoka.cc')
  })
})
