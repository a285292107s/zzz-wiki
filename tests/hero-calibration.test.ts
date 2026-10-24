import { describe, expect, it } from 'vitest'
import { getCardFraming, getFraming, getHeroFraming } from '../src/data/heroCalibration'
import poolJson from '../src/data/featured-pool.json'

interface CalEntry {
  inPool: boolean
  modes: Record<string, { pos: string; posY: string; zoom: number; originY: number }>
}

const CALIBRATED = (poolJson as { calibrated: Record<string, CalEntry> }).calibrated
const modes = (id: number) => CALIBRATED[String(id)]!.modes

describe('heroCalibration：按画幅取校准', () => {
  it('9:16 母版给卡片与移动端头图（getCardFraming）', () => {
    expect(getCardFraming(1011)).toEqual(modes(1011)['9:16'])
    expect(getCardFraming(1021)).toEqual(modes(1021)['9:16'])
    expect(getCardFraming(1551)).toEqual(modes(1551)['9:16'])
  })

  it('hero 画幅给桌面 hero 横幅（getHeroFraming）', () => {
    expect(getHeroFraming(1631)).toEqual(modes(1631)['hero'])
    expect(getHeroFraming(1011)).toEqual(modes(1011)['hero'])
  })

  it('任意画幅（getFraming）：五个常规模式都可取', () => {
    for (const mode of ['1:1', '3:4', '4:3', '9:16', '16:9'] as const) {
      expect(getFraming(1031, mode)).toEqual(modes(1031)[mode])
    }
  })

  it('未校准角色返回 null（调用方回落居中取景）', () => {
    expect(getCardFraming(9999)).toBeNull()
    expect(getHeroFraming(9999)).toBeNull()
    expect(getFraming(9999, '16:9')).toBeNull()
  })

  it('id 缺失返回 null', () => {
    expect(getCardFraming(undefined)).toBeNull()
    expect(getHeroFraming(undefined)).toBeNull()
    expect(getFraming(undefined, 'hero')).toBeNull()
  })
})
