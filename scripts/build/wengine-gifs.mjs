import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { downscale, encodeAnimation, sampleFrames, sourceFps } from './animated-webp.mjs'

const MANIFEST = path.resolve('src/data/wengine-gifs.json')
const OUT = path.resolve('public/data/img/wengine-gif')
const POSTER = path.join(OUT, 'poster')
const CACHE = path.resolve('.cache/wengine-gifs')
const STAMP = path.resolve('scripts/build/wengine-gifs-import.json')

const ATTEMPTS = [
  { fps: 30, quality: 55 },
  { fps: 20, quality: 55 },
  { fps: 15, quality: 55 },
  { fps: 12, quality: 55 },
  { fps: 10, quality: 55 },
  { fps: 8, quality: 50 },
  { fps: 6, quality: 50 },
]
const TARGET_BYTES = 1900 * 1024
const MAX_EDGE = 440
const EFFORT = 5
const POSTER_QUALITY = 80
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

const force = process.argv.includes('--force')
const onlyArg = process.argv.find((a) => a.startsWith('--only='))
const only = onlyArg ? onlyArg.slice('--only='.length).split(',').filter(Boolean) : null
const jobsArg = process.argv.find((a) => a.startsWith('--jobs='))
const JOBS = Math.max(1, Number(jobsArg ? jobsArg.slice('--jobs='.length) : 3))

function readJson(p, fallback) {
  if (!fs.existsSync(p)) return fallback
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function cachePath(id, url) {
  const hash = crypto.createHash('sha1').update(url).digest('hex').slice(0, 12)
  return path.join(CACHE, `${id}-${hash}.src`)
}

async function download(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  let lastError
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': USER_AGENT, referer: 'https://baike.mihoyo.com/' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length < 1024) throw new Error(`响应过小：${buf.length} 字节`)
      fs.writeFileSync(dest, buf)
      return
    } catch (error) {
      lastError = error
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)))
    }
  }
  throw new Error(`下载失败 ${url}：${lastError?.message ?? lastError}`)
}

const POSTER_FRAME_OVERRIDES = {}

function pickPosterFrame(id, raw, width, height, pages) {
  if (POSTER_FRAME_OVERRIDES[id] != null) return POSTER_FRAME_OVERRIDES[id]
  let bestPage = 0
  let bestScore = -1
  for (let page = 0; page < pages; page++) {
    const base = page * width * height * 4
    let score = 0
    for (let y = 1; y < height; y += 4) {
      for (let x = 1; x < width; x += 4) {
        const i = base + (y * width + x) * 4
        const left = i - 4
        const up = i - width * 4
        score +=
          Math.abs(raw[i] - raw[left]) +
          Math.abs(raw[i + 1] - raw[left + 1]) +
          Math.abs(raw[i + 2] - raw[left + 2]) +
          Math.abs(raw[i] - raw[up]) +
          Math.abs(raw[i + 1] - raw[up + 1]) +
          Math.abs(raw[i + 2] - raw[up + 2])
      }
    }
    if (score > bestScore) {
      bestScore = score
      bestPage = page
    }
  }
  return bestPage
}

async function convert(id, src) {
  const meta = await sharp(src, { animated: true }).metadata()
  const width = meta.width
  const height = meta.pageHeight
  const pages = meta.pages ?? 1
  if (!width || !height || pages < 2) throw new Error('不是有效的动画：pages=' + pages)
  const raw = await sharp(src, { animated: true }).ensureAlpha().raw().toBuffer()
  const expected = width * height * pages * 4
  if (raw.length !== expected) throw new Error(`帧数据长度不符：${raw.length} != ${expected}`)

  const delays = Array.isArray(meta.delay) ? meta.delay : [meta.delay ?? 50]
  const posterFrame = pickPosterFrame(id, raw, width, height, pages)
  const scaled = await downscale({ raw, width, height, pages, maxEdge: MAX_EDGE })
  const srcFps = sourceFps(delays)

  fs.mkdirSync(OUT, { recursive: true })
  fs.mkdirSync(POSTER, { recursive: true })

  const outFile = path.join(OUT, `${id}.webp`)
  let frames = 0
  let delay = 0
  let fps = 0
  let quality = 0
  for (const attempt of ATTEMPTS) {
    const plan = sampleFrames({
      pages,
      delays,
      posterFrame,
      targetFps: Math.min(attempt.fps, srcFps),
    })
    frames = plan.length
    delay = plan[0].delay
    fps = 1000 / delay
    quality = attempt.quality
    const buffer = await encodeAnimation({
      raw: scaled.raw,
      width: scaled.width,
      height: scaled.height,
      frames: plan,
      quality,
      effort: EFFORT,
    })
    fs.writeFileSync(outFile, buffer)
    if (buffer.length <= TARGET_BYTES) break
  }

  const posterFile = path.join(POSTER, `${id}.webp`)
  await sharp(raw.subarray(posterFrame * width * height * 4, (posterFrame + 1) * width * height * 4), {
    raw: { width, height, channels: 4 },
  })
    .webp({ quality: POSTER_QUALITY, effort: 4 })
    .toFile(posterFile)

  return {
    width: scaled.width,
    height: scaled.height,
    pages,
    frames,
    fps,
    quality,
    delay,
    posterFrame,
    bytes: fs.statSync(outFile).size,
    posterBytes: fs.statSync(posterFile).size,
  }
}

async function main() {
  const manifest = readJson(MANIFEST, {})
  const stamp = readJson(STAMP, {})
  const ids = Object.keys(manifest).filter((id) => !only || only.includes(id))
  if (!ids.length) throw new Error('清单为空')

  const nextStamp = { ...stamp }
  let converted = 0
  let skipped = 0
  let totalBytes = 0
  let finished = 0

  async function processId(id) {
    const entry = manifest[id]
    const outFile = path.join(OUT, `${id}.webp`)
    const posterFile = path.join(POSTER, `${id}.webp`)
    const previous = stamp[id]
    if (
      !force &&
      previous?.url === entry.url &&
      fs.existsSync(outFile) &&
      fs.existsSync(posterFile)
    ) {
      skipped++
      totalBytes += fs.statSync(outFile).size
      console.log(`[${++finished}/${ids.length}] ${id} 已存在，跳过`)
      return
    }

    const src = cachePath(id, entry.url)
    await download(entry.url, src)
    const info = await convert(id, src)
    nextStamp[id] = {
      url: entry.url,
      contentId: entry.contentId,
      sourceBytes: fs.statSync(src).size,
      ...info,
      generatedAt: new Date().toISOString(),
    }
    converted++
    totalBytes += info.bytes
    fs.writeFileSync(STAMP, JSON.stringify(nextStamp, null, 2) + '\n')
    console.log(
      `[${++finished}/${ids.length}] ${id} ${info.width}x${info.height} ${info.pages}→${info.frames} 帧 ${Math.round(info.bytes / 1024)}KB（海报 ${Math.round(info.posterBytes / 1024)}KB）`,
    )
  }

  const queue = [...ids]
  async function worker() {
    while (queue.length) await processId(queue.shift())
  }
  await Promise.all(Array.from({ length: JOBS }, worker))

  fs.writeFileSync(STAMP, JSON.stringify(nextStamp, null, 2) + '\n')
  console.log(
    `完成：转换 ${converted}，跳过 ${skipped}，本次产物合计 ${(totalBytes / 1024 / 1024).toFixed(1)}MB`,
  )
}

main().catch((error) => {
  console.error('✖ 音擎动画导入失败：', error)
  process.exit(1)
})
