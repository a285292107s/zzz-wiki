/* ============================================================
 * verify-budget.mjs — 性能预算门禁（build:ci 末段，sitemap 之后）
 *
 * 把品质基线（[QUALITY.md](../QUALITY.md) 的可机器化子集）固化为硬约束：
 *   1) 主 JS 包（dist/assets/index-*.js）gzip 后 ≤ 上限（见下方 mainJsGzipKB，当前 96KB；不要在这里重复数字）
 *      （基线 55KB；+20% 余量。首页静态编入 +4KB 已含）
 *      **2026-10 由 62KB 提到 63KB**：新增「今日角色」选片小表
 *      （src/data/featured-elements.json，54 条 [属性码, 阵营] 紧凑数组 ≈0.4KB gzip）。
 *      这笔开销换来的是可见收益——首屏 4 张卡从「4 张里 3 张白发红眼」变为
 *      **属性与阵营都不重复**（实测 365/365 天成立），首页第一印象不再显得随手。
 *      **2026-10-12 记账（不调预算，仍在 70KB 内）**：「今日角色」选片改为**生日优先**，
 *      那张小表随之换成 src/data/featured-birthdays.json（58 条 `"1011":"02-20"`，
 *      ≈0.3KB gzip，比旧表更小）；属性 + 阵营去重取消。
 *      生日优先读的是同一类「构建期派生、入库、CI --check」的小表，故预算不变。
 *      **2026-10-07 由 63KB 提到 66KB**：① 首页「今日角色」改版为**整栏宽横幅牌堆**
 *      （横向拖拽/橡皮筋/吸附 + APG 轮播语义，是本轮主要开销）；② 头图 **srcset 两档**
 *      交付（card 800w / wide 1600w / 原图，+0.2KB，实测整包 64.3KB）。
 *      ② 修的是首页首屏发糊：旧的 800px 单档在整栏宽展示格下被放大 1.96×（DPR2 3.9×）。
 *      ① 与 ② 都是首屏第一眼可见的收益，故连同预算一起记账（改前 64.1KB 已越 63KB 线）。
 *      **2026-10 记账（不调预算，仍在 66KB 内，实测 65.7KB）**：首页「今日角色」→ 详情的
 *      **共享元素飞行**（utils/viewTransition 的时机谈判与降级路径、data/heroImageSources
 *      的降落端档位单一来源、牌堆的装匣入场编排 ≈ +1.6KB）。换来的是首屏「点了有回应」的
 *      那个关键瞬间；余量只剩约 0.3KB —— **下一次加功能前必须先腾预算**。
 *      **2026-10 由 66KB 提到 70KB（实测 68.6KB）**：起飞前编排 ——
 *      「整页退场（chrome 收集器 + 声明式区块）→ 原地取景变形 → 飞行 → 目的页逐条入场」，
 *      外加中途改主意的回滚路径。这是用户明确要的编排（第一屏点下去的那一下是
 *      全站唯一「有戏」的动作），且全部走 transform/opacity，不加依赖、不增请求。
 *      代价记账：首访 gzip +2.9KB（约首访 1.74MB 的 0.2%）。**这是本设计的最后一点余量**，
 *      再加编排要先把状态机/选择器精简掉，而不是继续加预算。
 *      **2026-10-11 记账（不调预算，仍在 70KB 内，实测 68.0KB）**：接入 Vercel Web
 *      Analytics（访客统计）——`@vercel/analytics` 通用入口的 inject()，+0.8KB gzip。
 *      选通用入口而非 `@vercel/analytics/vue` 组件：vue 入口把「筛选逐键写 query」
 *      也记成浏览（实测同一段操作 6 次 vs 3 次），与本站「同路径 query 变化不算换页」
 *      的约定冲突；理由见 src/main.ts。余量仅剩约 2KB——**下一次加功能先腾预算**。
 *      **2026-10-14 由 70KB 提到 96KB（实测 92.0KB）**：界面短文案三语化
 *      （决策记录 0011）——导航/按钮/区块标题/筛选标签/表头/空错态/检索面板/设置页
 *      全部随展示语言切换。四语界面文案表（src/domain/uiText.{zh,en,ja,ko}.json，
 *      约 500 键）+ 术语标签的四语 label（enums/catalog/sections）+ 50 余个组件改读文案树。
 *      实测归因（同一构建、Vite gzip 口径）：
 *        · 四语全量 92.0KB / 只带中文 82.1KB / 文案值全置空 79.3KB
 *      即「文案载荷 ≈10KB、键结构与读取机制 + 各语言术语标签 ≈11KB」。
 *      **只带中文也有 82KB**，故无可避免：本设计的运行期下限已经越过旧预算。
 *      被否决的更省方案：非默认语言走 `import()` 懒加载（约省 10KB，主包回到 ~82KB）——
 *      换来的是语言切换变成异步状态机（切语言要先 await 块、启动时要先 await 再挂载），
 *      失败态是「切换后界面半中半外」，而收益只占首访 1.74MB 的 0.6%；
 *      默认语言（zh）那条路两种方案完全一样。见 0011 的 Alternatives。
 *      余量：92 → 96KB 约 4%，够下一次文案增补；**再要加界面文案之外的机制，先看这里**。
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
  /** 主 JS 包 gzip 上限 KB（基线 55.2 + 余量；2026-10 62 → 63 → 66 → 70 → 96，理由见文件头注释） */
  mainJsGzipKB: 96,
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

