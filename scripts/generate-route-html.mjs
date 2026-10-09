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

/* ---------- 路由 → 视图源文件（单一事实源是 src/router/views.ts） ----------
   仅用于把该路由的懒加载 chunk 写进 modulepreload；下面的 buildManifest 会校验
   每个映射都在构建清单里，映射漂移会在构建期直接失败而不是静默退化。 */
const VIEW_OF = {
  '/agents': 'src/views/AgentsView.vue',
  '/w-engines': 'src/views/WEnginesView.vue',
  '/bangboos': 'src/views/BangboosView.vue',
  '/disks': 'src/views/DisksView.vue',
  '/atlas': 'src/views/AtlasView.vue',
  '/formulas': 'src/views/FormulasView.vue',
  '/about': 'src/views/AboutView.vue',
}

/** 静态页元信息（title 主语 + description）。**必须与运行时的 usePageMeta 一致**——
 *  main() 末尾逐条自检，不一致直接构建失败。自检来源分两类：
 *   · literal：视图里是字面量 `usePageMeta('标题', '描述')`
 *   · guide  ：视图用变量（如 FORMULA_GUIDE.sub），回到数据模块取真值 */
const STATIC_META = {
  '/atlas': {
    label: '档案图谱',
    desc: '把代理人档案按「属性 × 职业」摊平成一张格子表——每格是条目数，点开即筛出对应档案。',
    kind: 'literal',
  },
  '/formulas': {
    label: '战斗公式',
    desc: '伤害、失衡、属性异常与各类机制的乘区构成。承接社区数据机制导论的结构与主公式，面向配装与读数的档案式整理。',
    kind: 'guide',
    src: 'src/data/formulaGuide.ts',
  },
  '/about': {
    label: '数据说明',
    desc: '绳网档案的数据来源、覆盖范围、更新机制、校验门禁与版权声明——可核查的档案出处。',
    kind: 'literal',
  },
}
const DETAIL_VIEW_OF = {
  '/agents': 'src/views/AgentDetailView.vue',
  '/w-engines': 'src/views/WEngineDetailView.vue',
  '/bangboos': 'src/views/BangbooDetailView.vue',
  '/disks': 'src/views/DiskDetailView.vue',
}

/** 该路由的 modulepreload 目标：视图 chunk + 其静态依赖（不含入口 index.html） */
function preloadModulesFor(manifest, source) {
  const entry = manifest?.[source]
  if (!entry) return null
  const out = []
  const seen = new Set()
  const push = (file) => {
    if (!file || file === 'index.html' || seen.has(file)) return
    seen.add(file)
    out.push(`/assets/${file}`.replace('/assets/assets/', '/assets/'))
  }
  push(entry.file)
  for (const dep of entry.imports ?? []) {
    const d = manifest[dep]
    if (d?.file) push(d.file)
  }
  return out
}

