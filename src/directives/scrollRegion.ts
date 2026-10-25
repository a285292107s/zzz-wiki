import type { Directive } from 'vue'

const observers = new WeakMap<HTMLElement, ResizeObserver>()

export const scrollRegion: Directive<HTMLElement, string> = {
  mounted(el, binding) {
    el.setAttribute('role', 'region')
    el.setAttribute('aria-label', binding.value)
    const sync = () => {
      if (el.scrollWidth > el.clientWidth + 1) el.setAttribute('tabindex', '0')
      else el.removeAttribute('tabindex')
    }
    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(el)
    observers.set(el, observer)
  },
  unmounted(el) {
    observers.get(el)?.disconnect()
    observers.delete(el)
  },
}
