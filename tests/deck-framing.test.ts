import { describe, expect, it } from 'vitest'
import { deckFigureStyle, type DeckCalibration } from '../src/utils/deckFraming'

/** 池内一张真实校准（1541 佩洛伊斯；zoom 1.2965 是池内最常见档） */
const CAL: DeckCalibration = { pos: '94%', zoom: 1.29496, originY: 48.6 }

/** 目的地取景（桌面详情页头图）：纯 cover 居中、不套校准 */
const DESTINATION = { objectPosition: '50%', transformOrigin: '50% 50%', transform: 'scale(1)' }

describe('deckFigureStyle：起飞前那张画该用什么取景', () => {
  it('常态：原样用该图的校准（pos / originY / zoom 三项都要在）', () => {
    expect(deckFigureStyle(CAL, false, false)).toEqual({
      objectPosition: '94%',
      transformOrigin: '50% 48.6%',
      transform: 'scale(1.29496)',
    })
  })

  it('宽屏 + 变形中：切到目的地取景（对齐两端，飞行交接才不「换个大小」）', () => {
    expect(deckFigureStyle(CAL, true, false)).toEqual(DESTINATION)
  })

  it('窄屏 + 变形中：**保持校准取景**（切目的地会引入 1/zoom 的纵向错位）', () => {
    const st = deckFigureStyle(CAL, true, true)
    expect(st).toEqual({
      objectPosition: '94%',
      transformOrigin: '50% 48.6%',
      transform: 'scale(1.29496)',
    })
    // 关键判据：绝不能等于目的地取景 —— 窄屏的目的地取景就是卡片自己的校准取景
    expect(st).not.toEqual(DESTINATION)
  })

  it('窄屏与宽屏在「非变形」时结果相同（断点不该影响常态取景）', () => {
    expect(deckFigureStyle(CAL, false, true)).toEqual(deckFigureStyle(CAL, false, false))
  })

  it('校准缺失（卡片数据未就绪）：回落居中不缩放，且窄屏同样不过渡到目的地', () => {
    const fallback = { objectPosition: '50%', transformOrigin: '50% 50%', transform: 'scale(1)' }
    expect(deckFigureStyle(undefined, false, false)).toEqual(fallback)
    expect(deckFigureStyle(undefined, true, true)).toEqual(fallback)
    // 宽屏变形中虽然值恰好相同，但来源不同（一个是兜底、一个是目的地）——
    // 这里只锁定行为等价，避免将来有人把兜底值改动后误以为窄屏逻辑失效
    expect(deckFigureStyle(undefined, true, false)).toEqual(fallback)
  })

  it('返回的是新对象：调用方改它不会污染内部常量', () => {
    const a = deckFigureStyle(undefined, false, false)
    a.objectPosition = 'MUTATED'
    expect(deckFigureStyle(undefined, false, false).objectPosition).toBe('50%')
  })
})
