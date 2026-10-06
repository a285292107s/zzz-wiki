import type { Directive } from 'vue'

/**
 * v-reveal：滚动进入的一次性显现（全站单一事实源，详情页区块 / 首页 / 名录页共用）。
 *
 * - 可选数字绑定 = 过渡延迟毫秒（v-reveal="120"）：列表与卡片的错峰编排用，
 *   经 --reveal-delay 传入 base.css 的 .reveal 过渡简写（只作用于 opacity/transform，
 *   不污染元素自身的 hover transition）。
 * - 系统减动效（prefers-reduced-motion: reduce）时为 no-op：不加类、保持可见。
 * - 显现过渡结束后摘除 reveal/revealed 类并清掉延迟变量：把 transition 完整交还
 *   元素自身样式（卡片 hover 背景等），同时消除 transform 残留对几何测量的污染。
 */
export const reveal: Directive<HTMLElement, number | undefined> = {
  mounted(el, binding) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    el.classList.add('reveal')
    const delay = typeof binding.value === 'number' && binding.value > 0 ? binding.value : 0
    if (delay) el.style.setProperty('--reveal-delay', `${delay}ms`)

    let settled = false
    const settle = () => {
      if (settled) return
      settled = true
      el.classList.remove('reveal', 'revealed')
      if (delay) el.style.removeProperty('--reveal-delay')
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        io.disconnect()
        el.classList.add('revealed')
        // transitionend 打头，setTimeout 兜底（过渡被打断 / 0.01ms 减动效降级时不触发）
        el.addEventListener('transitionend', settle, { once: true })
        setTimeout(settle, 520 + delay)
      },
      { rootMargin: '0px 0px -8% 0px' },
    )
    io.observe(el)
  },
}
