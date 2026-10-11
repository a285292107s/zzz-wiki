import { createApp } from 'vue'
import { inject } from '@vercel/analytics'
import App from './App.vue'
import { router } from './router'
import { reveal } from './directives/reveal'
import { installViewTransition } from './utils/viewTransition'
import './styles/base.css'

/* ============================================================
 * 富文本键位图标降级（rich.ts 生成 <img class="rich-key" data-cdn=…>）
 * 本地图片缺失 → 切 data-cdn（nanoka CDN）→ 仍失败 → 替换为
 * .rich-key-broken 虚线方框占位。img 的 error 不冒泡，需捕获阶段监听。
 * ============================================================ */
document.addEventListener(
  'error',
  (e) => {
    const img = e.target
    if (!(img instanceof HTMLImageElement) || !img.classList.contains('rich-key')) return
    const cdn = img.dataset.cdn
    if (cdn && !img.dataset.fb) {
      img.dataset.fb = '1'
      img.src = cdn
      return
    }
    const ph = document.createElement('span')
    ph.className = 'rich-key rich-key-broken'
    ph.setAttribute('aria-hidden', 'true')
    img.replaceWith(ph)
  },
  true,
)

/* 共享元素过渡（首页「今日角色」卡 → 代理人详情页头图）：把导航包进
   document.startViewTransition 的更新回调里。不支持该 API 时整条路径静默不注册，
   导航与页面过渡完全退回原样（见 utils/viewTransition）。 */
installViewTransition(router)

/* ============================================================
 * Vercel Web Analytics（访客统计）
 *
 * 为什么用通用入口而不是 @vercel/analytics/vue：后者是一个 Vue 组件，靠
 * `watch(route)` 打点并关掉脚本自身的 auto-track。本站筛选/搜索/等级是**逐键
 * router.replace 写 query**（见 useCatalogList 等），而路由约定里
 * 「同路径仅 query 变化不算换页」（见 router/index.ts 的 scrollBehavior 与 afterEach）。
 * 本地实测：3 次真实换页 + 3 次输入筛选，通用入口记 3 次、vue 入口记 6 次——
 * 用 vue 入口会把每次敲键都算成一次浏览，统计直接虚增。通用入口的 auto-track
 * 只挂钩 pushState/popstate 且按 pathname 去重，与仓库约定一致。
 *
 * 采集脚本与上报端点均为**同源**路径（/_vercel/insights/*），故 vercel.json 的
 * CSP（script-src 'self' / connect-src 'self'）无需放宽，verify-vercel-config 门禁不受影响。
 * 开发环境不发生产请求（mode 为 auto，按 NODE_ENV 判定）。 */
inject()

createApp(App).use(router).directive('reveal', reveal).mount('#app')

/* ============================================================
 * Service Worker 注册（仅生产）：让「离线打开已缓存页面仍可阅读」成为事实
 * ——此前数据说明页这样写，但没有 SW，离线重载必然失败（HTML 是 must-revalidate）。
 * 策略与安全要点见 public/sw.js 头注释。开发环境不注册（避免 HMR 与缓存打架）。
 * ============================================================ */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      /* 注册失败不影响站点（离线能力降级，页面照常在线可用） */
    })
  })
}