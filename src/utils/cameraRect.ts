/* ============================================================
 * cameraRect — 校准工具：全景图上的 9:16「相机矩形」与 (pos, zoom, originY) 的双向映射。
 * 该矩形精确等于 object-fit:cover + object-position + transform:scale/originY 渲染出的源图局部
 * （与 IMG_GUIDE.md 结论一致）：拖框=挪 pos/originY、缩放框=改 zoom。纯函数，可单测（DESIGN.md §8）。
 * 注意：本模块 pos/originY 用**数值百分比**（0–100）；写入 JSON 时 pos 再格式化为 'NN%'。
 * ============================================================ */

const ASPECT = 9 / 16

export interface CameraRect {
  cx: number
  cy: number
  w: number
  h: number
}

export const ZOOM_MIN = 0.4
export const ZOOM_MAX = 3

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

/** 由构图参数（数值百分比）计算源图上的 9:16 相机矩形（中心 + 尺寸，源图像素坐标）。 */
export function rectFromParams(pos: number, zoom: number, originY: number, W: number, H: number): CameraRect {
  const h = H / Math.max(zoom, ZOOM_MIN)
  const w = h * ASPECT
  const p = pos / 100
  const cx = ASPECT * (0.5 - p) * H + W * p
  const cy = (originY / 100) * H
  return { cx, cy, w, h }
}

/** 由相机矩形反推构图参数（保持 9:16；pos/originY 限 0–100，zoom 限 ZOOM_MIN–ZOOM_MAX）。 */
export function paramsFromRect(
  r: CameraRect,
  W: number,
  H: number,
): { pos: number; zoom: number; originY: number } {
  const h = Math.max(r.w / ASPECT, 1)
  const zoom = clamp(H / h, ZOOM_MIN, ZOOM_MAX)
  const p = (r.cx - (ASPECT / 2) * H) / (W - ASPECT * H)
  const pos = clamp(Number.isFinite(p) ? p * 100 : 50, 0, 100)
  const originY = clamp((r.cy / H) * 100, 0, 100)
  return { pos: Math.round(pos), zoom, originY: Math.round(originY * 10) / 10 }
}

/** 把数值 pos 格式化为 object-position 字符串（'NN%'）。 */
export function formatPos(pos: number): string {
  return `${Math.round(pos)}%`
}
