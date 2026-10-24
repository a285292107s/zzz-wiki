import { describe, expect, it } from 'vitest'
import { getHeroCalibration } from '../src/data/heroCalibration'
import poolJson from '../src/data/featured-pool.json'

interface CalEntry {
  pos: string
  zoom: number
  originY: number
}

const CALIBRATED = (poolJson as { calibrated: Record<string, CalEntry> }).calibrated

const cal = (id: number) => ({
  pos: CALIBRATED[String(id)]!.pos,
  zoom: CALIBRATED[String(id)]!.zoom,
  originY: CALIBRATED[String(id)]!.originY,
})

describe('getHeroCalibration', () => {
  it('已校准（在池）角色返回构图参数', () => {
    expect(getHeroCalibration(1011)).toEqual(cal(1011))
  })

  it('已校准但未入池角色同样返回（pool 只含轮换子集，calibrated 是全表）', () => {
    expect(getHeroCalibration(1021)).toEqual(cal(1021))
  })

  it('已校准双形态角色（默认女性版）同样返回构图参数', () => {
    expect(getHeroCalibration(1551)).toEqual(cal(1551))
  })

  it('未校准角色返回 null（调用方回落居中取景）', () => {
    expect(getHeroCalibration(9999)).toBeNull()
  })

  it('id 缺失返回 null', () => {
    expect(getHeroCalibration(undefined)).toBeNull()
  })
})
