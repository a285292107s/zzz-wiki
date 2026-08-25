/* ============================================================
 * cameraRect — 校准工具：全景图上的 9:16「相机矩形」与 (pos, zoom, originY) 的双向映射。
 * 该矩形精确等于 object-fit:cover + object-position + transform:scale/originY 渲染出的源图局部
 * （与 IMG_GUIDE.md 结论一致）：拖框=挪 pos/originY、缩放框=改 zoom。纯函数，可单测（DESIGN.md §8）。
 * 注意：变换原点≠显示区域中心（除非 originY=50%）。本模块计算的是**显示区域**的真实中心/尺寸，
 * 保证取景框与成品预览一致。pos/originY 用数值百分比（0–100）；写入 JSON 时 pos 再格式化为 'NN%'。
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

/** 由构图参数（数值百分比）计算源图上的 9:16 相机矩形（中心 + 尺寸，源图像素坐标）。
 *  pos 允许略超 0–100（因 transform 中心缩放使边缘需越界才能贴到图缘），故将矩形钳制在图内。 */
export function rectFromParams(pos: number, zoom: number, originY: number, W: number, H: number): CameraRect {
  const z = Math.max(zoom, ZOOM_MIN)
  const h = H / z
  const w = h * ASPECT
  const p = pos / 100
  const a = originY / 100
  // 水平中心：对齐到 box 中心（object-position），与变换原点 X(50%) 一致；再钳到图内
  const cx = clamp(ASPECT * (0.5 - p) * H + W * p, w / 2, W - w / 2)
  // 垂直中心：显示区域中心 ≠ 变换原点（除非 a=0.5）；由源图高度 + 缩放推出；再钳到图内
  const cy = clamp((H * (a * (2 - 1 / z) + (1 - a) / z)) / 2, h / 2, H - h / 2)
  return { cx, cy, w, h }
}

/** 由相机矩形反推构图参数（保持 9:16；pos 允许略超 0–100，originY 限 0–100，zoom 限 ZOOM_MIN–ZOOM_MAX）。 */
export function paramsFromRect(
  r: CameraRect,
  W: number,
  H: number,
): { pos: number; zoom: number; originY: number } {
  const h = Math.max(r.h, 1)
  const z = clamp(H / h, ZOOM_MIN, ZOOM_MAX)
  // originY：cy = H*(a*(2-1/z)+(1-a)/z)/2 反解出 a
  const denom = 2 * (1 - 1 / z)
  const a = Math.abs(denom) < 1e-6 ? 0.5 : (2 * r.cy / H - 1 / z) / denom
  const originY = clamp(a * 100, 0, 100)
  // pos：cx = ASPECT*(0.5-p)*H + W*p 反解出 p（放宽到 -15..115，允许贴边）
  const p = (r.cx - (ASPECT / 2) * H) / (W - ASPECT * H)
  const pos = clamp(Number.isFinite(p) ? p * 100 : 50, -15, 115)
  return { pos: Math.round(pos * 10) / 10, zoom: z, originY: Math.round(originY * 10) / 10 }
}

/** 把数值 pos 格式化为 object-position 字符串（'NN%'）。 */
export function formatPos(pos: number): string {
  return `${Math.round(pos)}%`
}
