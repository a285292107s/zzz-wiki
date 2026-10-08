// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  BLOCK_ATTR,
  CHROME_CASE_CLASS,
  CHROME_IN_CLASS,
  CHROME_OUT_CLASS,
  CHROME_SKIP_ATTR,
  VT_TIMING,
  clearChrome,
  clearChromeCases,
  collectChrome,
  enterSettleMs,
  exitSettleMs,
  stampChrome,
} from '@/utils/viewTransition/chrome'

/** jsdom 没有布局：把元素判成「可见且在视口内」需要桩掉这两条几何接口。
 *  其余（display/visibility/opacity）走真实 getComputedStyle。 */
function stubLayout(): void {
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(function (this: HTMLElement) {
    return [{ width: 100, height: 20 } as DOMRect] as unknown as DOMRectList
  })
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return { top: 10, left: 10, right: 200, bottom: 30, width: 190, height: 20, x: 10, y: 10 } as DOMRect
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('编排时序（CSS 与 JS 的单一来源）', () => {
  it('退场落定：随区块数增长，且不低于取景变形所需时长', () => {
    expect(exitSettleMs(1)).toBeGreaterThanOrEqual(VT_TIMING.morph)
    expect(exitSettleMs(7)).toBeGreaterThan(exitSettleMs(1))
    // 与步长同源：n 块 = max(outDur + step×(n−1), 取景变形) + 余量
    const cascade = VT_TIMING.outDur + VT_TIMING.outStep * 6
    expect(exitSettleMs(7)).toBe(Math.max(cascade, VT_TIMING.morph) + 60)
  })

  it('入场落定：含整体延后，且随区块数增长', () => {
    expect(enterSettleMs(1)).toBe(VT_TIMING.inHold + VT_TIMING.inDur + 80)
    expect(enterSettleMs(8)).toBeGreaterThan(enterSettleMs(1))
  })
})

describe('区块标记与清理', () => {
  it('两阶段各自标记、互不误伤；--vt-i 只在两阶段都摘掉后才清', () => {
    const a = document.createElement('div')
    const b = document.createElement('div')
    document.body.append(a, b)
    stampChrome({ blocks: [a], cases: [] }, 'out')
    stampChrome({ blocks: [b], cases: [] }, 'in')
    expect(a.classList.contains(CHROME_OUT_CLASS)).toBe(true)
    expect(b.classList.contains(CHROME_IN_CLASS)).toBe(true)
    expect(a.style.getPropertyValue('--vt-i')).toBe('0')

    clearChrome('out')
    expect(a.classList.contains(CHROME_OUT_CLASS)).toBe(false)
    expect(b.classList.contains(CHROME_IN_CLASS)).toBe(true) // 另一阶段不受影响
  })

  it('同一元素同时挂两阶段时，先摘一阶段不清错峰索引', () => {
    const el = document.createElement('div')
    document.body.append(el)
    stampChrome({ blocks: [el], cases: [] }, 'out')
    stampChrome({ blocks: [el], cases: [] }, 'in')
    clearChrome('out')
    expect(el.style.getPropertyValue('--vt-i')).toBe('0')
    clearChrome('in')
    expect(el.style.getPropertyValue('--vt-i')).toBe('')
  })

  it('装裱壳单独清理：只在整趟结束/撤销时调用', () => {
    const shell = document.createElement('div')
    document.body.append(shell)
    stampChrome({ blocks: [], cases: [shell] }, 'in')
    expect(shell.classList.contains(CHROME_CASE_CLASS)).toBe(true)
    clearChromeCases()
    expect(shell.classList.contains(CHROME_CASE_CLASS)).toBe(false)
  })
})

describe('区块收集（只认声明）', () => {
  it('只收声明过的区块，并按视觉顺序（top→left）编号', () => {
    stubLayout()
    const wrap = document.createElement('div')
    const low = document.createElement('div')
    low.setAttribute(BLOCK_ATTR, '')
    const high = document.createElement('div')
    high.setAttribute(BLOCK_ATTR, '')
    high.getBoundingClientRect = () => ({ top: 1, left: 5, bottom: 21, right: 205, width: 200, height: 20, x: 5, y: 1 }) as DOMRect
    const plain = document.createElement('div') // 没声明 → 不收
    wrap.append(low, high, plain)
    document.body.append(wrap)

    const plan = collectChrome(document.body)
    expect(plan.blocks).toEqual([high, low]) // top 小的在前
  })

  it('含共享元素的声明整块让位（否则退场会把主角一起淡掉），其祖先记作装裱壳', () => {
    stubLayout()
    const frame = document.createElement('div')
    const plateBranch = document.createElement('div')
    plateBranch.setAttribute(BLOCK_ATTR, '')
    const plate = document.createElement('div')
    plate.setAttribute(CHROME_SKIP_ATTR, '')
    plateBranch.append(plate)
    const meta = document.createElement('div')
    meta.setAttribute(BLOCK_ATTR, '')
    frame.append(plateBranch, meta)
    document.body.append(frame)

    const plan = collectChrome(document.body)
    expect(plan.blocks).toEqual([meta]) // 含 skip 的那一支被排除
    expect(plan.cases).toContain(frame) // 但它的祖先要参与"退边线/底色"
  })

  it('嵌套声明只收最内层：同一个位置不会被淡两次', () => {
    stubLayout()
    const outer = document.createElement('div')
    outer.setAttribute(BLOCK_ATTR, '')
    const inner = document.createElement('div')
    inner.setAttribute(BLOCK_ATTR, '')
    outer.append(inner)
    document.body.append(outer)

    expect(collectChrome(document.body).blocks).toEqual([inner])
  })
})