/* ---------- head 替换 ---------- */

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function buildHtml(tpl, meta) {
  let out = tpl
  out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(meta.title)}</title>`)
  // 首屏图预载（仅详情页头图）：LCP 元素是 hero 图，但它是 JS 渲染后才创建的 <img>——
  // 实测慢 4G 下请求要 1.5–4.0s 才发起。逐路由 HTML 让浏览器在**解析期**就开始取图。
  // 按断点分开预载：错变体会白下一份（mobile/full 差 ~10 倍体积）。
  // **fetchpriority=low 是关键**：默认预载按 High 优先级，会与关键 JS 抢带宽——
  // 实测（4× CPU + 慢 4G）默认预载让图片就绪提前 2.3s，但 LCP 反而没改善，
  // 因为渲染被 JS 拖后。降为 low 让它「并行但不抢路」，等应用渲染时图已在手。
  if (meta.preloadImages?.length) {
    const links = meta.preloadImages
      .map(
        (p) =>
          `    <link rel="preload" as="image" href="${esc(p.href)}" fetchpriority="low"${p.media ? ` media="${esc(p.media)}"` : ''} />`,
      )
      .join('\n')
    out = out.replace(/(<link rel="preload" href="\/data\/manifest\.json"[^>]*>)/, `${links}\n$1`)
  }
  // 详情 JSON 预载：详情页要等 JS 起来才 fetch 这份数据，是渲染段里的一段串行 RTT。
  // 逐路由 HTML 知道确切路径，故在解析期就并行取。crossorigin 必须带——
  // 应用侧 fetch() 默认 CORS 模式，预载不带会因模式不匹配而重复下载。
  if (meta.preloadJson) {
    out = out.replace(
      /(<link rel="preload" href="\/data\/manifest\.json"[^>]*>)/,
      `    <link rel="preload" as="fetch" href="${esc(meta.preloadJson)}" crossorigin />\n$1`,
    )
  }
  // 路由 chunk 的 modulepreload：该路由的视图是动态 import，入口 JS 跑完才发现它
  // （实测：入口 231→1600ms，chunk 1649ms 才出发——白等一段串行 RTT）。
  // 逐路由 HTML 知道自己在哪条路由，故可提前到解析期并行取。
  if (meta.preloadModules?.length) {
    const links = meta.preloadModules
      .map((h) => `    <link rel="modulepreload" href="${esc(h)}" />`)
      .join('\n')
    out = out.replace(/(<link rel="preload" href="\/data\/manifest\.json"[^>]*>)/, `${links}\n$1`)
  }
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
  const buildManifest = readJson(path.join(DIST, '.vite', 'manifest.json'))

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
    // 该路由视图 chunk 的 modulepreload（映射漂移在构建期直接报错）
    const viewSource = seg[1] ? DETAIL_VIEW_OF['/' + seg[0]] : VIEW_OF['/' + seg[0]]
    if (viewSource) {
      const mods = preloadModulesFor(buildManifest, viewSource)
      if (!mods) problems.push(`${p}: 构建清单缺少视图 ${viewSource}（映射漂移？）`)
      else box.preloadModules = mods
    }

    if (entry && seg[1]) {
      const { cat, list } = entry
      const row = list[seg[1]]
      const detail = readJson(`public/data/live/zh/${cat.dir}/${seg[1]}.json`)
      // 详情数据预载：应用侧 detailFor() 会取这份（api.ts toDataUrl: /data/live/zh/{dir}/{id}.json）
      box.preloadJson = fs.existsSync(`public/data/live/zh/${cat.dir}/${seg[1]}.json`)
        ? `/data/live/zh/${cat.dir}/${seg[1]}.json`
        : null
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
      // 角色详情页另有整栏 hero 底图（LCP 元素）：按断点预载对应变体
      if (cat.kind === 'agent') {
        // 双形态角色（如 1551）没有裸名文件，须取 hero-gender-variants.json 的默认形态
        // （与 src/data/heroGenderVariants.ts 的 heroImageFile 同口径）
        const gender = readJson('src/data/hero-gender-variants.json')
        const heroBase = gender?.[String(seg[1])]?.defaultFile ?? `Mindscape_${seg[1]}_2`
        const mobile = `/data/img/hero/mobile/${heroBase}.webp`
        const full = `/data/img/hero/${heroBase}.webp`
        box.preloadImages = []
        const hasMobile = fs.existsSync(path.join(DIST, mobile.replace(/^\//, '')))
        const hasFull = fs.existsSync(path.join(DIST, full.replace(/^\//, '')))
        // 宽屏 DPR 1 只需 ~1168px，原图 2552px 是 2.2 倍超采（311KB）→ 用 1400w 派生；
        // 只有 DPR ≥1.5 才需要原图。**media 条件必须与 AgentHead 的
        // useMediaQuery('(min-resolution: 1.5dppx)') 分支逐字一致**，否则预载与实取错位。
        if (hasMobile) {
          box.preloadImages.push({ href: mobile, media: '(max-width: 860px)' })
          box.preloadImages.push({
            href: mobile,
            media: '(min-width: 861px) and (max-resolution: 1.49dppx)',
          })
        }
        if (hasFull)
          box.preloadImages.push({
            href: full,
            media: '(min-width: 861px) and (min-resolution: 1.5dppx)',
          })
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
      // 静态页：元信息从 STATIC_META 取（新增静态页只加一行），并与视图里的
      // usePageMeta 文案做一致性自检——两处文案漂移是这类生成器最容易犯的错。
      const sm = STATIC_META[`/${seg[0]}`]
      box.title = `${sm?.label ?? '档案'} · 绳网档案`
      box.description = sm?.desc ?? '绳网档案：绝区零结构化资料库。'
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
    // 角色详情页的首屏图预载不得丢：它是 LCP 关键路径（桌面实测 LCP 5.4s → 3.8s）
    if (box.preloadImages?.length && !html.includes('rel="preload" as="image"'))
      problems.push(`${p}: 首屏图预载缺失（LCP 关键路径）`)
    // 路由 chunk 的 modulepreload 同理（实测 chunk 出发 1649ms → 210ms）
    if (box.preloadModules?.length && !html.includes('rel="modulepreload"'))
      problems.push(`${p}: 路由 chunk 预载缺失（LCP 关键路径）`)
    if (box.preloadJson && !html.includes(`as="fetch" href="${box.preloadJson}"`))
      problems.push(`${p}: 详情 JSON 预载缺失（LCP 关键路径）`)
  }

  console.log(`== 逐路由 HTML == 生成 ${written} 个（origin ${ORIGIN}）`)
  // 静态页元信息一致性：STATIC_META 必须与运行时的 usePageMeta 文案逐字一致
  // （两处文案漂移是这类生成器最容易犯的错，且只在分享卡片上才看得出来）
  for (const [route, meta] of Object.entries(STATIC_META)) {
    let gotTitle = ''
    let gotDesc = ''
    if (meta.kind === 'literal') {
      const src = fs.readFileSync(VIEW_OF[route], 'utf8')
      const m = /usePageMeta\(\s*'([^']*)'\s*,\s*'([^']*)'/.exec(src)
      if (!m) {
        problems.push(`${route}: 视图里找不到单行 usePageMeta('title', 'desc')，无法自检`)
        continue
      }
      gotTitle = m[1]
      gotDesc = m[2]
    } else {
      const src = fs.readFileSync(meta.src, 'utf8')
      const t = /title:\s*'([^']*)'/.exec(src)
      const s = /sub:\s*'([^']*)'/.exec(src)
      gotTitle = t?.[1] ?? ''
      gotDesc = s?.[1] ?? ''
    }
    if (gotTitle !== meta.label)
      problems.push(`${route}: 标题漂移（运行时「${gotTitle}」≠ 生成器「${meta.label}」）`)
    if (gotDesc !== meta.desc) problems.push(`${route}: 描述漂移（运行时与生成器不一致）`)
  }

  // 构建清单已用完：静态站不需要它对外暴露，删掉以免进部署产物
  const manifestPath = path.join(DIST, '.vite', 'manifest.json')
  if (fs.existsSync(manifestPath)) {
    fs.rmSync(path.join(DIST, '.vite'), { recursive: true, force: true })
    console.log('  · 已清理 dist/.vite/manifest.json（仅构建期使用）')
  }
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
