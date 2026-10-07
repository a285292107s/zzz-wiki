/* ============================================================
 * verify-vercel-config.mjs — 生产缓存策略不变量门禁
 *
 * 为什么需要：vercel.json 的 headers 只在**生产 Vercel** 生效（vite preview
 * 一律 no-cache），本地永远测不到——属于「本地无害、生产有害」的一类缺陷。
 * 2026-10 实测踩到：`/fonts/(.*)` 整目录 immutable，把**非内容寻址**的
 * `noto-serif-sc.css` 也标成一年不重验证；分片文件名是内容寻址且旧片会被删除，
 * 于是回访用户的缓存 CSS 会引用已删除的分片 → 404 → 字形退回系统字体，可持续一年。
 *
 * 本门禁把这套策略写成断言（离线、纯配置检查）：
 *   1) 内容寻址资源可 immutable：/assets/*、/fonts/noto-serif-sc/*
 *   2) 非内容寻址资源禁止 immutable：noto-serif-sc.css、西文字体、/data/img/*
 *      —— 这些 URL 的内容会随重新派生/重新下载而变，immutable 是虚假承诺，
 *      更糟的是指向「已删除的旧文件」时不可恢复
 *   3) 变更频繁的入口必须重验证：manifest.json、noto-serif-sc.css（max-age=0）
 *   4) SPA rewrite 必须存在（否则深链 404）
 *   5) 规则顺序：具体规则须排在通配规则之后（Vercel 同 key 后匹配者生效）
 *
 * 用法：node scripts/verify-vercel-config.mjs（build:ci 末段，紧随 verify:budget）
 * ============================================================ */

import fs from 'node:fs'

const FILE = 'vercel.json'
let bad = 0
const fail = (msg) => {
  bad++
  console.error(`  ✖ ${msg}`)
}
const ok = (msg) => console.log(`  ✓ ${msg}`)

const cfg = JSON.parse(fs.readFileSync(FILE, 'utf8'))
const rules = cfg.headers ?? []

/** 找到首个命中 source 的规则下标（按配置顺序） */
const indexOf = (source) => rules.findIndex((r) => r.source === source)
const cacheOf = (source) => {
  const r = rules.find((x) => x.source === source)
  return r?.headers?.find((h) => h.key.toLowerCase() === 'cache-control')?.value ?? ''
}
const isImmutable = (v) => /immutable/.test(v)

/* 1) 内容寻址 → immutable 才安全 */
for (const [src, label] of [
  ['/assets/(.*)', 'Vite 哈希资源'],
  ['/fonts/noto-serif-sc/(.*)', 'CJK 分片（内容寻址）'],
]) {
  const v = cacheOf(src)
  if (isImmutable(v)) ok(`${label} ${src}: immutable`)
  else fail(`${label} ${src} 应为 immutable，实际「${v || '无规则'}」`)
}

/* 2) 非内容寻址 → 禁止 immutable */
for (const [src, label] of [
  ['/fonts/noto-serif-sc.css', 'CJK 字体 CSS（非内容寻址，旧分片会被删）'],
  ['/fonts/PublicSans-(.*)', '西文字体（固定文件名）'],
  ['/fonts/JetBrainsMono-(.*)', '西文字体（固定文件名）'],
  ['/data/img/(.*)', '图片（重新派生会覆盖同名文件）'],
]) {
  const v = cacheOf(src)
  if (!v) fail(`${label} ${src} 缺少缓存规则`)
  else if (isImmutable(v)) fail(`${label} ${src} 不得 immutable（内容会变），实际「${v}」`)
  else ok(`${label} ${src}: ${v}`)
}

/* 2b) 规则不得互相重叠：/fonts/(.*) 这类通配会把非寻址文件一起标 immutable
       （2026-10 实测踩到），故西文字体按字族显式列出，禁止 /fonts 通配 */
if (indexOf('/fonts/(.*)') >= 0)
  fail('存在 /fonts/(.*) 通配——会把 noto-serif-sc.css 一起纳入，改为按字族显式规则')
else ok('无 /fonts 通配（规则互不重叠）')

