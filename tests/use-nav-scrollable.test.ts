// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useNavScrollable } from '../src/composables/useNavScrollable'

/** 测试用薄壳组件：把 navEl 绑定到一个 div 上 */
const TestNav = {
  setup() {
    const { navEl } = useNavScrollable()
    return { navEl }
  },
  template: `<div ref="navEl" class="section-nav"><div class="sn-list" /></div>`,
}

/** 测试用薄壳组件：额外暴露 scrollRight */
const TestNavWithScroll = {
  setup() {
    const { navEl, scrollRight } = useNavScrollable()
    return { navEl, scrollRight }
  },
  template: `<div ref="navEl" class="section-nav"><div class="sn-list" /></div>`,
}

/**
 * 为元素 mock 滚动相关属性。
 * jsdom 不实现 layout，scrollWidth/clientWidth 均为 0；scrollBy 是 no-op。
 * 此处用 defineProperty 覆盖为可读写值，并实现一个带钳位的 scrollBy。
 */
function mockScroll(el: HTMLElement, w: number, cw: number, sl = 0) {
  Object.defineProperty(el, 'scrollWidth', { configurable: true, value: w })
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: cw })
  Object.defineProperty(el, 'scrollLeft', { configurable: true, writable: true, value: sl })
  el.scrollBy = ((opts: { left?: number; top?: number }) => {
    if (opts.left != null) {
      const max = Math.max(0, el.scrollWidth - el.clientWidth)
      el.scrollLeft = Math.max(0, Math.min(el.scrollLeft + opts.left, max))
    }
  }) as any
}

describe('useNavScrollable', () => {
  it('refresh: 内容不超宽时不加 .scrollable', async () => {
    const w = mount(TestNav)
    await nextTick()
    const el = w.find('.section-nav').element as HTMLElement
    mockScroll(el, 100, 200)
    // watch flush: post 已在 mount 后触发过一次 refresh（此时 scrollWidth=0 → 不加 scrollable）；
    // mock 后需再调一次 refresh 以反映新尺寸
    // 通过派发 scroll 事件触发 refresh（refresh 也是 scroll 监听器）
    el.dispatchEvent(new Event('scroll'))
    expect(el.classList.contains('scrollable')).toBe(false)
    w.unmount()
  })

  it('refresh: 内容超宽时加 .scrollable', async () => {
    const w = mount(TestNav)
    await nextTick()
    const el = w.find('.section-nav').element as HTMLElement
    mockScroll(el, 300, 200)
    el.dispatchEvent(new Event('scroll'))
    expect(el.classList.contains('scrollable')).toBe(true)
    w.unmount()
  })

  it('refresh: 滚到底时加 .at-end', async () => {
    const w = mount(TestNav)
    await nextTick()
    const el = w.find('.section-nav').element as HTMLElement
    mockScroll(el, 300, 200, 100) // scrollLeft=100, clientWidth=200, scrollWidth=300 → 已到底
    el.dispatchEvent(new Event('scroll'))
    expect(el.classList.contains('at-end')).toBe(true)
    w.unmount()
  })

  it('refresh: 未滚到底时不加 .at-end', async () => {
    const w = mount(TestNav)
    await nextTick()
    const el = w.find('.section-nav').element as HTMLElement
    mockScroll(el, 300, 200, 50)
    el.dispatchEvent(new Event('scroll'))
    expect(el.classList.contains('at-end')).toBe(false)
    w.unmount()
  })

  it('onWheel: 垂直滚轮在可滚动横条上转为横向滚动并阻止默认', async () => {
    const w = mount(TestNav)
    await nextTick()
    const el = w.find('.section-nav').element as HTMLElement
    mockScroll(el, 300, 200, 0)

    const event = new WheelEvent('wheel', { deltaY: 50, bubbles: true, cancelable: true })
    const preventDefault = vi.spyOn(event, 'preventDefault')
    el.dispatchEvent(event)

    expect(preventDefault).toHaveBeenCalled()
    expect(el.scrollLeft).toBe(50)
    w.unmount()
  })

  it('onWheel: 垂直滚轮在不可滚动横条上不阻止默认', async () => {
    const w = mount(TestNav)
    await nextTick()
    const el = w.find('.section-nav').element as HTMLElement
    mockScroll(el, 100, 200, 0)

    const event = new WheelEvent('wheel', { deltaY: 50, bubbles: true, cancelable: true })
    const preventDefault = vi.spyOn(event, 'preventDefault')
    el.dispatchEvent(event)

    expect(preventDefault).not.toHaveBeenCalled()
    w.unmount()
  })

  it('onWheel: 横向拨轮放行，不阻止默认', async () => {
    const w = mount(TestNav)
    await nextTick()
    const el = w.find('.section-nav').element as HTMLElement
    mockScroll(el, 300, 200, 0)

    // deltaX=50 > deltaY=10 → 横向为主，应放行
    const event = new WheelEvent('wheel', { deltaX: 50, deltaY: 10, bubbles: true, cancelable: true })
    const preventDefault = vi.spyOn(event, 'preventDefault')
    el.dispatchEvent(event)

    expect(preventDefault).not.toHaveBeenCalled()
    w.unmount()
  })

  it('scrollRight: 滚动一个视口宽', async () => {
    const w = mount(TestNavWithScroll)
    await nextTick()
    const el = w.find('.section-nav').element as HTMLElement
    mockScroll(el, 500, 200, 0)

    await (w.vm as unknown as { scrollRight: () => unknown }).scrollRight()
    await nextTick()
    expect(el.scrollLeft).toBe(200)
    w.unmount()
  })

  it('scrollRight: 不可滚动时是 no-op（scrollBy 钳位）', async () => {
    const w = mount(TestNavWithScroll)
    await nextTick()
    const el = w.find('.section-nav').element as HTMLElement
    mockScroll(el, 100, 200, 0) // scrollWidth < clientWidth → max=0

    await (w.vm as unknown as { scrollRight: () => unknown }).scrollRight()
    await nextTick()
    expect(el.scrollLeft).toBe(0)
    w.unmount()
  })

  it('卸载时移除滚轮事件监听', async () => {
    const w = mount(TestNav)
    await nextTick()
    const el = w.find('.section-nav').element as HTMLElement
    mockScroll(el, 300, 200, 0)

    // 卸载前：滚轮可触发
    const event = new WheelEvent('wheel', { deltaY: 50, bubbles: true, cancelable: true })
    const preventDefault = vi.spyOn(event, 'preventDefault')
    el.dispatchEvent(event)
    expect(preventDefault).toHaveBeenCalled()
    expect(el.scrollLeft).toBe(50)

    // 卸载后：监听已移除，再次派发不应触发
    w.unmount()
    const event2 = new WheelEvent('wheel', { deltaY: 50, bubbles: true, cancelable: true })
    const preventDefault2 = vi.spyOn(event2, 'preventDefault')
    try {
      el.dispatchEvent(event2)
    } catch {
      // jsdom 在元素移出 DOM 后派发事件可能抛错，视为预期
    }
    expect(preventDefault2).not.toHaveBeenCalled()
  })
})