/* 4) sitemap：条数下限 + **域名一致性** */
const sm = path.join(DIST, 'sitemap.xml')
if (!fs.existsSync(sm)) {
  fail('dist/sitemap.xml 缺失——generate-sitemap 未执行？')
} else {
  const xml = fs.readFileSync(sm, 'utf8')
  const urls = (xml.match(/<loc>/g) || []).length
  const ok = urls >= BUDGET.sitemapMinUrls
  console.log(`  ${ok ? '✓' : '✖'} sitemap.xml: ${urls} URLs / 下限 ${BUDGET.sitemapMinUrls}`)
  if (!ok) bad++

  // 域名一致性：sitemap 的 origin 必须与 canonical/og:url 同源（VITE_SITE_ORIGIN）。
  // 2026-10 实测踩到过 origin 变量名不一致（vercel.json 注 VITE_SITE_ORIGIN、
  // 脚本读 SITE_ORIGIN）→ 生产 sitemap 全部指向 localhost。此门禁把该类缺陷挡在部署前。
  const expect = (process.env.VITE_SITE_ORIGIN || process.env.SITE_ORIGIN || '').replace(/\/$/, '')
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
  const origins = new Set(locs.map((u) => u.replace(/^(https?:\/\/[^/]+).*$/, '$1')))
  const uniqueOrigin = origins.size === 1
  console.log(`  ${uniqueOrigin ? '✓' : '✖'} sitemap origin: ${[...origins].join(' / ') || '无'}`)
  if (!uniqueOrigin) bad++
  if (expect) {
    const match = [...origins][0] === expect
    console.log(`  ${match ? '✓' : '✖'} sitemap origin 与 VITE_SITE_ORIGIN 一致: 期望 ${expect}`)
    if (!match) bad++
  } else if (process.env.VERCEL || process.env.CI) {
    fail('部署构建未设置 VITE_SITE_ORIGIN——sitemap 会指向 localhost，拒绝通过')
  }
}

/* 5) 逐路由静态 HTML（社交卡片 / 爬虫元信息）：数量须与 sitemap 匹配 */
{
  const htmls = []
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(dir, e.name))
      else if (e.name === 'index.html' && dir !== DIST) htmls.push(path.join(dir, e.name))
    }
  }
  if (fs.existsSync(DIST)) walk(DIST)
  const sitemapUrls = fs.existsSync(sm) ? (fs.readFileSync(sm, 'utf8').match(/<loc>/g) || []).length : 0
  // sitemap 含根路由（用 dist/index.html 本体），故生成数 = sitemap - 1
  const ok = htmls.length > 0 && htmls.length >= sitemapUrls - 2
  console.log(`  ${ok ? '✓' : '✖'} 逐路由 HTML: ${htmls.length} 个（sitemap ${sitemapUrls}）`)
  if (!ok) bad++
  const bytes = htmls.reduce((s, p) => s + fs.statSync(p).size, 0)
  console.log(`  · 逐路由 HTML 体积: ${Math.round(bytes / 1024)}KB（部署额外产物，不影响首访下载）`)
}

console.log(
  bad
    ? `\n== 性能预算 == 未通过（${bad} 项）——新增依赖/代码请同步评估预算，调整预算须更新基线文档`
    : '\n== 性能预算 == 通过（主包/CSS/sitemap/逐路由 HTML 全部在预算内）',
)
process.exitCode = bad ? 1 : 0

