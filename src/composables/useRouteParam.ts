/* ============================================================
 * useRouteParam — 路由参数响应式化（DESIGN.md §6.1）。
 * 详情页在 watchEffect/useAsyncResource 中读取此返回值，
 * 连续导航同一组件时（/agents/1 → /agents/2）自动重新加载。
 * ============================================================ */

import { computed } from 'vue'
import { useRoute } from 'vue-router'

export function useRouteParam(name: string) {
  const route = useRoute()
  return computed(() => String(route.params[name] ?? ''))
}
