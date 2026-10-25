// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useNavScrollable } from '../src/composables/useNavScrollable'

const TestNav = {
  setup() {
    const { navEl, scrollRight, ensureActiveVisible } = useNavScrollable()
    return { navEl, scrollRight, ensureActiveVisible }
  },
  template: `<div class="section-nav"><div ref="navEl" class="sn-list" /><button class="sn-scroll-btn" /></div>`,
}

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

async function mountTrack(geometry: { w: number; cw: number; sl?: number }) {
  const wrapper = mount(TestNav)
  await nextTick()
  const el = wrapper.find('.sn-list').element as HTMLElement
  mockScroll(el, geometry.w, geometry.cw, geometry.sl ?? 0)
  el.dispatchEvent(new Event('scroll'))
  return { wrapper, el }
}

function placeActive(el: HTMLElement, box: { left: number; right: number }) {
  el.innerHTML = `<a class="sn-item active">当前</a>`
  el.getBoundingClientRect = () =>
    ({ left: 0, right: 200, top: 0, bottom: 40, width: 200, height: 40 }) as DOMRect
  const item = el.querySelector('a') as HTMLElement
  item.getBoundingClientRect = () =>
    ({
      left: box.left,
      right: box.right,
      top: 0,
      bottom: 24,
      width: box.right - box.left,
      height: 24,
    }) as DOMRect
  return item
}

function ensureVisible(wrapper: ReturnType<typeof mount>) {
  ;(wrapper.vm as unknown as { ensureActiveVisible: () => void }).ensureActiveVisible()
}

describe('useNavScrollable', () => {
  it('refresh: 超宽才加 .scrollable，两端淡出标记随滚到位置成对切换', async () => {
    const wide = await mountTrack({ w: 300, cw: 200, sl: 0 })
    expect(wide.el.classList.contains('scrollable')).toBe(true)
    expect(wide.el.classList.contains('at-start')).toBe(true)
    expect(wide.el.classList.contains('at-end')).toBe(false)

    wide.el.scrollLeft = 20
    wide.el.dispatchEvent(new Event('scroll'))
    expect(wide.el.classList.contains('at-start')).toBe(false)
    expect(wide.el.classList.contains('at-end')).toBe(false)

    wide.el.scrollLeft = 100
    wide.el.dispatchEvent(new Event('scroll'))
    expect(wide.el.classList.contains('at-end')).toBe(true)
    wide.wrapper.unmount()

    const fits = await mountTrack({ w: 100, cw: 200 })
    expect(fits.el.classList.contains('scrollable')).toBe(false)
    expect(fits.el.classList.contains('at-start')).toBe(true)
    expect(fits.el.classList.contains('at-end')).toBe(true)
    fits.wrapper.unmount()
  })

  it('onWheel: 可滚动时垂直滚轮转为横滚并阻止默认；不可滚动或横向拨轮放行', async () => {
    const wide = await mountTrack({ w: 300, cw: 200, sl: 0 })
    const vertical = new WheelEvent('wheel', { deltaY: 50, bubbles: true, cancelable: true })
    const preventVertical = vi.spyOn(vertical, 'preventDefault')
    wide.el.dispatchEvent(vertical)
    expect(preventVertical).toHaveBeenCalled()
    expect(wide.el.scrollLeft).toBe(50)
    wide.wrapper.unmount()

    const fits = await mountTrack({ w: 100, cw: 200, sl: 0 })
    const onFits = new WheelEvent('wheel', { deltaY: 50, bubbles: true, cancelable: true })
    const preventFits = vi.spyOn(onFits, 'preventDefault')
    fits.el.dispatchEvent(onFits)
    expect(preventFits).not.toHaveBeenCalled()
    fits.wrapper.unmount()

    const horizontal = await mountTrack({ w: 300, cw: 200, sl: 0 })
    const pan = new WheelEvent('wheel', { deltaX: 50, deltaY: 10, bubbles: true, cancelable: true })
    const preventPan = vi.spyOn(pan, 'preventDefault')
    horizontal.el.dispatchEvent(pan)
    expect(preventPan).not.toHaveBeenCalled()
    expect(horizontal.el.scrollLeft).toBe(0)
    horizontal.wrapper.unmount()
  })

  it('ensureActiveVisible: 越界的当前项滚到留出内缩，已在内缩区内不动', async () => {
    const toRight = await mountTrack({ w: 500, cw: 200, sl: 0 })
    placeActive(toRight.el, { left: 260, right: 330 })
    ensureVisible(toRight.wrapper)
    expect(toRight.el.scrollLeft).toBe(150)
    toRight.wrapper.unmount()

    const toLeft = await mountTrack({ w: 500, cw: 200, sl: 300 })
    placeActive(toLeft.el, { left: -120, right: -50 })
    ensureVisible(toLeft.wrapper)
    expect(toLeft.el.scrollLeft).toBe(160)
    toLeft.wrapper.unmount()

    const inside = await mountTrack({ w: 500, cw: 200, sl: 100 })
    placeActive(inside.el, { left: 40, right: 140 })
    ensureVisible(inside.wrapper)
    expect(inside.el.scrollLeft).toBe(100)
    inside.wrapper.unmount()
  })

  it('ensureActiveVisible: 对准高亮子项、装得下不动、用户刚按过轨道时让位', async () => {
    const child = await mountTrack({ w: 500, cw: 200, sl: 0 })
    child.el.innerHTML = `<a class="sn-item active">技能招式</a>`
    const parent = child.el.querySelector('.sn-item') as HTMLElement
    const nested = document.createElement('a')
    nested.className = 'sn-child active'
    child.el.appendChild(nested)
    child.el.getBoundingClientRect = () =>
      ({ left: 0, right: 200, top: 0, bottom: 40, width: 200, height: 40 }) as DOMRect
    parent.getBoundingClientRect = () =>
      ({ left: 10, right: 90, top: 0, bottom: 24, width: 80, height: 24 }) as DOMRect
    nested.getBoundingClientRect = () =>
      ({ left: 300, right: 370, top: 0, bottom: 24, width: 70, height: 24 }) as DOMRect
    ensureVisible(child.wrapper)
    expect(child.el.scrollLeft).toBe(190)
    child.wrapper.unmount()

    const fits = await mountTrack({ w: 100, cw: 200, sl: 0 })
    placeActive(fits.el, { left: 260, right: 330 })
    ensureVisible(fits.wrapper)
    expect(fits.el.scrollLeft).toBe(0)
    fits.wrapper.unmount()

    const dragging = await mountTrack({ w: 500, cw: 200, sl: 0 })
    placeActive(dragging.el, { left: 260, right: 330 })
    dragging.el.dispatchEvent(new Event('pointerdown'))
    ensureVisible(dragging.wrapper)
    expect(dragging.el.scrollLeft).toBe(0)
    dragging.wrapper.unmount()
  })

  it('scrollRight 滚一个视口宽，卸载后滚轮监听已移除', async () => {
    const { wrapper, el } = await mountTrack({ w: 500, cw: 200, sl: 0 })
    await (wrapper.vm as unknown as { scrollRight: () => unknown }).scrollRight()
    await nextTick()
    expect(el.scrollLeft).toBe(200)

    wrapper.unmount()
    const afterUnmount = new WheelEvent('wheel', { deltaY: 50, bubbles: true, cancelable: true })
    const preventAfterUnmount = vi.spyOn(afterUnmount, 'preventDefault')
    el.dispatchEvent(afterUnmount)
    expect(preventAfterUnmount).not.toHaveBeenCalled()
    expect(el.scrollLeft).toBe(200)
  })
})
