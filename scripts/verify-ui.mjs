import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const DEFAULT_WIDTHS = [1440, 768, 390]
const OUT_DIR = 'temp/verify-ui'
const DEV_ORIGIN = 'http://localhost:5173'
const AXE_PATH = path.resolve('node_modules/axe-core/axe.min.js')

const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '')

function splitList(v) {
  return String(v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function parseArgs(argv) {
  const opts = { routes: [], widths: DEFAULT_WIDTHS, base: DEV_ORIGIN, shots: true, axe: true, session: `verify-ui-${process.pid}` }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const take = (flag) => (arg.startsWith(`${flag}=`) ? arg.slice(flag.length + 1) : argv[++i])
    if (arg === '--help' || arg === '-h') opts.help = true
    else if (arg === '--no-shots') opts.shots = false
    else if (arg === '--no-axe') opts.axe = false
    else if (arg === '--route' || arg.startsWith('--route=')) opts.routes.push(...splitList(take('--route')))
    else if (arg === '--widths' || arg.startsWith('--widths=')) opts.widths = splitList(take('--widths')).map(Number).filter((n) => n > 0)
    else if (arg === '--base' || arg.startsWith('--base=')) opts.base = take('--base').replace(/\/+$/, '')
    else if (arg === '--session' || arg.startsWith('--session=')) opts.session = take('--session')
    else throw new Error(`未知参数：${arg}`)
  }
  return opts
}

function pairByOrder(text, reA, reB) {
  const out = new Map()
  const a = [...text.matchAll(reA)]
  const b = [...text.matchAll(reB)]
  for (let i = 0; i < Math.min(a.length, b.length); i++) out.set(a[i][1], b[i][1])
  return out
}

function viewRoutes() {
  const views = read('src/router/views.ts')
  const catalog = read('src/domain/catalog.ts')
  const router = read('src/router/index.ts')
  const devRoutes = read('src/domain/devRoutes.ts')

  const listFile = pairByOrder(catalog, /path: '(\/[^']+)'/g, /listFile: '([^']+)'/g)
  const map = new Map()
  const add = (view, route) => {
    if (!view || !route) return
    if (!map.has(view)) map.set(view, [])
    map.get(view).push(route)
  }

  for (const m of views.matchAll(
    /'(\/[^']+)': \[\s*\(\) => import\('@\/views\/([A-Za-z0-9]+)\.vue'\),\s*\(\) => import\('@\/views\/([A-Za-z0-9]+)\.vue'\)/g,
  )) {
    const [, route, listView, detailView] = m
    add(listView, route)
    add(detailView, `${route}/:id`)
  }

  for (const m of router.matchAll(/path: '(\/[^']*)'[\s\S]{0,120}?import\('@\/views\/([A-Za-z0-9]+)\.vue'\)/g)) {
    const [, route, view] = m
    if (!route.includes(':')) add(view, route)
  }
  add('HomeView', '/')

  const devViewByName = new Map(
    [...router.matchAll(/'([a-z-]+)': \(\) => import\('@\/views\/([A-Za-z0-9]+)\.vue'\)/g)].map((m) => [m[1], m[2]]),
  )
  for (const m of devRoutes.matchAll(/name: '([a-z-]+)'[\s\S]{0,120}?path: '(\/[^']*)'/g)) add(devViewByName.get(m[1]), m[2])
  for (const m of devRoutes.matchAll(/path: '(\/[^']*)'[\s\S]{0,120}?name: '([a-z-]+)'/g)) add(devViewByName.get(m[2]), m[1])

  return { map, listFile, listRoutes: [...new Set([...views.matchAll(/'(\/[^']+)': \[/g)].map((m) => m[1]))] }
}

function sampleId(listFile) {
  const file = `public/data/live/zh/${listFile}.json`
  if (!fs.existsSync(file)) return null
  const first = Object.keys(JSON.parse(fs.readFileSync(file, 'utf8')))[0]
  return first ?? null
}

function concrete(route, listFile) {
  if (!route.includes(':id')) return route
  const id = sampleId(listFile)
  return id ? route.replace(':id', id) : null
}

function changedFiles() {
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).split('\n').map((s) => s.trim().replace(/\\/g, '/')).filter(Boolean)
  return [...git('diff', '--name-only', 'HEAD'), ...git('ls-files', '--others', '--exclude-standard')]
}

function inferRoutes() {
  const { map, listFile, listRoutes } = viewRoutes()
  const files = changedFiles()
  const routes = new Set()
  const unmapped = []
  let sharedSrc = false

  for (const file of files) {
    const view = /^src\/views\/([A-Za-z0-9]+)\.vue$/.exec(file)
    if (view) {
      const paths = map.get(view[1]) ?? []
      if (!paths.length) unmapped.push(file)
      for (const p of paths) {
        const key = /^\/([^/]+)/.exec(p)?.[1]
        const c = concrete(p, listFile.get(`/${key}`))
        if (c) routes.add(c)
      }
      continue
    }
    if (/^src\/|^index\.html$/.test(file)) sharedSrc = true
  }

  if (sharedSrc) for (const p of listRoutes) routes.add(p)
  if (sharedSrc) routes.add('/')

  return { routes: [...routes], unmapped, all: [...routes, ...unmapped] }
}

function buildRunner(config) {
  return `async (page) => {
  const config = ${JSON.stringify(config)}
  const out = { base: config.base, axe: config.axe, routes: [], consoleErrors: [], failedRequests: [] }
  const hmr = /WebSocket|\\[vite\\]|hot-update|@vite|@react-refresh/i
  page.on('pageerror', (e) => out.consoleErrors.push(String(e && e.message ? e.message : e)))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const text = m.text()
    if (hmr.test(text) || /^Failed to load resource/.test(text)) return
    out.consoleErrors.push(text)
  })
  page.on('requestfailed', (r) => {
    const url = r.url()
    if (/^wss?:/i.test(url) || hmr.test(url)) return
    out.failedRequests.push(url + ' ' + ((r.failure() && r.failure().errorText) || ''))
  })
  page.on('response', (r) => {
    const url = r.url()
    if (r.status() < 400 || /^wss?:/i.test(url) || hmr.test(url)) return
    out.failedRequests.push(url + ' HTTP ' + r.status())
  })
  const slug = (r) => r.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'root'
  for (const route of config.routes) {
    const row = { route, widths: [] }
    out.routes.push(row)
    for (let wi = 0; wi < config.widths.length; wi++) {
      const width = config.widths[wi]
      const height = width >= 1024 ? 900 : width >= 700 ? 1024 : 844
      await page.setViewportSize({ width, height })
      await page.goto(config.base + route)
      await page
        .waitForFunction(
          () => {
            const main = document.querySelector('main')
            const len = main ? main.textContent.trim().length : 0
            const settled = !document.querySelector('.reveal')
            return document.readyState === 'complete' && settled && len > 80
          },
          null,
          { timeout: 8000 },
        )
        .catch(() => {})
      await page
        .waitForFunction(() => document.fonts && document.fonts.status === 'loaded', null, { timeout: 15000 })
        .catch(() => {})
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
      await page.waitForTimeout(150)
      const m = await page.evaluate(() => {
        const main = document.querySelector('main')
        const doc = document.documentElement
        return {
          h1: document.querySelectorAll('h1').length,
          h1Text: (document.querySelector('h1')?.textContent || '').trim().slice(0, 40),
          main: document.querySelectorAll('main').length,
          footer: document.querySelectorAll('footer').length,
          missingAlt: [...document.querySelectorAll('main img')].filter((i) => !i.hasAttribute('alt')).length,
          mainText: main ? main.textContent.trim().length : 0,
          overflow: doc.scrollWidth - doc.clientWidth,
        }
      })
      const entry = { width, ...m, shot: null, axe: null }
      if (config.shots) {
        entry.shot = config.outDir + '/' + slug(route) + '-' + width + '.png'
        await page.screenshot({ path: entry.shot })
      }
      if (config.axe && (wi === 0 || wi === config.widths.length - 1)) {
        await page.addScriptTag({ path: config.axePath })
        entry.axe = await page.evaluate(async () => {
          const res = await window.axe.run(document)
          return res.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, target: v.nodes[0]?.target?.join(' ') }))
        })
      }
      row.widths.push(entry)
    }
  }
  return JSON.stringify(out)
}
`
}

const cli = (args, options) => execFileSync('playwright-cli', args, { shell: true, stdio: 'ignore', ...options })

async function reachable(base) {
  try {
    const res = await fetch(`${base}/`)
    return res.ok
  } catch {
    return false
  }
}

function startDevServer(base) {
  const url = new URL(base)
  const child = spawn('npx', ['vite', '--port', url.port || '5173', '--strictPort'], { shell: true, stdio: 'ignore' })
  return child
}

function stopTree(child) {
  if (!child) return
  try {
    if (process.platform === 'win32') execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
    else child.kill('SIGTERM')
  } catch {}
}

async function waitFor(fn, timeoutMs) {
  const until = Date.now() + timeoutMs
  while (Date.now() < until) {
    if (await fn()) return true
    await new Promise((r) => setTimeout(r, 300))
  }
  return false
}

function run(config) {
  fs.mkdirSync(config.outDir, { recursive: true })
  const runnerFile = path.join(config.outDir, `runner-${process.pid}.js`)
  fs.writeFileSync(runnerFile, buildRunner(config), 'utf8')
  try {
    cli([`-s=${config.session}`, 'close'])
  } catch {}
  cli([`-s=${config.session}`, 'open', `${config.base}/`])
  try {
    const raw = execFileSync('playwright-cli', [`-s=${config.session}`, 'run-code', `--filename=${runnerFile}`, '--raw'], {
      shell: true,
      encoding: 'utf8',
      timeout: 180000,
    }).trim()
    const once = JSON.parse(raw)
    return typeof once === 'string' ? JSON.parse(once) : once
  } finally {
    try {
      cli([`-s=${config.session}`, 'close'])
    } catch {}
  }
}

function judge(result) {
  const failures = []
  const lines = []
  for (const route of result.routes) {
    for (const w of route.widths) {
      const problems = []
      if (w.h1 !== 1) problems.push(`h1=${w.h1}`)
      if (!w.h1Text) problems.push('h1 文案为空')
      if (w.main !== 1) problems.push(`main=${w.main}`)
      if (w.footer !== 1) problems.push(`footer=${w.footer}`)
      if (w.missingAlt !== 0) problems.push(`缺 alt 图片=${w.missingAlt}`)
      if (w.mainText < 120) problems.push(`正文过短=${w.mainText}（页面可能没渲染）`)
      if (w.overflow > 1) problems.push(`横向溢出=${w.overflow}px`)
      if (w.axe && w.axe.length > 0) problems.push(`axe=${w.axe.map((v) => `${v.id}(${v.impact}×${v.nodes})`).join(', ')}`)
      if (problems.length) failures.push({ route: route.route, width: w.width, problems })
      lines.push(`${problems.length ? '✗' : '✓'} ${route.route} @${w.width}${w.axe ? ' [axe]' : ''}`)
    }
  }
  for (const e of result.consoleErrors) failures.push({ route: '(console)', width: 0, problems: [e.slice(0, 200)] })
  for (const u of result.failedRequests ?? []) failures.push({ route: '(资源)', width: 0, problems: [u.slice(0, 200)] })
  return { failures, lines }
}

const HELP = `用法：pnpm run verify:ui [--] [选项]

  --route <路径>     只查该路由（可重复/逗号分隔）；缺省按改动推断
  --widths <列表>    视口宽（默认 1440,768,390）
  --base <origin>    目标服务（默认 ${DEV_ORIGIN}；不可用且是本机地址时自动起 dev 服务）
  --no-shots         不落截图
  --no-axe           不跑 axe
  --session <名称>   浏览器会话名（默认带进程号，天然不撞车）

检查项：渲染锚点（h1/main/footer/正文长度）、图片 alt、横向溢出、控制台错误、axe violations（首末两个视口）。
推断规则：改视图 → 只查它自己的路由；改共享组件/样式/工具 → 查首页 + 全部名录页。
截图与结果落在 ${OUT_DIR}/。`

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    console.log(HELP)
    return 0
  }
  if (!opts.routes.length) {
    const inferred = inferRoutes()
    if (inferred.unmapped.length) {
      console.error(`✖ 这些视图没有可推断的路由：${inferred.unmapped.join('、')}`)
      console.error(`  用 --route 显式给一条，例如 pnpm run verify:ui -- --route /agents/1011`)
      return 2
    }
    if (!inferred.routes.length) {
      console.error('✖ 改动里没有 src/ 或 index.html，推不出要查哪一页：请显式 --route')
      return 2
    }
    opts.routes = inferred.routes
    console.log(`推断路由（${opts.routes.length}）：${opts.routes.join('  ')}`)
  } else {
    opts.routes = [...new Set(opts.routes.map((r) => (r.startsWith('/') ? r : `/${r}`)))]
  }
  if (opts.axe && !fs.existsSync(AXE_PATH)) {
    console.error(`✖ 找不到 axe-core：${AXE_PATH}（node_modules 未安装？）`)
    return 2
  }

  let devServer = null
  if (!(await reachable(opts.base))) {
    const url = new URL(opts.base)
    if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      console.error(`✖ ${opts.base} 不可用（非本机地址，不会自动起服务）`)
      return 2
    }
    console.log(`  dev 服务未起，正在启动：npx vite --port ${url.port || '5173'}`)
    devServer = startDevServer(opts.base)
    if (!(await waitFor(() => reachable(opts.base), 30000))) {
      stopTree(devServer)
      console.error(`✖ 30 秒内没等到 ${opts.base}：手动 pnpm run dev 后重跑`)
      return 2
    }
  }

  try {
    const outDir = OUT_DIR
    const config = {
      base: opts.base,
      routes: opts.routes,
      widths: opts.widths,
      shots: opts.shots,
      axe: opts.axe,
      axePath: AXE_PATH,
      session: opts.session,
      outDir,
    }
    console.log(`快检 ${opts.routes.length} 个路由 × ${opts.widths.length} 个视口（${opts.base}）`)
    const result = run(config)
    const { failures, lines } = judge(result)
    fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify({ config, ...result, failures }, null, 2), 'utf8')
    for (const line of lines) console.log(`  ${line}`)
    if (opts.shots) console.log(`  截图：${outDir}/`)
    if (failures.length === 0) {
      console.log(`\n== 快检通过（${result.routes.length} 路由）==`)
      return 0
    }
    console.log(`\n== 快检失败：${failures.length} 项 ==`)
    for (const f of failures) console.log(`  ✖ ${f.route}${f.width ? ` @${f.width}` : ''} → ${f.problems.join('；')}`)
    console.log(`  明细：${outDir}/result.json`)
    return 1
  } finally {
    stopTree(devServer)
  }
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.message : err)
    console.error('  若报的是 playwright-cli 会话打不开：playwright-cli list 看残留，playwright-cli close 收掉')
    process.exit(1)
  },
)
