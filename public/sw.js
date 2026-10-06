/* ============================================================
 * sw.js — Service Worker（离线阅读）
 *
 * 为什么需要：数据说明页承诺「离线打开已缓存页面仍可阅读」——没有 SW 时这句是空话
 * （HTML 响应头是 must-revalidate，离线重载直接失败）。本站是**反复查阅的资料档案**，
 * 离线可用是真实价值（Webby Functionality 明列「带宽受限」场景）。
 *
 * 策略（刻意保持简单、可解释）：
 *   - 导航请求（mode === 'navigate'）：**网络优先**，失败回落缓存（离线读已访问页面）
 *   - 同源静态资源（script/style/font/image）：**缓存优先**（文件名内容寻址，安全）
 *   - /data/ 下 JSON：**陈旧优先 + 后台更新**（stale-while-revalidate），保证离线可读
 *     ——数据新鲜度由「缓存版本」把控：版本取自 manifest.json，版本变即整批换缓存
 *   - 非 GET / 跨域请求：不介入（本站运行时数据面零外部请求；图片候选链兜底除外）
 *
 * 安全要点：
 *   - 缓存名带版本号，activate 时清掉旧版本（避免旧数据长期驻留）
 *   - 不缓存 HTML 以外的响应体过大项：图片本就有派生小图，体量可控
 *   - SW 自身必须 no-cache 提供（见 vercel.json），否则会「卡」在旧逻辑上
 * ============================================================ */

const CACHE_PREFIX = 'zzz-wiki'
const SHELL_CACHE = `${CACHE_PREFIX}-shell`
const ASSET_CACHE = `${CACHE_PREFIX}-assets`
const DATA_CACHE = `${CACHE_PREFIX}-data`

/** 数据版本（缓存世代）：manifest.json 的 zzz.live + generated 组合。
 *  取不到时退化为构建日期无关的固定名（离线仍可用，只是换版时清理不彻底）。 */
async function cacheVersion() {
  try {
    const res = await fetch('/data/manifest.json', { cache: 'no-store' })
    if (!res.ok) throw new Error(String(res.status))
    const m = await res.json()
    const live = m?.zzz?.live ?? 'x'
    const gen = m?.generated ?? 'x'
    return `${live}-${gen}`
  } catch {
    return 'fallback'
  }
}

let version = null
async function versionKey() {
  if (!version) version = await cacheVersion()
  return version
}

/** 缓存上限（实测依据）：
 *  - 图片：浏览 11 页即 112 张 / ~2.5MB，全站外推 ~70MB → 上限 160 张（≈5MB）
 *  - 数据 JSON：详情单条 ~60KB，浏览 30 页即 2MB，全站外推 ~14MB → 上限 80 条（≈5MB）
 *  - 字体分片：天然上限 231 片 / ~1MB（站点自身规模决定），不设上限
 *  超出按**插入顺序**淘汰最旧（Cache API keys() 即插入序，近似 LRU）。
 *  被淘汰的页面仍可离线打开，只是缺该页图片/数据（降级可接受，且在线时立即恢复）。 */
const MAX_IMAGE_ENTRIES = 160
const MAX_DATA_ENTRIES = 80
const IMAGE_RE = /\.(?:webp|png|jpe?g|avif|gif)$/
let putCount = 0

/** 通用修剪：filter 为空则按条目数上限整体修剪 */
async function trim(cacheName, maxEntries, filter) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  const targets = filter ? keys.filter((k) => filter.test(new URL(k.url).pathname)) : keys
  const excess = targets.length - maxEntries
  if (excess > 0) await Promise.all(targets.slice(0, excess).map((k) => cache.delete(k)))
}

/** 计数节流：每 20 次写入修剪一次（避免每次请求都列 keys） */
function maybeTrim(cacheName, maxEntries, filter) {
  if (++putCount % 20 !== 0) return
  return trim(cacheName, maxEntries, filter)
}

self.addEventListener('install', (e) => {
  // 立即接管：不做预缓存（本站资源多为内容寻址，运行时缓存更准确）
  e.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      const v = await versionKey()
      const keep = new Set([`${SHELL_CACHE}-${v}`, `${ASSET_CACHE}-${v}`, `${DATA_CACHE}-${v}`])
      const names = await caches.keys()
      await Promise.all(names.filter((n) => n.startsWith(CACHE_PREFIX) && !keep.has(n)).map((n) => caches.delete(n)))
      await trim(`${ASSET_CACHE}-${v}`, MAX_IMAGE_ENTRIES, IMAGE_RE)
      await trim(`${DATA_CACHE}-${v}`, MAX_DATA_ENTRIES)
      await self.clients.claim()
    })(),
  )
})

/** 判断是否本站可缓存资源 */
function isAsset(url) {
  return /\.(?:js|css|woff2|webp|png|svg|ico)$/.test(url.pathname) || url.pathname.startsWith('/assets/')
}
function isData(url) {
  return url.pathname.startsWith('/data/') && url.pathname.endsWith('.json')
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const res = await fetch(request)
    if (res && res.ok) cache.put(request, res.clone())
    return res
  } catch (err) {
    const hit = await cache.match(request)
    if (hit) return hit
    throw err
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(request)
  if (hit) return hit
  const res = await fetch(request)
  if (res && res.ok) {
    await cache.put(request, res.clone())
    await maybeTrim(cacheName, MAX_IMAGE_ENTRIES, IMAGE_RE)
  }
  return res
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(request)
  const network = fetch(request)
    .then(async (res) => {
      if (res && res.ok) {
        await cache.put(request, res.clone())
        await maybeTrim(cacheName, MAX_DATA_ENTRIES)
      }
      return res
    })
    .catch(() => hit)
  return hit ?? network
}

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // 跨域（CDN 兜底）不介入

  // 注意：必须用 respondWith 交出响应——用 waitUntil 只是「等这段异步完成」，
  // 返回值会被丢弃、浏览器照常走网络（首版踩过：离线时落到 Chrome 恐龙页）。
  e.respondWith(
    (async () => {
      const v = await versionKey()
      if (req.mode === 'navigate') return networkFirst(req, `${SHELL_CACHE}-${v}`)
      if (isData(url)) return staleWhileRevalidate(req, `${DATA_CACHE}-${v}`)
      if (isAsset(url)) return cacheFirst(req, `${ASSET_CACHE}-${v}`)
      return fetch(req)
    })(),
  )
})
