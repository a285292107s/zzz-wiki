/* ============================================================
 * scrollspy — 详情页区块滚动高亮判定（纯函数，无 DOM 依赖）。
 * useDetailNavigation 读取 DOM 后把「区块顶序列 + 是否触底」交给
 * 本模块解析当前区块 id，判定规则可单测（tests/scrollspy.test.ts）。
 * ============================================================ */

/** 判定松弛：区块顶 ≤ 锚点停靠位 + 此值 才视为「当前区块」（与 FormulasView 同语义） */
export const NAV_SLOP = 80

/** 区块顶相对视口的位置；元素缺失时为 null（跳过，不参与判定） */
export interface SectionTop {
  id: string
  top: number | null
}

/**
 * 滚动高亮判定：返回当前区块 id。
 * - 已到物理底部：直接取末项——末块往往够不到锚点停靠位（滚动上限早于
 *   offsetTop - 锚点偏移），按线内最晚项会顺延到倒数第二块。
 * - 否则：取「顶部 ≤ limit 的最晚项」（文档序 = tops 序）；无任何项进线
 *   时保持首项（页面顶部 / 大空隙中的语义锚点）。
 * 约束：tops 末项须为顶层区块（不带子锚点展开）——底部特判直接点亮它，
 * 若未来末项带 children 需改为取最后一个无子锚点的顶层项。
 */
export function resolveActiveSection(
  tops: SectionTop[],
  atBottom: boolean,
  limit: number,
): string | null {
  if (!tops.length) return null
  if (atBottom) return tops[tops.length - 1].id
  let cur: string | null = tops[0].id
  for (const s of tops) {
    if (s.top != null && s.top <= limit) cur = s.id
  }
  return cur
}