/* 3) 变更频繁的入口必须重验证 */
for (const [src, label] of [
  ['/data/manifest.json', '数据清单'],
  ['/fonts/noto-serif-sc.css', 'CJK 字体 CSS'],
  ['/sw.js', 'Service Worker 脚本'],
]) {
  const v = cacheOf(src)
  if (/max-age=0/.test(v)) ok(`${label} ${src}: 每次重验证`)
  else fail(`${label} ${src} 应 max-age=0（must-revalidate），实际「${v || '无规则'}」`)
}

/* 4) SPA rewrite */
const rewrites = cfg.rewrites ?? []
if (rewrites.some((r) => r.destination === '/index.html')) ok('SPA rewrite → /index.html 存在')
else fail('缺少 SPA rewrite（深链会 404）')

/* 5) 唯一允许的重叠：/data/manifest.json 落在 /data/(.*\.json) 之内，
      必须排在其后（同 key 后匹配者生效），否则清单会被通配的 1 天缓存覆盖 */
const iJson = indexOf('/data/(.*\\.json)')
const iManifest = indexOf('/data/manifest.json')
if (iJson >= 0 && iManifest >= 0 && iManifest < iJson)
  fail('/data/manifest.json 规则须排在 /data/(.*\\.json) 之后（否则被通配覆盖）')
else ok('manifest 重验证规则顺序正确（在 JSON 通配之后）')

/* 6) 安全响应头（同样只在生产生效，本地测不到——用断言替代线上试错）
      候选策略已由 scripts/audits/csp-check.js 本地实测：零 securitypolicyviolation、
      字体/图片/检索/下拉/浮层全部正常。 */
const headerValue = (source, key) =>
  rules
    .filter((r) => r.source === source)
    .flatMap((r) => r.headers ?? [])
    .find((h) => h.key.toLowerCase() === key.toLowerCase())?.value ?? ''

const csp = headerValue('/(.*)', 'Content-Security-Policy')
if (!csp) fail('缺少 Content-Security-Policy（全局规则）')
else {
  for (const [needle, label] of [
    ["default-src 'self'", '默认同源'],
    ["script-src 'self'", '脚本仅同源'],
    ["object-src 'none'", '禁插件'],
    ["base-uri 'self'", '禁 base 劫持'],
    ["frame-ancestors 'none'", '禁被嵌框（防点击劫持）'],
    ["font-src 'self'", '字体仅同源'],
    ["form-action 'none'", '禁表单外发'],
  ]) {
    if (csp.includes(needle)) ok(`CSP ${label}`)
    else fail(`CSP 缺少「${needle}」（${label}）`)
  }
  // 关键：脚本不得放开内联/动态求值——站内无内联脚本，无需妥协
  if (/script-src[^;]*unsafe-(inline|eval)/.test(csp))
    fail("CSP script-src 含 unsafe-inline/unsafe-eval（站内无内联脚本，不应妥协）")
  else ok('CSP 脚本无 unsafe-inline / unsafe-eval')
  // 样式：Vue 运行期写 style 属性（--reveal-delay / object-position 等），必须放行内联样式
  if (!/style-src[^;]*unsafe-inline/.test(csp))
    fail('CSP style-src 需含 unsafe-inline（Vue 动态 style 属性依赖）')
  else ok('CSP 样式放行内联属性（Vue 动态 style）')
  // 图片源白名单：仅自身 + data:（纸纹 URI）+ nanoka CDN 兜底
  const img = csp.match(/img-src([^;]*)/)?.[1] ?? ''
  const externalImg = [...img.matchAll(/https?:\/\/[^\s;]+/g)].map((m) => m[0])
  if (externalImg.every((u) => u === 'https://static.nanoka.cc')) ok(`CSP 图片外源白名单：${externalImg.join(' ') || '无'}`)
  else fail(`CSP 图片外源含未预期主机：${externalImg.join(' ')}`)
}

for (const [key, label] of [
  ['X-Content-Type-Options', 'MIME 嗅探防护'],
  ['Referrer-Policy', '来源信息策略'],
  ['Permissions-Policy', '设备能力收敛'],
  ['Strict-Transport-Security', '强制 HTTPS'],
]) {
  const v = headerValue('/(.*)', key)
  if (v) ok(`${label} ${key}: ${v.slice(0, 48)}`)
  else fail(`缺少 ${key}（${label}）`)
}

