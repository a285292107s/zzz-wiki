/* ============================================================
 * usePageMeta — 页面元信息（DESIGN.md §6.4）。
 * 三级：组件传入标题覆盖 → route.meta.title → 站名默认。
 * description 缺省写在 head（无则创建）。
 * ============================================================ */

import { toValue, watchEffect, type MaybeRefOrGetter } from 'vue'
import { useRoute } from 'vue-router'

const SITE = '绳网档案 · Ropeweb Archive'

/** 部署 origin：构建期注入（Vercel 生产域），开发/预览回退当前 location。 */
const SITE_ORIGIN =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SITE_ORIGIN) ||
  (typeof location !== 'undefined' ? location.origin : '')

export function usePageMeta(
  title?: MaybeRefOrGetter<string | undefined>,
  description?: MaybeRefOrGetter<string | undefined>,
): void {
  const route = useRoute()

  watchEffect(() => {
    const explicit = toValue(title)?.trim()
    const metaTitle = typeof route.meta.title === 'string' ? route.meta.title : undefined
    const page = explicit || metaTitle
    document.title = page ? `${page} · 绳网档案` : SITE

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

    // canonical + og:url：随路由路径更新（SPA 各路由共用一份 head，须逐路由覆写）
    const path = route.path === '/' ? '/' : route.path
    const url = `${SITE_ORIGIN}${path}`
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.setAttribute('rel', 'canonical')
      document.head.appendChild(canonical)
    }
    canonical.setAttribute('href', url)
    let ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]')
    if (!ogUrl) {
      ogUrl = document.createElement('meta')
      ogUrl.setAttribute('property', 'og:url')
      document.head.appendChild(ogUrl)
    }
    ogUrl.setAttribute('content', url)
  })
}
