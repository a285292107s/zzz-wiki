/* ============================================================
 * useNavScrollable — 详情页吸顶横条的「可横滑」提示与交互（窄屏单行滚动模式）。
 *  - 检测内容是否超宽（scrollWidth > clientWidth）→ 给轨道加 .scrollable
 *  - 两端位置以 .at-start / .at-end 表达，供样式把**该方向**的淡出收掉：
 *    淡出与出口按钮都只在「那一边确实还有内容」时存在，到边即消失。
 *    （AtlasView 只取 .scrollable；另两条只对吸顶横条有意义，多挂无副作用）
 *  - 鼠标滚轮在横条上时转为横向滚动（桌面端主要入口）
 *  - scrollRight() 供出口按钮点击滚屏；ensureActiveVisible() 让当前区块不滑出视野
 * 横条条目在数据就绪后才出现：调用方须在条目就位后主动 refresh()。
 * 传入的 navEl 必须是**真正滚动的那个元素**（.sn-list / .atlas-scroll），
 * 出口按钮是它的兄弟而非子节点——按钮留在轨道外，才不会压住最后一个条目。
 * 样式见 base.css 的 .sn-list / .sn-scroll-btn。
 * ============================================================ */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

/** 用户刚在轨道上按过（多半正在横滑）：此时不抢滚动，见 ensureActiveVisible */
const DRAG_QUIET_MS = 600

/** 滚动行为：尊重「减少动态效果」偏好。
 *  CSS 的全局 0.01ms 规则管不到脚本发起的平滑滚动（那不是 CSS 动画），
 *  不判断的话，开了该偏好的用户点一下出口按钮仍会看到一段横滑动画。 */
function scrollBehavior(): ScrollBehavior {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
}

export function useNavScrollable() {
  const navEl = ref<HTMLElement | null>(null)
  /** 最近一次 pointerdown 的时刻（轨道上），用于避让用户自己的横滑 */
  let lastPointerDown = 0

  function refresh() {
    const el = navEl.value
    if (!el) return
    /* 三条位置类都挂在**被 ref 的这个元素**上（调用方各自的滚动容器），
       样式在它自己或它的兄弟上取用——不回头去认某个固定祖先，
       否则同一套 composable 换个引用点就静默失效。 */
    const can = el.scrollWidth > el.clientWidth + 1
    el.classList.toggle('scrollable', can)
    // 不可滚动时两侧都算「到头」：一条装得下的横条不该在任一端留着淡出蒙版
    el.classList.toggle('at-start', !can || el.scrollLeft <= 2)
    el.classList.toggle('at-end', !can || el.scrollLeft + el.clientWidth >= el.scrollWidth - 2)
  }

  /** 鼠标滚轮在横条上时转为横向滚动（桌面端主要入口；横向拨轮让浏览器原生处理） */
  function onWheel(e: WheelEvent) {
    const el = navEl.value
    if (!el || el.scrollWidth <= el.clientWidth) return
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
    e.preventDefault()
    el.scrollLeft += e.deltaY
  }

  /** 记一次「用户正在操作轨道」：见 ensureActiveVisible 的让位规则 */
  function onPointerDown() {
    lastPointerDown = performance.now()
  }

  /** 点击出口按钮时滚动约一个视口宽 */
  function scrollRight() {
    const el = navEl.value
    if (!el) return
    el.scrollBy({ left: el.clientWidth, behavior: scrollBehavior() })
  }

  /** 滚动高亮切换时把当前区块带进视野（**只动横向这一轴**）。
   *  不做的话当前区块会停在轨道之外：靠点击跳转时浏览器只把目标滚进视野，
   *  反过来滚页面（滚动高亮）时轨道一动不动，高亮项就在屏外，等于导航失去读数。
   *  取 nearest 语义——已经看得见就一点不动，避免与用户的横滑对着干。
   *  为什么不直接 scrollIntoView：那会把**纵向**也一起动，等于页面自己跳一下。 */
  function ensureActiveVisible() {
    const el = navEl.value
    if (!el || el.scrollWidth <= el.clientWidth + 1) return
    if (performance.now() - lastPointerDown < DRAG_QUIET_MS) return
    /* 子项优先：父条目在「有子项的区块」里也带 active（父高亮是给宽屏索引看的），
       窄屏则应当对准真正的那一条。 */
    const target =
      el.querySelector<HTMLElement>('.sn-child.active') ?? el.querySelector<HTMLElement>('.sn-item.active')
    if (!target) return
    const er = el.getBoundingClientRect()
    const tr = target.getBoundingClientRect()
    // 内缩 20px：贴边停下时下划线会压在淡出蒙版里，读作「被裁掉」而不是「当前项」
    const pad = 20
    if (tr.left < er.left + pad) el.scrollBy({ left: tr.left - er.left - pad, behavior: scrollBehavior() })
    else if (tr.right > er.right - pad)
      el.scrollBy({ left: tr.right - er.right + pad, behavior: scrollBehavior() })
  }

  /* 横条条目随数据就绪后才挂载（onMounted 时 navEl 可能仍为 null）：
     监听挂接放在 navEl 变化的 watch 里，元素出现即绑定并首测 */
  watch(
    navEl,
    (el, prev) => {
      prev?.removeEventListener('scroll', refresh)
      prev?.removeEventListener('wheel', onWheel)
      prev?.removeEventListener('pointerdown', onPointerDown)
      if (el) {
        el.addEventListener('scroll', refresh, { passive: true })
        el.addEventListener('wheel', onWheel, { passive: false })
        el.addEventListener('pointerdown', onPointerDown, { passive: true })
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
    navEl.value?.removeEventListener('pointerdown', onPointerDown)
    window.removeEventListener('resize', refresh)
  })

  return { navEl, scrollRight, refresh, ensureActiveVisible }
}