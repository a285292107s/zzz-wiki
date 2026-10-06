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

console.log(
  bad
    ? `\n== Vercel 缓存/安全策略 == 未通过（${bad} 项）`
    : '\n== Vercel 缓存/安全策略 == 通过（immutable 白名单 / 重验证 / CSP / 安全头 / SPA rewrite）',
)
process.exitCode = bad ? 1 : 0
