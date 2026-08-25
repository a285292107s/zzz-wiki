import { describe, expect, it } from 'vitest'
import { getHeroCalibration } from '../src/data/heroCalibration'

describe('getHeroCalibration', () => {
  it('已校准（在池）角色返回构图参数', () => {
    expect(getHeroCalibration(1011)).toEqual({ pos: '44%', zoom: 1.32, originY: 47.5 })
  })

  it('已校准但未入池角色同样返回（pool 只含轮换子集，calibrated 是全表）', () => {
    expect(getHeroCalibration(1021)).toEqual({
      pos: '29%',
      zoom: 1.2841854934601664,
      originY: 45.9,
    })
  })

  it('未校准角色返回 null（调用方回落居中取景）', () => {
    expect(getHeroCalibration(1551)).toBeNull() // 双形态角色，无裸名校准
    expect(getHeroCalibration(9999)).toBeNull() // 不在校准表
  })

  it('id 缺失返回 null', () => {
    expect(getHeroCalibration(undefined)).toBeNull()
  })
})
