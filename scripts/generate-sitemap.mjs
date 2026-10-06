/* ============================================================
 * generate-sitemap.mjs — sitemap.xml 生成（构建期，build:ci 自动跑）
 *
 * SPA + Vercel rewrite 的站点，路由清单在构建期是**完全可知**的：
 *   - 静态路由：/（首页）、/formulas
 *   - 类目名录：/agents /w-engines /bangboos /disks（catalog.ts 派生）
 *   - 详情页：读 public/data/live/{character,weapon,bangboo,equipment}.json
 *     的名录 Id（与站点运行时同源，策展隐藏条目按 HIDDEN_ITEM_IDS 过滤——
 *     名录页不陈列的条目不进 sitemap，口径与 UI 一致）
 *
 * 域名从 `VITE_SITE_ORIGIN` 环境变量取——**与前端 canonical/og:url 同一来源**
 * （vercel.json 的 buildEnv 注入，src/composables/usePageMeta.ts 读同一个变量）；
 * 兼容读取旧名 `SITE_ORIGIN`。缺省回退本地预览域，但**在部署环境（VERCEL/CI）
 * 缺变量时直接失败**——否则会把 https://localhost:4175 的 sitemap 发上线
 * （2026-10 实测踩到：vercel.json 注 VITE_SITE_ORIGIN、脚本读 SITE_ORIGIN，
 * 生产 sitemap 的 238 条 URL 全部指向 localhost）。
 *
 * 用法：node scripts/generate-sitemap.mjs（build:ci 内自动执行）
 * ============================================================ */

import fs from 'node:fs'

const ENV_ORIGIN = process.env.VITE_SITE_ORIGIN || process.env.SITE_ORIGIN
const DEPLOYING = Boolean(process.env.VERCEL || process.env.CI)
if (!ENV_ORIGIN && DEPLOYING) {
  console.error(
    '✖ 部署构建缺少 VITE_SITE_ORIGIN（sitemap 域名来源）——拒绝生成指向 localhost 的 sitemap。\n' +
      '  请在 vercel.json 的 buildEnv 或 CI 环境变量中注入生产域后重试。',
  )
  process.exit(1)
}
const ORIGIN = (ENV_ORIGIN || 'https://localhost:4175').replace(/\/$/, '')
if (!ENV_ORIGIN) console.warn('⚠ 未设置 VITE_SITE_ORIGIN——本地构建回退预览域（勿直接部署此产物）')
const OUT = 'dist/sitemap.xml'

/** 类目 → 名录 JSON；策展隐藏清单（与 domain/catalog.ts HIDDEN_ITEM_IDS 同口径） */
const CATALOG = [
  { path: '/agents', file: 'character.json', hidden: [] },
  { path: '/w-engines', file: 'weapon.json', hidden: [] },
  { path: '/bangboos', file: 'bangboo.json', hidden: [55098] },
  { path: '/disks', file: 'equipment.json', hidden: [] },
]

function urls() {
  const list = ['/', '/formulas', '/about']
  for (const c of CATALOG) {
    list.push(c.path)
    const p = `public/data/live/${c.file}`
    if (!fs.existsSync(p)) {
      console.warn(`  ⚠ ${p} 缺失，跳过该类目详情 URL`)
      continue
    }
    const dict = JSON.parse(fs.readFileSync(p, 'utf8'))
    for (const id of Object.keys(dict)) {
      if (c.hidden.includes(Number(id))) continue
      list.push(`${c.path}/${id}`)
    }
  }
  return list
}

function main() {
  const list = urls()
  const today = new Date().toISOString().slice(0, 10)
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...list.map((u) => `  <url><loc>${ORIGIN}${u}</loc><lastmod>${today}</lastmod></url>`),
    '</urlset>',
    '',
  ].join('\n')
  fs.writeFileSync(OUT, xml)
  console.log(`== sitemap == 生成 ${list.length} 个 URL → ${OUT}（域名 ${ORIGIN}）`)
}

main()
