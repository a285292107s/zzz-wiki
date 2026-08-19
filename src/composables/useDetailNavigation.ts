import { onBeforeUnmount, ref } from 'vue'
import type { Directive } from 'vue'
import { useRoute } from 'vue-router'

/**
 * 详情页通用区块导航：
 *  - scrollspy：滚动时高亮当前区块（配合 base.css 的 .sn-item.active）
 *  - reveal：区块滚动进入的一次性显现（尊重系统减动效）
 *  - 深链兜底：数据就绪后平滑滚动到 hash 锚点
 *
 * 用法（<script setup>）：
 *   const { activeSection, revealDir, activate } = useDetailNavigation()
 *   const vReveal = revealDir   // v 前缀大写 → Vue 自动识别为指令
 *   // 数据就绪 + nextTick 后：
 *   activate(navItems.map(n => n.id))
 */
export function useDetailNavigation() {
  const route = useRoute()
  const activeSection = ref('')
  let spy: IntersectionObserver | null = null

  /** 建立区块观察 + 处理直达 hash。需在数据就绪、DOM 已渲染后调用。 */
  function activate(ids: string[]) {
    spy?.disconnect()
    const els = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el)
    if (els.length) {
      spy = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) activeSection.value = e.target.id
          }
        },
        { rootMargin: '-35% 0px -55% 0px' },
      )
      els.forEach((el) => spy!.observe(el))
    }

    const hashId = route.hash ? route.hash.slice(1) : ''
    const hashEl = hashId ? document.getElementById(hashId) : null
    if (hashEl) {
      // 与 router scrollBehavior 一致：offsetTop 链求文档流位置（不受 reveal transform 影响），
      // 减去站头避让偏移 --anchor-offset，再平滑滚动
      let y = 0
      let node: HTMLElement | null = hashEl
      while (node && node !== document.body && node !== document.documentElement) {
        y += node.offsetTop
        node = node.offsetParent as HTMLElement | null
      }
      const offset =
        parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--anchor-offset')) || 76
      window.scrollTo({ top: y - offset, behavior: 'smooth' })
    }
  }

  onBeforeUnmount(() => spy?.disconnect())

  /** 区块滚动显现指令；系统减动效时直接跳过（保持可见） */
  const revealDir: Directive<HTMLElement> = {
    mounted(el) {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      el.classList.add('reveal')
      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            el.classList.add('revealed')
            io.disconnect()
          }
        },
        { rootMargin: '0px 0px -8% 0px' },
      )
      io.observe(el)
    },
  }

  return { activeSection, revealDir, activate }
}