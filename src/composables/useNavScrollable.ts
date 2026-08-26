/* ============================================================
 * useNavScrollable — 详情页吸顶横条的「可横滑」提示与交互（窄屏单行滚动模式）。
 *  - 检测内容是否超宽（scrollWidth > clientWidth）→ 给根元素加 .scrollable
 *  - 滚动到底（at-end）时移除提示，避免"还有内容"的误导
 *  - 鼠标滚轮在横条上时转为横向滚动（桌面端主要入口）
 *  - 提供 scrollRight() 供「→」按钮点击滚屏
 * 横条条目在数据就绪后才出现：调用方须在条目就位后主动 refresh()。
 * 提示按钮样式见 base.css .section-nav .sn-scroll-btn。
 * ============================================================ */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

export function useNavScrollable() {
  const navEl = ref<HTMLElement | null>(null)

  function refresh() {
    const el = navEl.value
    if (!el) return
    const can = el.scrollWidth > el.clientWidth + 1
    el.classList.toggle('scrollable', can)
    if (can) {
      el.classList.toggle('at-end', el.scrollLeft + el.clientWidth >= el.scrollWidth - 2)
    } else {
      el.classList.remove('at-end')
    }
  }

  /** 鼠标滚轮在横条上时转为横向滚动（桌面端主要入口；横向拨轮让浏览器原生处理） */
  function onWheel(e: WheelEvent) {
    const el = navEl.value
    if (!el || el.scrollWidth <= el.clientWidth) return
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
    e.preventDefault()
    el.scrollLeft += e.deltaY
  }

  /** 点击「→」按钮时平滑滚动一个视口宽 */
  function scrollRight() {
    const el = navEl.value
    if (!el) return
    el.scrollBy({ left: el.clientWidth, behavior: 'smooth' })
  }

  /* 横条条目随数据就绪后才挂载（onMounted 时 navEl 可能仍为 null）：
     监听挂接放在 navEl 变化的 watch 里，元素出现即绑定并首测 */
  watch(
    navEl,
    (el, prev) => {
      prev?.removeEventListener('scroll', refresh)
      prev?.removeEventListener('wheel', onWheel)
      if (el) {
        el.addEventListener('scroll', refresh, { passive: true })
        el.addEventListener('wheel', onWheel, { passive: false })
        refresh()
      }
    },
    { flush: 'post' },
  )

  onMounted(() => {
    window.addEventListener('resize', refresh, { passive: true })
    refresh()
  })

  onBeforeUnmount(() => {
    navEl.value?.removeEventListener('scroll', refresh)
    navEl.value?.removeEventListener('wheel', onWheel)
    window.removeEventListener('resize', refresh)
  })

  return { navEl, scrollRight, refresh }
}