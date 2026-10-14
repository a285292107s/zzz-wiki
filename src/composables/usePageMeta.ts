/* ============================================================
 * usePageMeta — 页面元信息（DESIGN.md §6.4）。
 * 三级：组件传入标题覆盖 → route.meta.title → 站名默认。
 * description 缺省写在 head（无则创建）。
 *
 * 标题三语化（决策记录 0011）：route.meta.title 是四语 `Loc`（类目/板块名，单一事实源），
 * 组件传入的标题是自己算好的**当前语言**文本（如详情页的角色名）。两者都在这里按
 * `useLocale` 的语言解析，故切换语言会即时改标签页标题。
 * 局限：静态 HTML 与 sitemap 是构建期生成的，仍是中文（见决策记录 0011「代价」）。
 * ============================================================ */

import { toValue, watchEffect, type MaybeRefOrGetter } from 'vue'
import { useRoute } from 'vue-router'
import { isLoc, pickText } from '@/domain/lang'
import { useUiText } from '@/composables/useUiText'
import { useLocale } from '@/composables/useLocale'

/** 部署 origin：构建期注入（Vercel 生产域），开发/预览回退当前 location。 */
const SITE_ORIGIN =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SITE_ORIGIN) ||
  (typeof location !== 'undefined' ? location.origin : '')

export function usePageMeta(
  title?: MaybeRefOrGetter<string | undefined>,
  description?: MaybeRefOrGetter<string | undefined>,
): void {
  const route = useRoute()
  const { lang } = useLocale()
  const { t } = useUiText()

  watchEffect(() => {
    const explicit = toValue(title)?.trim()
    const rawMeta = route.meta.title
    const metaTitle =
      typeof rawMeta === 'string' ? rawMeta : isLoc(rawMeta) ? pickText(rawMeta, lang.value) : undefined
    const page = explicit || metaTitle
    document.title = page ? `${page} · ${t.value.meta.siteName}` : t.value.meta.siteTitle

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
