/* ============================================================
 * generate-route-html.mjs — 逐路由静态 HTML（社交卡片 / 爬虫元信息）
 *
 * 问题：SPA 只有一份 index.html，`usePageMeta` 在客户端改 title/canonical/og:url，
 * 但**社交爬虫大多不执行 JS**——分享一个角色页，卡片仍显示站点通用文案与头图。
 *
 * 做法：构建期以 dist/index.html 为模板，为 sitemap 中的每个路由生成
 * `dist/<route>/index.html`，只替换 head 中的元信息（title / description /
 * canonical / og:*），正文与脚本原样保留：
 *   - Vercel 静态文件优先于 rewrites，故 /agents/1011 会命中生成的目录索引
 *   - 运行时仍是同一个 SPA（客户端 usePageMeta 继续按路由覆写，值与此处一致）
 *
 * 图片选择（og:image 必须绝对 URL，多数爬虫不解析相对路径）：
 *   - 角色详情：hero/card/{Mindscape_x_2}.webp（800px 宽的 16:9 派生图，天然适合卡片）
 *   - 音擎/邦布详情：{cat}/thumb/{icon}.webp（方形图标，卡片会加边）
 *   - 名录 / 静态页：站点头图 home-bg.webp
 *   宽高由 sharp 读实际文件，避免声明与实际不符。
 *
 * 依赖 dist/sitemap.xml 作为**唯一路由清单**（build:ci 中紧随 generate-sitemap 执行）。
 * 用法：node scripts/generate-route-html.mjs
 * ============================================================ */

import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const DIST = 'dist'
const TEMPLATE = path.join(DIST, 'index.html')
const SITEMAP = path.join(DIST, 'sitemap.xml')
const ORIGIN = (process.env.VITE_SITE_ORIGIN || process.env.SITE_ORIGIN || 'https://localhost:4175').replace(/\/$/, '')
const SITE_FALLBACK_IMAGE = '/home-bg.webp'

/* ---------- 数据装载（名录名 / 详情描述片段） ---------- */

const CATS = [
  { path: '/agents', list: 'character.json', dir: 'character', label: '代理人', kind: 'agent' },
  { path: '/w-engines', list: 'weapon.json', dir: 'weapon', label: '音擎', kind: 'weapon' },
  { path: '/bangboos', list: 'bangboo.json', dir: 'bangboo', label: '邦布', kind: 'bangboo' },
  { path: '/disks', list: 'equipment.json', dir: 'equipment', label: '驱动盘', kind: 'disk' },
]

const readJson = (p) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null)
const pick = (obj, ...keys) => keys.map((k) => obj?.[k]).find((v) => typeof v === 'string' && v.trim()) ?? ''

/** 取条目展示名（zh.name 优先，其次多语言回退） */
function nameOf(row) {
  const zh = row?.zh
  if (zh && typeof zh === 'object') return pick(zh, 'name') || pick(row, 'name', 'en')
  return pick(row, 'name', 'en')
}

/** 详情页描述片段：档案类取属性/职业标签拼句；驱动盘取套装名 */
function descFor(cat, name, detail) {
  const who = name || '条目'
  if (cat.kind === 'agent') {
    const parts = [pick(detail, 'profile_desc'), pick(detail, 'desc')].filter(Boolean)
    return parts[0]
      ? `${who}档案：${parts[0].replace(/\s+/g, ' ').slice(0, 90)}`
      : `${who}档案：属性、技能、影画与基础属性数据。`
  }
  if (cat.kind === 'weapon') return `${who}（音擎）档案：稀有度、基础属性、精炼效果与适配代理人。`
  if (cat.kind === 'bangboo') return `${who}（邦布）档案：型号、被动能力与属性数值。`
  return `${who}档案：套装效果与二/四件套数值。`
}

/** og:image 相对路径 → 绝对 URL + 实际宽高 */
async function imageMeta(rel) {
  const p = path.join(DIST, rel.replace(/^\//, ''))
  if (!fs.existsSync(p)) return { url: `${ORIGIN}${SITE_FALLBACK_IMAGE}`, w: 2400, h: 1080 }
  try {
    const m = await sharp(p).metadata()
    return { url: `${ORIGIN}${rel}`, w: m.width, h: m.height }
  } catch {
    return { url: `${ORIGIN}${rel}`, w: undefined, h: undefined }
  }
}

/* ---------- head 替换 ---------- */

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function buildHtml(tpl, meta) {
  let out = tpl
  out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(meta.title)}</title>`)
  out = out.replace(
    /<meta name="description"[^>]*>/,
    `<meta name="description" content="${esc(meta.description)}" />`,
  )
  out = out.replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${esc(meta.url)}" />`)
  out = out.replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(meta.title)}" />`)
  out = out.replace(
    /<meta property="og:description"[^>]*>/,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
  )
  out = out.replace(/<meta property="og:image" content="[^"]*"[^>]*>/, `<meta property="og:image" content="${esc(meta.image)}">`)
  out = out.replace(/<meta property="og:image:width"[^>]*>/, meta.imageW ? `<meta property="og:image:width" content="${meta.imageW}">` : '')
  out = out.replace(/<meta property="og:image:height"[^>]*>/, meta.imageH ? `<meta property="og:image:height" content="${meta.imageH}">` : '')
  // og:url 在模板中由客户端创建，静态文件里补一条（位于 og:image 之后）
  if (!out.includes('property="og:url"'))
    out = out.replace(/(<meta property="og:image:height"[^>]*>)/, `$1\n    <meta property="og:url" content="${esc(meta.url)}" />`)
  return out
}

