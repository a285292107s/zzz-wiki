import { describe, expect, it } from 'vitest'
import { heroIdsFromList } from '@/domain/heroCatalog'

describe('heroIdsFromList', () => {
  it('提取 Id 并升序去重', () => {
    expect(heroIdsFromList([{ Id: 1621 }, { Id: 1011 }, { Id: 1611 }, { Id: 1011 }])).toEqual([1011, 1611, 1621])
  })

  it('接受字符串 Id，丢弃非法值', () => {
    expect(
      heroIdsFromList([{ Id: '1591' }, { Id: undefined }, { Id: 'x' }, { Id: 1011 }]),
    ).toEqual([1011, 1591])
  })

  it('空名录返回空数组', () => {
    expect(heroIdsFromList([])).toEqual([])
  })
})
