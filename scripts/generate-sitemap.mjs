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
 * 域名从 SITE_ORIGIN 环境变量取（Vercel 生产构建注入），缺省回退
 * 本地预览域——生成的 sitemap 在预览环境无害，生产由 CI 注入真实域。
 *
 * 用法：node scripts/generate-sitemap.mjs（build:ci 内自动执行）
 * ============================================================ */

import fs from 'node:fs'

const ORIGIN = (process.env.SITE_ORIGIN || 'https://localhost:4175').replace(/\/$/, '')
const OUT = 'dist/sitemap.xml'

/** 类目 → 名录 JSON；策展隐藏清单（与 domain/catalog.ts HIDDEN_ITEM_IDS 同口径） */
const CATALOG = [
  { path: '/agents', file: 'character.json', hidden: [] },
  { path: '/w-engines', file: 'weapon.json', hidden: [] },
  { path: '/bangboos', file: 'bangboo.json', hidden: [55098] },
  { path: '/disks', file: 'equipment.json', hidden: [] },
]

function urls() {
  const list = ['/', '/formulas']
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
  console.log(`== sitemap == 生成 ${list.length} 个 URL → ${OUT}`)
}

main()
