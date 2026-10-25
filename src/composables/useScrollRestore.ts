import { getCurrentScope, onScopeDispose } from 'vue'
import { useRouter } from 'vue-router'

const RESTORE_TIMEOUT_MS = 2500
const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '])

let restoreTarget: ((top: number) => void) | null = null

export function restoreScrollTo(top: number): void {
  if (Number.isFinite(top) && top > 0) restoreTarget?.(top)
}

function savedScrollTop(): number | null {
  const top = (history.state as { scroll?: { top?: number } | null } | null)?.scroll?.top
  return typeof top === 'number' && Number.isFinite(top) && top > 0 ? top : null
}

export function useScrollRestore(): void {
  const router = useRouter()
  let frame = 0
  let target: number | null = null
  let deadline = 0

  function stop(): void {
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    target = null
    window.removeEventListener('wheel', stop)
    window.removeEventListener('touchmove', stop)
    window.removeEventListener('keydown', onKeydown)
  }

  function onKeydown(event: KeyboardEvent): void {
    if (SCROLL_KEYS.has(event.key)) stop()
  }

  function step(): void {
    frame = 0
    if (target === null) return
    const maxTop = document.documentElement.scrollHeight - window.innerHeight
    if (maxTop >= target - 1) {
      window.scrollTo(0, target)
      if (Math.abs(window.scrollY - target) <= 1) {
        stop()
        return
      }
    }
    if (performance.now() >= deadline) {
      window.scrollTo(0, Math.max(0, Math.min(target, maxTop)))
      stop()
      return
    }
    frame = requestAnimationFrame(step)
  }

  function restore(top: number): void {
    target = top
    deadline = performance.now() + RESTORE_TIMEOUT_MS
    window.addEventListener('wheel', stop, { passive: true })
    window.addEventListener('touchmove', stop, { passive: true })
    window.addEventListener('keydown', onKeydown)
    frame = requestAnimationFrame(step)
  }

  restoreTarget = restore

  const beforeNav = router.beforeEach(() => {
    stop()
  })

  const afterNav = router.afterEach((to, from, failure) => {
    if (failure) return
    if (to.path === from.path && to.hash === from.hash) return
    const top = savedScrollTop()
    if (top !== null) restore(top)
  })

  if (getCurrentScope()) {
    onScopeDispose(() => {
      stop()
      beforeNav()
      afterNav()
      if (restoreTarget === restore) restoreTarget = null
    })
  }
}
