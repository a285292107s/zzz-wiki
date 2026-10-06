import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import { reveal } from './directives/reveal'
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