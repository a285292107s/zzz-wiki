/* ============================================================
 * deckGesture — 横向牌堆（首页「今日角色」）的拖拽/吸附纯逻辑。
 *
 * 只做数字：跟手位移、越界阻尼、松手吸附判定。DOM、指针捕获、过渡开关都在
 * FeaturedDeck.vue 里，故本文件可单测（settleIndex / followWithRubber 等）。
 * 手感对齐 flutter PageView：跟手 1:1，越界阻尼，松手吸附到最近一张。
 * ============================================================ */

/** 拖拽意图判定阈值（px）：小于此位移不出手，让页面纵向滚动照常工作 */
export const DRAG_INTENT_PX = 10

/** 吸附槽位：0 .. lastIndex */
export function lastIndexOf(count: number): number {
  return Math.max(0, count - 1)
}

export function clampIndex(index: number, count: number): number {
  if (Number.isNaN(index)) return 0
  return Math.min(lastIndexOf(count), Math.max(0, index))
}

/** 越界阻尼：两端之外按 0.35 系数跟手，给出「到头了」的明确手感又不硬顶 */
export function followWithRubber(pos: number, count: number): number {
  const last = lastIndexOf(count)
  if (pos < 0) return pos * 0.35
  if (pos > last) return last + (pos - last) * 0.35
  return pos
}

/**
 * 吸附槽位：以「起始槽位 + 归一化拖动比例」判定。
 *
 * 与「按当前可视位移四舍五入」的朴素做法区别在**长距离快拖**：越界阻尼会压扁过冲量，
 * 用位移反推就永远跳不到两端（拖过最后一张也不会翻页）。故这里直接用
 * draggedPx / stride 量出「实际拖过了几张」，再四舍五入 —— 快拖与慢拖一致。
 *
 * @param fromIndex 按下时的槽位
 * @param draggedPx 松手时的位移（向右为正）
 */
export function settleIndex(
  fromIndex: number,
  draggedPx: number,
  cardStride: number,
  count: number,
): number {
  const stride = cardStride > 0 ? cardStride : 1
  return clampIndex(Math.round(fromIndex - draggedPx / stride), count)
}

/** 是否算「拖动过」：超过意图阈值即抑制尾随的 click，避免拖完松手误跳详情 */
export function isDragGesture(maxMovedPx: number): boolean {
  return maxMovedPx > DRAG_INTENT_PX
}