/* ---------- 主流程 ---------- */

async function main() {
  if (!fs.existsSync(TEMPLATE) || !fs.existsSync(SITEMAP)) {
    console.error('✖ 缺少 dist/index.html 或 dist/sitemap.xml——请先跑 vite build 与 generate-sitemap')
    process.exit(1)
  }
  const tpl = fs.readFileSync(TEMPLATE, 'utf8')
  const xml = fs.readFileSync(SITEMAP, 'utf8')
  const paths = [...xml.matchAll(/<loc>(?:https?:\/\/[^/]+)?(\/[^<]*)<\/loc>/g)].map((m) => m[1]).filter(Boolean)

  const dataByCat = new Map()
  for (const c of CATS) {
    const list = readJson(`public/data/live/${c.list}`)
    if (!list) continue
    dataByCat.set(c.path, { cat: c, list })
  }

  let written = 0
  const problems = []
  for (const p of paths) {
    if (p === '/') continue // 根路由用 dist/index.html 本体

    // 命中类目详情：/agents/1011
    const seg = p.split('/').filter(Boolean)
    const entry = dataByCat.get('/' + seg[0])
    const box = { title: '', description: '', image: '', imageW: 0, imageH: 0, url: `${ORIGIN}${p}` }

    if (entry && seg[1]) {
      const { cat, list } = entry
      const row = list[seg[1]]
      const detail = readJson(`public/data/live/zh/${cat.dir}/${seg[1]}.json`)
      // 名称优先取中文详情（列表 JSON 的 name 是英文），再退回列表行/id
      const name = nameOf(detail) || nameOf(row) || seg[1]
      box.title = `${name} · ${cat.label}详情 · 绳网档案`
      box.description = descFor(cat, name, detail)
      const icon = String(row?.icon ?? detail?.icon ?? '').split('/').pop()?.replace(/\.\w+$/, '') ?? ''
      const rel =
        cat.kind === 'agent'
          ? `/data/img/hero/card/Mindscape_${seg[1]}_2.webp`
          : icon
            ? `/data/img/${cat.dir}/thumb/${icon}.webp`
            : SITE_FALLBACK_IMAGE
      const meta = await imageMeta(rel)
      box.image = meta.url
      box.imageW = meta.w
      box.imageH = meta.h
      if (!fs.existsSync(path.join(DIST, rel.replace(/^\//, '')))) {
        box.image = `${ORIGIN}${SITE_FALLBACK_IMAGE}`
        box.imageW = 2400
        box.imageH = 1080
      }
    } else if (entry) {
      const { cat, list } = entry
      box.title = `${cat.label}名录 · 绳网档案`
      box.description = `${cat.label}名录：${Object.keys(list).length} 条档案，可按条件筛选与检索。`
      const meta = await imageMeta(SITE_FALLBACK_IMAGE)
      box.image = meta.url
      box.imageW = meta.w
      box.imageH = meta.h
    } else {
      // 静态页 /formulas /about
      const label = seg[0] === 'formulas' ? '战斗公式' : seg[0] === 'about' ? '数据说明' : '档案'
      box.title = `${label} · 绳网档案`
      box.description =
        seg[0] === 'formulas'
          ? '从伤害乘区到失衡、属性异常与命破，逐段拆解绝区零战斗数值构成。'
          : seg[0] === 'about'
            ? '绳网档案的数据来源、覆盖范围、更新机制、校验门禁与版权声明。'
            : '绳网档案：绝区零结构化资料库。'
      const meta = await imageMeta(SITE_FALLBACK_IMAGE)
      box.image = meta.url
      box.imageW = meta.w
      box.imageH = meta.h
    }

    const dir = path.join(DIST, p.replace(/^\//, ''))
    fs.mkdirSync(dir, { recursive: true })
    const html = buildHtml(tpl, box)
    fs.writeFileSync(path.join(dir, 'index.html'), html)
    written++

    // 自校验：字段必须真的换掉（模板残留 = 该路由会分享出站点通用卡片）
    if (!html.includes(`content="${box.image}"`)) problems.push(`${p}: og:image 未替换`)
    if (!html.includes(`<link rel="canonical" href="${ORIGIN}${p}"`)) problems.push(`${p}: canonical 未替换`)
    if (!html.includes(`<meta property="og:url" content="${ORIGIN}${p}"`)) problems.push(`${p}: og:url 未写入`)
    if (/<title>绳网档案 · 绝区零数据图鉴<\/title>/.test(html)) problems.push(`${p}: title 未替换`)
  }

  console.log(`== 逐路由 HTML == 生成 ${written} 个（origin ${ORIGIN}）`)
  if (problems.length) {
    console.error(`  ✖ ${problems.length} 项自校验失败：`)
    for (const x of problems.slice(0, 8)) console.error(`    ${x}`)
    process.exit(1)
  }
  console.log('  ✓ 自校验通过（每页 title / canonical / og:url / og:image 均已替换）')
}

main().catch((e) => {
  console.error('[route-html] ', e instanceof Error ? e.message : e)
  process.exit(1)
})
