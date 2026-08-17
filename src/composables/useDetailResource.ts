/* ============================================================
 * useDetailResource — 详情页数据加载（DESIGN.md P2）。
 * 包装 useAsyncResource：kind + 响应式 id（route param），
 * id 变化自动重新加载（连续导航 /agents/1 → /agents/2）。
 * ============================================================ */

import type { Ref } from 'vue'
import { api, type DataKind } from '@/data/api'
import { useAsyncResource } from './useAsyncResource'

export function useDetailResource<T>(
  kind: DataKind,
  id: Ref<string>,
) {
  return useAsyncResource(() => api.detail<T>(kind, id.value))
}
