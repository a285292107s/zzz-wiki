import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { exec, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import sharp from 'sharp'

const execAsync = promisify(exec)
const execFileAsync = promisify(execFile)

const ROOT = process.cwd()
const PUBLIC = path.join(ROOT, 'public')
const TEMPLATE = path.join(ROOT, 'scripts', 'build', 'og-card-template.html')
const LIST_FILE = path.join(PUBLIC, 'data', 'live', 'zh', 'character.json')
const ASSETS_FILE = path.join(ROOT, 'src', 'data', 'filter-assets.json')
const VARIANTS_FILE = path.join(ROOT, 'src', 'data', 'hero-gender-variants.json')
const POOL_FILE = path.join(ROOT, 'src', 'data', 'featured-pool.json')
const OUT_DIR = path.join(PUBLIC, 'og', 'agents')
const TMP_DIR = path.join(ROOT, 'temp', 'og-cards')
const RAW_DIR = path.join(TMP_DIR, 'raw')
const RUNNER_FILE = path.join('temp', 'og-cards', 'runner.js')
const PORT = Number(process.env.OG_CARD_PORT || 0)
const SESSION = `og-cards-${process.pid}`

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const localPath = (url) => path.join(PUBLIC, url.replace(/^\//, ''))

function buildJobs() {
  const list = readJson(LIST_FILE)
  const assets = readJson(ASSETS_FILE)
  const variants = readJson(VARIANTS_FILE)
  const pool = readJson(POOL_FILE)

  return Object.keys(list).map((id) => {
    const row = list[id]
    const hero = variants[id]?.defaultFile ?? `Mindscape_${id}_2`
    const heroFraming = pool.calibrated?.[id]?.modes?.hero ?? {}
    const element = row.special_element
      ? assets.specialElements[row.element]
      : assets.elements[row.element]
    return {
      id,
      name: row.zh || row.en || id,
      en: row.en || row.code || id,
      no: `NO. ${id}`,
      art: `/data/img/hero/${hero}.webp`,
      pos: heroFraming.pos ?? '50%',
      posY: heroFraming.posY ?? '50%',
      flipH: heroFraming.flipH === true,
      crest: `/data/img/filter/${assets.camps[row.camp]}.webp`,
      rank: `/data/img/filter/${assets.rarities[row.rank]}.webp`,
      element: `/data/img/filter/${element}.webp`,
      profession: `/data/img/filter/${assets.professions[row.type]}.webp`,
    }
  })
}

function validateJobs(jobs) {
  const missing = []
  for (const job of jobs) {
    for (const key of ['art', 'crest', 'rank', 'element', 'profession']) {
      if (!fs.existsSync(localPath(job[key]))) missing.push(`${job.id}:${key}:${job[key]}`)
    }
  }
  if (missing.length) throw new Error(`社交卡片素材缺失：\n${missing.join('\n')}`)
}

function buildServer() {
  return http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0])
    const file = urlPath === '/og-card-template.html' ? TEMPLATE : path.join(PUBLIC, urlPath)
    const relative = path.relative(ROOT, file)
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      res.writeHead(403).end()
      return
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404).end()
        return
      }
      res.writeHead(200, {
        'content-type': MIME[path.extname(file)] || 'application/octet-stream',
        'cache-control': 'no-store',
      })
      res.end(data)
    })
  })
}

function buildRunner(jobs, url) {
  return `async (page) => {
  const jobs = ${JSON.stringify(jobs)}
  const rawDir = ${JSON.stringify(RAW_DIR)}
  await page.setViewportSize({ width: 1200, height: 630 })
  await page.goto(${JSON.stringify(url)}, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  const done = []
  for (const job of jobs) {
    await page.evaluate(async (item) => {
      const art = document.getElementById('art')
      art.src = item.art
      art.style.objectPosition = item.pos + ' ' + item.posY
      art.style.transform = item.flipH ? 'scaleX(-1)' : 'none'
      document.getElementById('crest').src = item.crest
      document.getElementById('name').textContent = item.name
      document.getElementById('name-en').textContent = item.en
      document.getElementById('no').textContent = item.no
      const badges = document.querySelectorAll('#badges img')
      const icons = [item.rank, item.element, item.profession]
      badges.forEach((img, index) => {
        img.src = icons[index]
      })
      const name = document.getElementById('name')
      const width = () => {
        const range = document.createRange()
        range.selectNodeContents(name)
        return range.getBoundingClientRect().width
      }
      let size = 56
      name.style.fontSize = size + 'px'
      while (size > 34 && width() > 620) {
        size -= 2
        name.style.fontSize = size + 'px'
      }
      await Promise.all([...document.images].map((img) => img.decode().catch(() => {})))
      await document.fonts.ready
    }, job)
    await page.waitForTimeout(80)
    await page.screenshot({ path: rawDir + '/' + job.id + '.png', scale: 'device' })
    done.push(job.id)
  }
  return JSON.stringify({ count: done.length })
}`
}

async function render(jobs, url) {
  fs.writeFileSync(path.join(ROOT, RUNNER_FILE), buildRunner(jobs, url), 'utf8')
  await execAsync(`playwright-cli -s=${SESSION} close`).catch(() => {})
  await execAsync(`playwright-cli -s=${SESSION} open --device="Desktop Chrome HiDPI" "${url}"`, { timeout: 120000 })
  try {
    const { stdout } = await execFileAsync(
      'playwright-cli',
      [`-s=${SESSION}`, 'run-code', `--filename=${RUNNER_FILE}`, '--raw'],
      { encoding: 'utf8', shell: true, timeout: 600000, maxBuffer: 10 * 1024 * 1024 },
    )
    const once = JSON.parse(stdout.trim())
    return typeof once === 'string' ? JSON.parse(once) : once
  } finally {
    await execAsync(`playwright-cli -s=${SESSION} close`).catch(() => {})
  }
}

async function writeCards(jobs) {
  fs.rmSync(OUT_DIR, { recursive: true, force: true })
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const sizes = []
  for (const job of jobs) {
    const raw = path.join(RAW_DIR, `${job.id}.png`)
    if (!fs.existsSync(raw)) throw new Error(`缺少渲染结果：${raw}`)
    const out = path.join(OUT_DIR, `${job.id}.webp`)
    await sharp(raw).resize(1200, 630, { fit: 'fill', kernel: 'lanczos3' }).webp({ quality: 90, effort: 5 }).toFile(out)
    sizes.push(fs.statSync(out).size)
  }
  return sizes
}

async function main() {
  if (!fs.existsSync(TEMPLATE)) throw new Error(`模板缺失：${TEMPLATE}`)
  const jobs = buildJobs()
  validateJobs(jobs)

  fs.rmSync(RAW_DIR, { recursive: true, force: true })
  fs.mkdirSync(RAW_DIR, { recursive: true })

  const server = buildServer()
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve))
  const { port } = server.address()
  const url = `http://127.0.0.1:${port}/og-card-template.html`

  let result
  try {
    result = await render(jobs, url)
  } finally {
    server.close()
  }
  if (result?.count !== jobs.length) throw new Error(`渲染数量不符：${result?.count} / ${jobs.length}`)

  const sizes = await writeCards(jobs)
  const total = sizes.reduce((sum, size) => sum + size, 0)
  console.log(
    `== 代理人社交卡片 == 生成 ${jobs.length} 张 → public/og/agents/（合计 ${(total / 1024 / 1024).toFixed(2)}MB，` +
      `单张 ${(Math.min(...sizes) / 1024).toFixed(0)}–${(Math.max(...sizes) / 1024).toFixed(0)}KB）`,
  )
}

await main()
