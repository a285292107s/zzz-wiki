// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useNavScrollable } from '../src/composables/useNavScrollable'

/** 测试用薄壳组件：把 navEl 绑定到滚动轨道上（与线上一致：ref 在 .sn-list，
 *  出口按钮是它的**兄弟**——按钮若留在轨道内，它会随内容滚动并压住最后一个条目） */
const TestNav = {
  setup() {
    const { navEl } = useNavScrollable()
    return { navEl }
  },
  template: `<div class="section-nav"><div ref="navEl" class="sn-list" /><button class="sn-scroll-btn" /></div>`,
}

/** 测试用薄壳组件：额外暴露 scrollRight / ensureActiveVisible */
const TestNavWithScroll = {
  setup() {
    const { navEl, scrollRight, ensureActiveVisible } = useNavScrollable()
    return { navEl, scrollRight, ensureActiveVisible }
  },
  template: `<div class="section-nav"><div ref="navEl" class="sn-list" /><button class="sn-scroll-btn" /></div>`,
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
    const el = w.find('.sn-list').element as HTMLElement
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
    const el = w.find('.sn-list').element as HTMLElement
    mockScroll(el, 300, 200)
    el.dispatchEvent(new Event('scroll'))
    expect(el.classList.contains('scrollable')).toBe(true)
    w.unmount()
  })

  it('refresh: 滚到底时加 .at-end', async () => {
    const w = mount(TestNav)
    await nextTick()
    const el = w.find('.sn-list').element as HTMLElement
    mockScroll(el, 300, 200, 100) // scrollLeft=100, clientWidth=200, scrollWidth=300 → 已到底
    el.dispatchEvent(new Event('scroll'))
    expect(el.classList.contains('at-end')).toBe(true)
    w.unmount()
  })

  it('refresh: 未滚到底时不加 .at-end', async () => {
    const w = mount(TestNav)
    await nextTick()
    const el = w.find('.sn-list').element as HTMLElement
    mockScroll(el, 300, 200, 50)
    el.dispatchEvent(new Event('scroll'))
    expect(el.classList.contains('at-end')).toBe(false)
    w.unmount()
  })

  // .at-start / .at-end 成对表达「这一边还有没有内容」，样式据此收掉该侧的淡出。
  // 不可滚动时两侧都算到头，否则一条装得下的横条会两边都留着淡出蒙版。
  it('refresh: 滚到最左时加 .at-start', async () => {
    const w = mount(TestNav)
    await nextTick()
    const el = w.find('.sn-list').element as HTMLElement
    mockScroll(el, 300, 200, 0)
    el.dispatchEvent(new Event('scroll'))
    expect(el.classList.contains('at-start')).toBe(true)
    expect(el.classList.contains('at-end')).toBe(false)
    w.unmount()
  })

  it('refresh: 离开最左后撤掉 .at-start', async () => {
    const w = mount(TestNav)
    await nextTick()
    const el = w.find('.sn-list').element as HTMLElement
    mockScroll(el, 300, 200, 20)
    el.dispatchEvent(new Event('scroll'))
    expect(el.classList.contains('at-start')).toBe(false)
    w.unmount()
  })

  it('refresh: 内容装得下时两侧都算到头（不留淡出蒙版）', async () => {
    const w = mount(TestNav)
    await nextTick()
    const el = w.find('.sn-list').element as HTMLElement
    mockScroll(el, 100, 200, 0)
    el.dispatchEvent(new Event('scroll'))
    expect(el.classList.contains('scrollable')).toBe(false)
    expect(el.classList.contains('at-start')).toBe(true)
    expect(el.classList.contains('at-end')).toBe(true)
    w.unmount()
  })

  it('onWheel: 垂直滚轮在可滚动横条上转为横向滚动并阻止默认', async () => {
    const w = mount(TestNav)
    await nextTick()
    const el = w.find('.sn-list').element as HTMLElement
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
    const el = w.find('.sn-list').element as HTMLElement
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
    const el = w.find('.sn-list').element as HTMLElement
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
    const el = w.find('.sn-list').element as HTMLElement
    mockScroll(el, 500, 200, 0)

    await (w.vm as unknown as { scrollRight: () => unknown }).scrollRight()
    await nextTick()
    expect(el.scrollLeft).toBe(200)
    w.unmount()
  })

  it('scrollRight: 不可滚动时是 no-op（scrollBy 钳位）', async () => {
    const w = mount(TestNavWithScroll)
    await nextTick()
    const el = w.find('.sn-list').element as HTMLElement
    mockScroll(el, 100, 200, 0) // scrollWidth < clientWidth → max=0

    await (w.vm as unknown as { scrollRight: () => unknown }).scrollRight()
    await nextTick()
    expect(el.scrollLeft).toBe(0)
    w.unmount()
  })

  /* ensureActiveVisible：把当前区块带进视野，只动横向轴。
     行为契约由三条用例钉住（贴边内缩 / 已可见不动 / 装得下不动）。 */

  /** 在轨道里放一条高亮项，并给它一个相对轨道的几何位置（jsdom 不做布局，手工给） */
  function setupActive(el: HTMLElement, opts: { left: number; right: number; child?: boolean }) {
    el.innerHTML = `<a class="${opts.child ? 'sn-child' : 'sn-item'} active">当前</a>`
    const item = el.querySelector('a') as HTMLElement
    el.getBoundingClientRect = () => ({ left: 0, right: 200, top: 0, bottom: 40, width: 200, height: 40 }) as DOMRect
    item.getBoundingClientRect = () =>
      ({ left: opts.left, right: opts.right, top: 0, bottom: 24, width: opts.right - opts.left, height: 24 }) as DOMRect
    return item
  }

  it('ensureActiveVisible: 高亮项在右缘外 → 向右滚到留出内缩', async () => {
    const w = mount(TestNavWithScroll)
    await nextTick()
    const el = w.find('.sn-list').element as HTMLElement
    mockScroll(el, 500, 200, 0)
    setupActive(el, { left: 260, right: 330 })

    ;(w.vm as unknown as { ensureActiveVisible: () => void }).ensureActiveVisible()
    // 内缩 20px：右缘停在 180，故位移 = 330 - 180 = 150
    expect(el.scrollLeft).toBe(150)
    w.unmount()
  })

  it('ensureActiveVisible: 高亮项在左缘外 → 向左滚到留出内缩', async () => {
    const w = mount(TestNavWithScroll)
    await nextTick()
    const el = w.find('.sn-list').element as HTMLElement
    mockScroll(el, 500, 200, 300)
    setupActive(el, { left: -120, right: -50 })

    ;(w.vm as unknown as { ensureActiveVisible: () => void }).ensureActiveVisible()
    // 左缘停在 20，故位移 = -120 - 20 = -140
    expect(el.scrollLeft).toBe(160)
    w.unmount()
  })

  it('ensureActiveVisible: 高亮项已在内缩区内 → 一点不动', async () => {
    const w = mount(TestNavWithScroll)
    await nextTick()
    const el = w.find('.sn-list').element as HTMLElement
    mockScroll(el, 500, 200, 100)
    setupActive(el, { left: 40, right: 140 })

    ;(w.vm as unknown as { ensureActiveVisible: () => void }).ensureActiveVisible()
    expect(el.scrollLeft).toBe(100)
    w.unmount()
  })

  it('ensureActiveVisible: 内容装得下时不动（无横向可滚）', async () => {
    const w = mount(TestNavWithScroll)
    await nextTick()
    const el = w.find('.sn-list').element as HTMLElement
    mockScroll(el, 100, 200, 0)
    setupActive(el, { left: 260, right: 330 })

    ;(w.vm as unknown as { ensureActiveVisible: () => void }).ensureActiveVisible()
    expect(el.scrollLeft).toBe(0)
    w.unmount()
  })

  it('ensureActiveVisible: 子项高亮时对准子项，不退回父条目', async () => {
    const w = mount(TestNavWithScroll)
    await nextTick()
    const el = w.find('.sn-list').element as HTMLElement
    mockScroll(el, 500, 200, 0)
    // 父条目在窄屏横条里同样带 active（那是给宽屏索引的高亮），子项才是真正的位置
    el.innerHTML = `<a class="sn-item active">技能招式</a>`
    const parent = el.querySelector('.sn-item') as HTMLElement
    const child = document.createElement('a')
    child.className = 'sn-child active'
    el.appendChild(child)
    el.getBoundingClientRect = () => ({ left: 0, right: 200, top: 0, bottom: 40, width: 200, height: 40 }) as DOMRect
    parent.getBoundingClientRect = () =>
      ({ left: 10, right: 90, top: 0, bottom: 24, width: 80, height: 24 }) as DOMRect
    child.getBoundingClientRect = () =>
      ({ left: 300, right: 370, top: 0, bottom: 24, width: 70, height: 24 }) as DOMRect

    ;(w.vm as unknown as { ensureActiveVisible: () => void }).ensureActiveVisible()
    expect(el.scrollLeft).toBe(190) // 370 - 180（若错认父条目则为 0）
    w.unmount()
  })

  it('ensureActiveVisible: 用户刚按过轨道（正在横滑）→ 让位不动', async () => {
    const w = mount(TestNavWithScroll)
    await nextTick()
    const el = w.find('.sn-list').element as HTMLElement
    mockScroll(el, 500, 200, 0)
    setupActive(el, { left: 260, right: 330 })

    el.dispatchEvent(new Event('pointerdown'))
    ;(w.vm as unknown as { ensureActiveVisible: () => void }).ensureActiveVisible()
    expect(el.scrollLeft).toBe(0)
    w.unmount()
  })

  it('卸载时移除滚轮事件监听', async () => {
    const w = mount(TestNav)
    await nextTick()
    const el = w.find('.sn-list').element as HTMLElement
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