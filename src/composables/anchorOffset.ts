/* ============================================================
 * anchorOffset — 详情页锚点停靠偏移的动态解析（单一函数）。
 * 组成：站头 62px + 吸顶横条（.section-nav）实际高度 + 14px 间隙；
 * 宽屏时横条是脱离文档流的 fixed 侧栏，直接返回 76。
 * 消费方：router scrollBehavior / useDetailNavigation / FormulasView。
 * 宽屏判定用「横条 layout 语义」（position: fixed）而非媒体查询数值——
 * base.css 断点调整时无需同步本文件（避免断点双份事实）。
 * 高度在滚动中不变：首度量后缓存，resize / 数据就绪（reset）时失效。
 * ============================================================ */

let cached: number | null = null

function measure(): number {
  if (typeof window === 'undefined') return 76
  const nav = document.querySelector<HTMLElement>('.section-nav')
  if (!nav) {
    // 无横条（列表页等）：回落 CSS 变量（base.css 单一来源）
    const v = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--anchor-offset'),
    )
    return Number.isFinite(v) && v > 0 ? v : 76
  }
  // 宽屏：横条是 fixed 侧栏（不占文档流），量测会误取整栏高度，不参与页头避让
  if (getComputedStyle(nav).position === 'fixed') return 76
  return 62 + nav.getBoundingClientRect().height + 14
}

export function resolveAnchorOffset(): number {
  if (cached == null) cached = measure()
  return cached
}

/** 缓存失效：详情数据就绪（横条条目随区块就位）或视口尺寸变化后调用 */
export function resetAnchorOffset(): void {
  cached = null
}

if (typeof window !== 'undefined') {
  window.addEventListener('resize', resetAnchorOffset, { passive: true })
}