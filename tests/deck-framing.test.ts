import { describe, expect, it } from 'vitest'
import { deckFigureStyle, type DeckCalibration, type DeckDestination } from '../src/utils/deckFraming'

/** 池内一张真实校准（1541 佩洛伊斯；zoom 1.2965 是池内最常见档） */
const CAL: DeckCalibration = { pos: '94%', zoom: 1.29496, originY: 48.6 }

/** 目的地取景（桌面详情页 hero）：hero 画幅的 cover 平移、不缩放 */
const DESTINATION: DeckDestination = { pos: '64%', posY: '5%' }
const DESTINATION_STYLE = {
  objectPosition: '64% 5%',
  transformOrigin: '50% 50%',
  transform: 'scale(1)',
}

describe('deckFigureStyle：起飞前那张画该用什么取景', () => {
  it('常态：原样用该图的 9:16 校准（pos / originY / zoom 三项都要在）', () => {
    expect(deckFigureStyle(CAL, DESTINATION, false, false)).toEqual({
      objectPosition: '94%',
      transformOrigin: '50% 48.6%',
      transform: 'scale(1.29496)',
    })
  })

  it('宽屏 + 变形中：切到目的地取景（详情页 hero 的平移取景、不缩放）', () => {
    expect(deckFigureStyle(CAL, DESTINATION, true, false)).toEqual(DESTINATION_STYLE)
  })

  it('窄屏 + 变形中：**保持校准取景**（切目的地会引入 1/zoom 的纵向错位）', () => {
    const st = deckFigureStyle(CAL, DESTINATION, true, true)
    expect(st).toEqual({
      objectPosition: '94%',
      transformOrigin: '50% 48.6%',
      transform: 'scale(1.29496)',
    })
    // 关键判据：绝不能等于目的地取景 —— 窄屏的目的地取景就是卡片自己的校准取景
    expect(st).not.toEqual(DESTINATION_STYLE)
  })

  it('窄屏与宽屏在「非变形」时结果相同（断点不该影响常态取景）', () => {
    expect(deckFigureStyle(CAL, DESTINATION, false, true)).toEqual(
      deckFigureStyle(CAL, DESTINATION, false, false),
    )
  })

  it('校准与目的地都缺失（数据未就绪）：回落居中不缩放，且窄屏同样不过渡到目的地', () => {
    const fallback = { objectPosition: '50%', transformOrigin: '50% 50%', transform: 'scale(1)' }
    expect(deckFigureStyle(undefined, undefined, false, false)).toEqual(fallback)
    expect(deckFigureStyle(undefined, undefined, true, true)).toEqual(fallback)
    // 宽屏变形中虽然值恰好相同，但来源不同（一个是兜底、一个是目的地）——
    // 这里只锁定行为等价，避免将来有人把兜底值改动后误以为窄屏逻辑失效
    expect(deckFigureStyle(undefined, undefined, true, false)).toEqual({
      objectPosition: '50% 50%',
      transformOrigin: '50% 50%',
      transform: 'scale(1)',
    })
  })

  it('未校准的角色（目的地为 undefined）：宽屏变形中按目的地兜底居中', () => {
    expect(deckFigureStyle(CAL, undefined, true, false)).toEqual({
      objectPosition: '50% 50%',
      transformOrigin: '50% 50%',
      transform: 'scale(1)',
    })
  })

  it('返回的是新对象：调用方改它不会污染内部常量', () => {
    const a = deckFigureStyle(undefined, undefined, false, false)
    a.objectPosition = 'MUTATED'
    expect(deckFigureStyle(undefined, undefined, false, false).objectPosition).toBe('50%')
  })
})
