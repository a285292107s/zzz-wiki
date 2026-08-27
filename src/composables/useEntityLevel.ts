/* ============================================================
 * useEntityLevel — 实体详情页「等级滑条」样板收敛。
 *
 * 三个详情视图（角色/音擎/邦布）此前各抄一份：
 *   level ref 默认满级 + watch(route.id) 重置 + levelMarks 刻度循环。
 * 本 composable 统一该行为：默认满级、路由条目切换时重置、
 * 生成「min 起点 + 每 10 级突破点（上限前为突破色）+ max 上限」的刻度。
 * 视图差异只剩 min/max 与可选的连带重置（如角色页连携技共享等级）。
 * ============================================================ */

import { computed, ref, watch } from 'vue'
import { useRouteParam } from './useRouteParam'

/** 突破刻度点（与 LevelSlider 的 marks 结构兼容；此处独立定义避免反向依赖组件） */
export interface LevelMark {
  at: number
  label: string
  break?: boolean
}

export function useEntityLevel(opts: {
  /** 等级下限（刻度起点） */
  min: number
  /** 等级上限（刻度终点；未显式给 default 时也是默认等级=满级） */
  max: number
  /** 默认等级，缺省取 max */
  default?: number
  /** 条目切换（route id 变化）重置主等级后的连带重置（如共享槽位等级） */
  onReset?: () => void
}) {
  const id = useRouteParam('id')
  const initial = opts.default ?? opts.max

  const level = ref(initial)

  watch(id, () => {
    level.value = initial
    opts.onReset?.()
  })

  /** 突破刻度：min 起点 + 每 10 级突破点（amber）+ max 上限（灰） */
  const levelMarks = computed<LevelMark[]>(() => {
    const marks: LevelMark[] = [{ at: opts.min, label: String(opts.min) }]
    for (let lv = 10; lv <= opts.max; lv += 10) {
      marks.push({ at: lv, label: String(lv), break: lv < opts.max })
    }
    return marks
  })

  return { level, levelMarks }
}
