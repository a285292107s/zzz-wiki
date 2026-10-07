import { describe, expect, it } from 'vitest'
import {
  DRAG_INTENT_PX,
  clampIndex,
  followWithRubber,
  isDragGesture,
  lastIndexOf,
  settleIndex,
} from '@/utils/deckGesture'

describe('槽位边界（clampIndex / lastIndexOf）', () => {
  it('钉在 0..count-1', () => {
    expect(lastIndexOf(4)).toBe(3)
    expect(lastIndexOf(1)).toBe(0)
    expect(lastIndexOf(0)).toBe(0)
    expect(clampIndex(-2, 4)).toBe(0)
    expect(clampIndex(0, 4)).toBe(0)
    expect(clampIndex(3, 4)).toBe(3)
    expect(clampIndex(9, 4)).toBe(3)
  })

  it('非法输入不产生 NaN 槽位（名录未就绪/空池时不会渲染出 undefined 卡）', () => {
    expect(clampIndex(Number.NaN, 4)).toBe(0)
    expect(clampIndex(Number.POSITIVE_INFINITY, 4)).toBe(3)
    expect(clampIndex(1, 0)).toBe(0)
  })
})

describe('followWithRubber（两端越界阻尼）', () => {
  it('界内原样跟手', () => {
    expect(followWithRubber(0, 4)).toBe(0)
    expect(followWithRubber(2.5, 4)).toBe(2.5)
    expect(followWithRubber(3, 4)).toBe(3)
  })

  it('两端之外按 0.35 压缩（跟手但顶得住）', () => {
    expect(followWithRubber(-1, 4)).toBeCloseTo(-0.35)
    expect(followWithRubber(4, 4)).toBeCloseTo(3.35)
    // 拖得再远也只按系数增长，不会把牌堆拉出屏幕
    expect(followWithRubber(8, 4)).toBeCloseTo(4.75)
  })
})

describe('settleIndex（松手吸附槽位）', () => {
  const STRIDE = 400 // 卡宽 + 1px 间隙，向右拖为正

  it('少于半张回原位，多于半张进一张', () => {
    expect(settleIndex(1, 100, STRIDE, 4)).toBe(1) // 右拖 1/4 张，不够翻页
    expect(settleIndex(1, -100, STRIDE, 4)).toBe(1)
    expect(settleIndex(1, -250, STRIDE, 4)).toBe(2) // 左拖过半张 → 下一张
    expect(settleIndex(1, 250, STRIDE, 4)).toBe(0) // 右拖过半张 → 上一张
  })

  it('长距离快拖能一路翻到两端（越界阻尼不得吃掉跨页量）', () => {
    expect(settleIndex(0, -5 * STRIDE, STRIDE, 4)).toBe(3)
    expect(settleIndex(3, 5 * STRIDE, STRIDE, 4)).toBe(0)
    expect(settleIndex(2, 3 * STRIDE, STRIDE, 4)).toBe(0)
  })

  it('两端之外仍钉在合法槽位（第 4 张再往左拖不会越出池子）', () => {
    expect(settleIndex(3, -2 * STRIDE, STRIDE, 4)).toBe(3)
    expect(settleIndex(0, 2 * STRIDE, STRIDE, 4)).toBe(0)
  })

  it('单卡池：任何拖动都停在 0', () => {
    expect(settleIndex(0, 3 * STRIDE, STRIDE, 1)).toBe(0)
    expect(settleIndex(0, -3 * STRIDE, STRIDE, 1)).toBe(0)
  })

  it('步长未测到（0/NaN）时退化为 1px，不产生 Infinity/NaN 槽位', () => {
    expect(settleIndex(1, STRIDE, 0, 4)).toBe(0)
    expect(settleIndex(1, 0, Number.NaN, 4)).toBe(1)
  })
})

describe('isDragGesture（点击 / 拖拽判定）', () => {
  it('阈值内算点击，超过算拖动', () => {
    expect(DRAG_INTENT_PX).toBeGreaterThan(0)
    expect(isDragGesture(0)).toBe(false)
    expect(isDragGesture(DRAG_INTENT_PX)).toBe(false)
    expect(isDragGesture(DRAG_INTENT_PX + 1)).toBe(true)
  })
})