/* 6) Service Worker：脚本自身必须每次重验证（否则客户端会「卡」在旧 SW 逻辑上），
      且 CSP 必须允许同源 worker（default-src 'self' 已覆盖 worker-src 回退）。 */
{
  const sw = cacheOf('/sw.js')
  if (/max-age=0/.test(sw)) ok('/sw.js: 每次重验证（避免旧 SW 滞留客户端）')
  else fail(`/sw.js 应 max-age=0，实际「${sw || '无规则'}」`)
  const cspSw = headerValue('/(.*)', 'Content-Security-Policy')
  if (/default-src 'self'|worker-src 'self'/.test(cspSw)) ok('CSP 允许同源 Service Worker')
  else fail("CSP 未允许同源 worker（default-src 需含 'self' 或显式 worker-src 'self'）")
}

/* 7) 上传面：Vercel CLI **不读 .gitignore**，只排除它自己的内置清单。
      2026-10 实测一次部署上传 12,453 个文件（入库 1,393 + temp/ 6,815 +
      .agents/ 2,088 + dist/ 1,447 + .playwright-cli/ 700 + …），
      破万文件同时撞上 hobby 套餐上传请求上限（>5000 → 429），部署在上传阶段就失败。
      断言：.gitignore 里每个「构建不需要」的顶层目录都必须在 .vercelignore 中列明。
      注：.gitignore 自身在 Vercel 默认排除清单内，线上构建读不到它，故本段只在本地生效
      ——本地 build:ci 正是 push 前的把关位（上传发生在构建之前，构建期断言拦不住它）。 */
const VERCEL_DEFAULT_IGNORES = new Set([
  '.hg', '.git', '.gitmodules', '.svn', '.cache', '.next', '.now', '.vercel',
  '.npmignore', '.dockerignore', '.gitignore', '.venv', '.yarn', 'node_modules',
  '__pycache__', 'venv', 'CVS',
])
if (!fs.existsSync('.gitignore')) {
  ok('.gitignore 不在场（线上构建）——跳过上传面断言')
} else {
  const listed = new Set(
    (fs.existsSync('.vercelignore') ? fs.readFileSync('.vercelignore', 'utf8') : '')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#') && !l.startsWith('!')),
  )
  const missing = []
  for (const raw of fs.readFileSync('.gitignore', 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#') || line.startsWith('!') || line.startsWith('/')) continue
    if (/[*?[\]]/.test(line)) continue // 通配条目不做目录断言
    const dir = line.replace(/\/+$/, '')
    if (dir.includes('/')) continue // 只看顶层
    if (VERCEL_DEFAULT_IGNORES.has(dir)) continue // Vercel 已默认排除
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue
    if (!listed.has(dir) && !listed.has(`${dir}/`)) missing.push(dir)
  }
  if (missing.length)
    fail(`.vercelignore 未覆盖这些 gitignore 目录（会被整包上传）：${missing.join(', ')}`)
  else ok('.vercelignore 覆盖全部 gitignore 顶层目录（上传面不夹带临时产物）')
}

/* 8) vercel.json 的 `env` / `build.env` 是 Vercel 已废弃的旧属性，**构建期读不到**
      ——2026-10 实测踩到：配了 VITE_SITE_ORIGIN 仍被 generate-sitemap 判定「缺少」而部署失败，
      配了等于没配，却让人以为域名已注入。域名来源统一走项目环境变量（README「部署（Vercel）」）。 */
if ('env' in cfg || (cfg.build && 'env' in cfg.build))
  fail('vercel.json 含已废弃的 env / build.env（构建期不生效）——改用 Vercel 项目环境变量')
else ok('vercel.json 无废弃的 env / build.env（域名来源走项目环境变量）')

console.log(
  bad
    ? `\n== Vercel 缓存/安全策略 == 未通过（${bad} 项）`
    : '\n== Vercel 缓存/安全策略 == 通过（immutable 白名单 / 重验证 / CSP / 安全头 / SW / SPA rewrite / 上传面）',
)
process.exitCode = bad ? 1 : 0
