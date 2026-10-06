import { onBeforeUnmount, ref, type Ref } from 'vue'

/**
 * useCopyLink — 复制当前页面 URL（含筛选/等级等查询状态）到剪贴板，并给出短暂反馈。
 *
 * 用途：站点把「视图状态」写进 URL（名录筛选/搜索、详情页等级），这些链接可分享；
 * 但地址栏里的状态对用户是隐形的——需要一个显式的「复制链接」动作把它交出去。
 *
 * 细节：
 * - 非安全上下文（http 非 localhost）或无 clipboard API 时降级：不抛错、反馈失败
 * - 反馈 1.6s 后自动复位；组件卸载时清定时器（避免对已卸载组件写状态）
 */
export function useCopyLink(): { copied: Ref<boolean>; failed: Ref<boolean>; copy: () => Promise<void> } {
  const copied = ref(false)
  const failed = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  async function copy(): Promise<void> {
    const url = location.href
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(url)
      copied.value = true
      failed.value = false
    } catch {
      failed.value = true
      copied.value = false
    }
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      copied.value = false
      failed.value = false
    }, 1600)
  }

  onBeforeUnmount(() => {
    if (timer) clearTimeout(timer)
  })

  return { copied, failed, copy }
}
