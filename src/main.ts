import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
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

createApp(App).use(router).mount('#app')