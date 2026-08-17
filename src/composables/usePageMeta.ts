/* ============================================================
 * usePageMeta — 页面元信息（DESIGN.md §6.4）。
 * 三级：组件传入标题覆盖 → route.meta.title → 站名默认。
 * description 缺省写在 head（无则创建）。
 * ============================================================ */

import { toValue, watchEffect, type MaybeRefOrGetter } from 'vue'
import { useRoute } from 'vue-router'

const SITE = '空洞档案 · Hollow Archive'

export function usePageMeta(
  title?: MaybeRefOrGetter<string | undefined>,
  description?: MaybeRefOrGetter<string | undefined>,
): void {
  const route = useRoute()

  watchEffect(() => {
    const explicit = toValue(title)?.trim()
    const metaTitle = typeof route.meta.title === 'string' ? route.meta.title : undefined
    const page = explicit || metaTitle
    document.title = page ? `${page} · 空洞档案` : SITE

    const desc = description ? toValue(description)?.trim() : undefined
    if (desc) {
      let el = document.querySelector('meta[name="description"]')
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute('name', 'description')
        document.head.appendChild(el)
      }
      el.setAttribute('content', desc)
    }
  })
}
