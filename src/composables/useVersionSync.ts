/* ============================================================
 * useVersionSync — 数据版本与 URL 双向同步（DESIGN.md §6.1）。
 * 把当前数据版本（live/latest）写入 query 参数 ?ver=…，任何时刻
 * 复制地址栏都能让分享对象看到同一档数据：
 *   - URL → 状态：分享链接直达、浏览器前进/后退、手动编辑地址时
 *     采纳 URL 给出的合法档位；缺失/非法则由本地持久化偏好兜底。
 *   - 状态 → URL：切换版本回写 URL；站内导航（主导航 RouterLink
 *     默认丢弃 query）后自动补回版本参数，保证地址始终可分享。
 * 采用 replace 不产生历史记录；保留其余 query 与 hash 锚点。
 * ============================================================ */

import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { dataVersion, setDataVersion, type DataVersion } from '@/data/api'

/** URL query 中的版本参数名（?ver=live|latest） */
export const VERSION_QUERY_KEY = 'ver'

export function useVersionSync() {
  const route = useRoute()
  const router = useRouter()

  /** 仅采纳合法档位；缺失/非法返回 null */
  const parseVer = (value: unknown): DataVersion | null =>
    value === 'live' || value === 'latest' ? value : null

  // URL → 状态：只有 URL 明确给出合法档位时才采用
  const syncFromUrl = (ver: unknown) => {
    const v = parseVer(ver)
    if (v) setDataVersion(v)
  }

  // 状态 → URL：URL 已一致则跳过（避免无谓导航）
  const syncToUrl = () => {
    if (parseVer(route.query.ver) === dataVersion.value) return
    void router.replace({
      query: { ...route.query, [VERSION_QUERY_KEY]: dataVersion.value },
      hash: route.hash,
    })
  }

  // 首航就绪后做一次对账：先采纳 URL 的版本，再按状态补齐参数
  //（无参地址如首页也会带上 ?ver=…，复制即分享当前档位）
  void router.isReady().then(() => {
    syncFromUrl(route.query.ver)
    syncToUrl()
  })
  watch(() => route.query.ver, syncFromUrl)
  watch(dataVersion, syncToUrl)
  // 站内导航丢失版本参数时补回（导航链路由 path 派生，不带 query）
  watch(
    () => route.fullPath,
    () => {
      if (!parseVer(route.query.ver)) syncToUrl()
    },
  )
}