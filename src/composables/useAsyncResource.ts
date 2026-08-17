/* ============================================================
 * useAsyncResource — 统一异步状态机（DESIGN.md §6.1）。
 * 收编视图里手写的 loaded/error/loading 三件套。
 * watchEffect 追踪 fetcher 内的响应式依赖：详情页读路由参数时
 * 参数变化自动 reload（配合 useRouteParam）。
 * ============================================================ */

import { onUnmounted, ref, watchEffect, type Ref } from 'vue'

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error'

export function useAsyncResource<T>(fetcher: () => Promise<T>, immediate = true) {
  const data = ref<T | null>(null) as Ref<T | null>
  const status = ref<AsyncStatus>('idle')
  const error = ref<string | null>(null)
  let seq = 0

  async function load() {
    const run = ++seq
    status.value = 'loading'
    error.value = null
    try {
      const d = await fetcher()
      if (run === seq) {
        data.value = d
        status.value = 'success'
      }
    } catch (e) {
      if (run === seq) {
        error.value = e instanceof Error ? e.message : String(e)
        status.value = 'error'
      }
    }
  }

  if (immediate) {
    watchEffect(() => {
      load()
    })
    onUnmounted(() => {
      seq++ // 取消挂载后的延迟 resolve
    })
  }

  return { data, status, error, reload: load }
}
