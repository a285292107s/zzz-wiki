import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

/**
 * useMediaQuery — 响应式媒体查询（窄屏分支选择等场景）。
 *
 * 关键点：**在 setup 期同步求值**（而非 onMounted 后），首个渲染帧就拿到正确值——
 * 否则依赖它的资源（如 hero 图候选链）会先按桌面分支请求一次、挂载后再切窄屏分支，
 * 造成同一图两次下载。挂载后仅注册 change 监听跟随视口变化。
 *
 * SSR/无 window 环境回落 false。
 */
export function useMediaQuery(query: string): Ref<boolean> {
  const supported = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  const matches = ref(supported ? window.matchMedia(query).matches : false)

  onMounted(() => {
    if (!supported) return
    const mq = window.matchMedia(query)
    matches.value = mq.matches // 与 setup 期求值之间可能已变化，挂载时校正一次
    const onChange = (e: MediaQueryListEvent) => {
      matches.value = e.matches
    }
    mq.addEventListener('change', onChange)
    onBeforeUnmount(() => mq.removeEventListener('change', onChange))
  })

  return matches
}
