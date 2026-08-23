/* ============================================================
 * useNavScrollable — 详情页吸顶横条的「可横滑」提示（移动端单行滚动模式）。
 * 检测内容是否超宽（scrollWidth > clientWidth）→ 给根元素加 .scrollable；
 * 滚动到底（at-end）时移除提示，避免“还有内容”的误导。
 * 横条条目在数据就绪后才出现：调用方须在条目就位后主动 refresh()。
 * 提示样式见 base.css .section-nav.scrollable::after（细线方钮，纸墨语言）。
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

  /* 横条条目随数据就绪后才挂载（onMounted 时 navEl 可能仍为 null）：
     监听挂接放在 navEl 变化的 watch 里，元素出现即绑定滚动监听并首测 */
  watch(
    navEl,
    (el, prev) => {
      prev?.removeEventListener('scroll', refresh)
      if (el) {
        el.addEventListener('scroll', refresh, { passive: true })
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
    window.removeEventListener('resize', refresh)
  })

  return { navEl, refresh }
}