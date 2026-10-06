/* ============================================================
 * verify-budget.mjs — 性能预算门禁（build:ci 末段，sitemap 之后）
 *
 * 把品质基线（temp/quality-baseline.md 的可机器化子集）固化为硬约束：
 *   1) 主 JS 包（dist/assets/index-*.js）gzip 后 ≤ 62KB
 *      （基线 55KB；+12% 余量。首页静态编入 +4KB 已含）
 *   2) 主 CSS 包 gzip 后 ≤ 22KB
 *      （基线 ~19KB；202 条 CJK @font-face 已含）
 *   3) sitemap.xml 存在且 URL 数 ≥ 230
 *      （名录页 60+100+42+30 + 静态页 6 = 238±；低于 230 说明数据/生成挂了）
 *   4) dist/index.html 存在
 *
 * 超预算 → 非零退出：防止「顺手加个库」无声劣化首屏性能。
 * 预算调整须连同基线文档一起改，注释写明原因。
 *
 * 用法：node scripts/verify-budget.mjs（离线可用，gzip 用 zlib 实测）
 * ============================================================ */

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const DIST = 'dist'
const BUDGET = {
  /** 主 JS 包 gzip 上限 KB（基线 55.2 + 余量） */
  mainJsGzipKB: 62,
  /** 主 CSS gzip 上限 KB（基线 ~11 + 余量） */
  mainCssGzipKB: 22,
  /** CJK 分片 CSS gzip 上限 KB——渲染阻塞资源，权重档位翻倍会直接翻倍它
      （2026-10 实测：500/600 双档压缩 62KB 时移动端 FCP 7.4s；单档 31KB 后 1.5s。
       原始大小 109KB 是 unicode-range 列表，故按 gzip 口径设限） */
  cjkCssGzipKB: 40,
  /** sitemap 最少 URL 数（低于此说明数据或生成器故障） */
  sitemapMinUrls: 230,
}

let bad = 0
const fail = (msg) => {
  bad++
  console.error(`  ✖ ${msg}`)
}
const gzipKB = (p) => Math.round(zlib.gzipSync(fs.readFileSync(p)).length / 1024 * 10) / 10

const indexHtml = path.join(DIST, 'index.html')
if (!fs.existsSync(indexHtml)) {
  fail('dist/index.html 缺失——构建产物不完整')
  console.error('\n== 性能预算 == 未通过')
  process.exit(1)
}

/* 1) 主 JS 包 */
const jsFiles = fs
  .readdirSync(path.join(DIST, 'assets'))
  .filter((f) => f.startsWith('index-') && f.endsWith('.js'))
if (jsFiles.length !== 1) fail(`预期 1 个主 JS 包（index-*.js），实际 ${jsFiles.length} 个`)
for (const f of jsFiles) {
  const p = path.join(DIST, 'assets', f)
  const kb = gzipKB(p)
  const ok = kb <= BUDGET.mainJsGzipKB
  console.log(`  ${ok ? '✓' : '✖'} ${f}: gzip ${kb}KB / 预算 ${BUDGET.mainJsGzipKB}KB`)
  if (!ok) bad++
}

/* 2) 主 CSS 包 */
const cssFiles = fs
  .readdirSync(path.join(DIST, 'assets'))
  .filter((f) => f.startsWith('index-') && f.endsWith('.css'))
for (const f of cssFiles) {
  const p = path.join(DIST, 'assets', f)
  const kb = gzipKB(p)
  const ok = kb <= BUDGET.mainCssGzipKB
  console.log(`  ${ok ? '✓' : '✖'} ${f}: gzip ${kb}KB / 预算 ${BUDGET.mainCssGzipKB}KB`)
  if (!ok) bad++
}

/* 3) CJK 分片 CSS（渲染阻塞；字重档位与分片数直接决定首屏绘制） */
const cjkCss = 'public/fonts/noto-serif-sc.css'
if (fs.existsSync(cjkCss)) {
  const kb = gzipKB(cjkCss)
  const ok = kb <= BUDGET.cjkCssGzipKB
  console.log(`  ${ok ? '✓' : '✖'} noto-serif-sc.css: gzip ${kb}KB / 预算 ${BUDGET.cjkCssGzipKB}KB`)
  if (!ok) bad++
  const weights = new Set([...fs.readFileSync(cjkCss, 'utf8').matchAll(/font-weight:\s*(\d+)/g)].map((m) => m[1]))
  const oneWeight = weights.size === 1
  console.log(`  ${oneWeight ? '✓' : '✖'} CJK 字重档位: ${[...weights].join('/') || '无'}（应为单档——多档只增载荷，见 DATA_GUIDE §10）`)
  if (!oneWeight) bad++
} else {
  fail('public/fonts/noto-serif-sc.css 缺失——CJK 衬线分片未就位？')
}

/* 4) sitemap */
const sm = path.join(DIST, 'sitemap.xml')
if (!fs.existsSync(sm)) {
  fail('dist/sitemap.xml 缺失——generate-sitemap 未执行？')
} else {
  const urls = (fs.readFileSync(sm, 'utf8').match(/<loc>/g) || []).length
  const ok = urls >= BUDGET.sitemapMinUrls
  console.log(`  ${ok ? '✓' : '✖'} sitemap.xml: ${urls} URLs / 下限 ${BUDGET.sitemapMinUrls}`)
  if (!ok) bad++
}

console.log(
  bad
    ? `\n== 性能预算 == 未通过（${bad} 项）——新增依赖/代码请同步评估预算，调整预算须更新基线文档`
    : '\n== 性能预算 == 通过（主包/CSS/sitemap 全部在预算内）',
)
process.exitCode = bad ? 1 : 0
