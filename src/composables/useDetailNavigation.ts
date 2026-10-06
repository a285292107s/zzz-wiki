import { onBeforeUnmount, ref } from 'vue'
import { useRoute } from 'vue-router'
import { NAV_SLOP, resolveActiveSection } from '@/domain/scrollspy'
import { reveal } from '@/directives/reveal'
import { resetAnchorOffset, resolveAnchorOffset } from './anchorOffset'

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
  let ids: string[] = []

  /** 滚动判定当前区块：视口上部最近的区块为高亮目标。
   *  不用 IO 固定观察带（-35%/-55%）——小区块（如档案详情）按 hash 跳转后
   *  顶部恰停在锚点停靠位（--anchor-offset，76/132px），远在 35%~45% 视口带之上，
   *  IO 永不命中，高亮会顺延到下一区块（点击 01 却亮 02）。
   *  偏移取吸顶横条实际高度（anchorOffset，单行恒定），与 router scrollBehavior 同源。
   *  判定规则本体在 domain/scrollspy（纯函数，单测见 tests/scrollspy.test.ts）。
   *  量取合并进 rAF：scroll 事件可一帧多次，逐事件 getBoundingClientRect（每区块一次）
   *  会形成 Lighthouse 所指的 forced reflow；rAF 后每帧至多量取一轮。 */
  let rafPending = false
  function onScroll() {
    if (rafPending) return
    rafPending = true
    requestAnimationFrame(() => {
      rafPending = false
      const offset = resolveAnchorOffset()
      const tops = ids.map((id) => {
        const el = document.getElementById(id)
        return { id, top: el ? el.getBoundingClientRect().top : null }
      })
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
      activeSection.value = resolveActiveSection(tops, atBottom, offset + NAV_SLOP) ?? ''
    })
  }

  /** 建立区块滚动判定 + 处理直达 hash。需在数据就绪、DOM 已渲染后调用。 */
  function activate(ids_: string[]) {
    // 幂等：重复调用先摘旧监听，避免累积
    document.removeEventListener('scroll', onScroll)
    ids = ids_
    // 横条条目随区块就位，锚点偏移的缓存失效重测
    resetAnchorOffset()
    onScroll()
    document.addEventListener('scroll', onScroll, { passive: true })

    const hashId = route.hash ? route.hash.slice(1) : ''
    const hashEl = hashId ? document.getElementById(hashId) : null
    if (hashEl) {
      // 与 router scrollBehavior 一致：offsetTop 链求文档流位置（不受 reveal transform 影响），
      // 减去横条实际高度（anchorOffset，单行恒定），再平滑滚动
      let y = 0
      let node: HTMLElement | null = hashEl
      while (node && node !== document.body && node !== document.documentElement) {
        y += node.offsetTop
        node = node.offsetParent as HTMLElement | null
      }
      window.scrollTo({ top: y - resolveAnchorOffset(), behavior: 'smooth' })
    }
  }

  onBeforeUnmount(() => {
    document.removeEventListener('scroll', onScroll)
  })

  /** 区块滚动显现指令：全局 v-reveal（src/directives/reveal.ts）的引用别名 */
  const revealDir = reveal

  return { activeSection, revealDir, activate }
}