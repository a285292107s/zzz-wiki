export interface CameraRect {
  cx: number
  cy: number
  w: number
  h: number
}

export interface Framing {
  pos: string
  posY: string
  zoom: number
  originY: number
  flipH?: boolean
}

/** 常规校准模式（画幅比升序）。hero＝详情页桌面横幅的版式画幅（非标准比例，见 IMG_GUIDE.md）。 */
export const FRAMING_MODES = [
  { key: '9:16', aspect: 9 / 16 },
  { key: '3:4', aspect: 3 / 4 },
  { key: '1:1', aspect: 1 },
  { key: '4:3', aspect: 4 / 3 },
  { key: '16:9', aspect: 16 / 9 },
  { key: 'hero', aspect: 2.8 },
] as const

export type FramingMode = (typeof FRAMING_MODES)[number]['key']

export const DEFAULT_FRAMING: Framing = { pos: '50%', posY: '50%', zoom: 1, originY: 50 }

export const ZOOM_MIN = 1
export const ZOOM_MAX = 3

export function framingTransform(f: Pick<Framing, 'zoom' | 'flipH'>): string {
  return `scale(${f.zoom}) scaleX(${f.flipH ? -1 : 1})`
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)
const round4 = (v: number) => Math.round(v * 1e4) / 1e4
const pct = (v: number) => `${Math.round(v)}%`
/** 百分比字符串 → 0–100 数值（'0%' 必须保留为 0，不能用 `||` 兜底）。 */
const pctValue = (s: string, fallback: number) => {
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : fallback
}

/** 模式 → 画幅比（未知模式回落到 9:16，数据未到位时安全）。 */
export function modeAspect(mode: string | undefined): number {
  return (FRAMING_MODES.find((m) => m.key === mode) ?? FRAMING_MODES[0]!).aspect
}

/** 由取景参数计算源图上的相机窗口（窗口比例＝画幅比，且恒在源图内）。 */
export function rectFromFraming(framing: Framing, W: number, H: number, mode: FramingMode): CameraRect {
  const A = modeAspect(mode)
  const z = clamp(framing.zoom, ZOOM_MIN, ZOOM_MAX)
  const p = clamp(pctValue(framing.pos, 50), 0, 100) / 100
  const q = clamp(pctValue(framing.posY, 50), 0, 100) / 100
  const a = clamp(framing.originY, 0, 100) / 100
  if (W / H >= A) {
    const h = H / z
    const w = h * A
    const cx = clamp(A * (0.5 - p) * H + W * p, w / 2, W - w / 2)
    const cy = clamp((H * (a * (2 - 1 / z) + (1 - a) / z)) / 2, h / 2, H - h / 2)
    return { cx, cy, w, h }
  }
  const w = W / z
  const h = w / A
  const cy = clamp(h * z * a + h * (0.5 - a) + (H - h * z) * q, h / 2, H - h / 2)
  return { cx: W / 2, cy, w, h }
}

/** 由相机窗口反推取景参数（窗口比例须＝画幅比）。 */
export function framingFromRect(r: CameraRect, W: number, H: number, mode: FramingMode): Framing {
  const A = modeAspect(mode)
  if (W / H >= A) {
    const z = clamp(H / r.h, ZOOM_MIN, ZOOM_MAX)
    const span = W - A * H
    const pos = Math.abs(span) < 1e-6 ? 50 : clamp((r.cx - (A / 2) * H) / span, 0, 1) * 100
    const denom = 2 * (1 - 1 / z)
    const a = Math.abs(denom) < 1e-6 ? 0.5 : (2 * r.cy / H - 1 / z) / denom
    return {
      pos: pct(pos),
      posY: '50%',
      zoom: round4(z),
      originY: Math.round(clamp(a * 100, 0, 100) * 10) / 10,
    }
  }
  const z = clamp(W / r.w, ZOOM_MIN, ZOOM_MAX)
  const h = W / (A * z)
  const q = clamp((r.cy - (h * z) / 2) / (H - h * z), 0, 1)
  return { pos: '50%', posY: pct(q * 100), zoom: round4(z), originY: 50 }
}

/** 母版窗口（通常是 9:16 卡片）→ 目标画幅的初始取景：把母版整块收进同画幅的新窗口，
 *  横向按母版中心居中；纵向装得下就居中、装不下则保住母版上缘（头部）。 */
export function deriveFraming(master: CameraRect, W: number, H: number, mode: FramingMode): Framing {
  const A = modeAspect(mode)
  let w = Math.max(master.w, A * master.h)
  let h = w / A
  if (W / H >= A ? h > H : w > W) {
    w = W / H >= A ? A * H : W
    h = w / A
  }
  const cx = clamp(master.cx, w / 2, W - w / 2)
  const cy = clamp(
    h >= master.h ? master.cy : master.cy - master.h / 2 + h / 2 - 0.02 * h,
    h / 2,
    H - h / 2,
  )
  return framingFromRect({ cx, cy, w, h }, W, H, mode)
}

/** 详情页 hero 的初始取景：画幅已由版式定死，只做「cover 平移」——不缩放（zoom 恒 1），
 *  横向对准母版中心、纵向装不下母版时保住上缘。 */
export function deriveHeroFraming(master: CameraRect, W: number, H: number): Framing {
  const A = modeAspect('hero')
  const fullWidth = W / H < A
  const w = fullWidth ? W : A * H
  const h = w / A
  const cx = fullWidth ? W / 2 : clamp(master.cx, w / 2, W - w / 2)
  const cy = clamp(
    h >= master.h ? master.cy : master.cy - master.h / 2 + h / 2 - 0.02 * h,
    h / 2,
    H - h / 2,
  )
  return framingFromRect({ cx, cy, w, h }, W, H, 'hero')
}
