/* ============================================================
 * useEntityLevel — 实体详情页「等级滑条」样板收敛。
 *
 * 三个详情视图（角色/音擎/邦布）此前各抄一份：
 *   level ref 默认满级 + watch(route.id) 重置 + levelMarks 刻度循环。
 * 本 composable 统一该行为：默认满级、路由条目切换时重置、
 * 生成「min 起点 + 每 10 级突破点（上限前为突破色）+ max 上限」的刻度。
 * 视图差异只剩 min/max 与可选的连带重置（如角色页连携技共享等级）。
 *
 * **等级深链（2026-10）**：等级同步到查询参数 `?lv=N`，使「某角色在 55 级下的
 * 面板/技能数值」成为可分享、可收藏、可引用的档案视图（与名录页筛选同步同一思路）。
 *   - 打开时读取并按 [min,max] 夹取；非法值忽略
 *   - 变更经 router.replace 写回（不增长历史；返回键回到上一页而非上一档等级）
 *   - **等于默认等级时移除该参数**，保持默认链接干净
 *   - 依赖 router 的 scrollBehavior「同路由仅 query 变化不滚动」：
 *     滑条在中段（实测 y≈1450 / 页高 8170），否则每次拖动都会被拉回页顶
 * ============================================================ */

import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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
  /** 同步用的查询参数名（默认 lv；同页第二个等级用别的名，如 clv） */
  queryKey?: string
  /** 条目切换（route id 变化）重置主等级后的连带重置（如共享槽位等级） */
  onReset?: () => void
}) {
  const id = useRouteParam('id')
  const route = useRoute()
  const router = useRouter()
  const initial = opts.default ?? opts.max
  const key = opts.queryKey ?? 'lv'

  /** 读 URL 初始等级：合法整数才采用（夹取到 [min,max]），否则用默认 */
  function fromQuery(): number {
    const raw = route.query[key]
    const n = Number(Array.isArray(raw) ? raw[0] : raw)
    if (!Number.isFinite(n) || String(raw ?? '').trim() === '') return initial
    return Math.min(opts.max, Math.max(opts.min, Math.round(n)))
  }

  const level = ref(fromQuery())

  /** 写回 URL：默认值不入参（保持干净链接），其余用 replace 不增长历史 */
  watch(level, (v) => {
    const cur = route.query[key]
    const next = { ...route.query }
    const same = v === initial
    if (same) {
      if (cur === undefined) return
      delete next[key]
    } else {
      if (String(cur) === String(v)) return
      next[key] = String(v)
    }
    void router.replace({ query: next })
  })

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
