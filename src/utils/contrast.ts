/* ============================================================
   WCAG 对比度计算（纯函数，供 StyleGuideView 色彩标尺使用）
   零依赖；非 6 位 hex 输入返回 null（不判级，如 rgba / var()）
   ============================================================ */

const HEX_RE = /^#[0-9a-fA-F]{6}$/

/** sRGB 单通道 → 线性亮度 */
function channel(v: number): number {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/** 相对亮度（WCAG 2.x） */
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  )
}

/** 对比度 A:B（≥1）；非 hex 输入返回 null */
export function contrastRatio(a: string, b: string): number | null {
  if (!HEX_RE.test(a) || !HEX_RE.test(b)) return null
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return Number(((l1 + 0.05) / (l2 + 0.05)).toFixed(2))
}