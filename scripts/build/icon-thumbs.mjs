/* ============================================================
 * icon-thumbs.mjs — 名录用图标小图派生（thumb 变体）
 *
 * 背景（2026-10 实测）：音擎/邦布图标原图 400-512px（均值 33-50KB），而名录行的
 * 展示格只有 38×38 CSS px（DPR3 亦只需 ~114px）——/w-engines 因此要传 1045KB 图片；
 * 详情页展示 278×278 仍需原图，故按「用途」派生而不动原图（与 hero card/mobile 同法）。
 *
 * 产出：public/data/img/{category}/thumb/{同名}.webp，最长边 ≤128px、q80。
 * 幂等：缺失或原图更新（重下）时重生；原图移除后清理孤儿。
 * 由 sync-data.ts 在图标下载后调用（单一写入者）；产物随 public/data 入库。
 *
 * 说明：character 图标（180×64 圆头像，均值 6KB）本就够小，不派生。
 *
 * CLI：node scripts/build/icon-thumbs.mjs [--dry]
 * ============================================================ */

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'

const IMG_ROOT = path.resolve('public/data/img')
/** 需要小图的类目（名录行 38×38 展示格；详情页用原图） */
const CATEGORIES = ['weapon', 'bangboo']
const THUMB_DIR = 'thumb'
/** 38×38 展示格 × DPR3 ≈ 114px，128px 留余量 */
const MAX_EDGE = 128
const QUALITY = 80
const CONCURRENCY = 6

function sourceFiles(cat) {
  const dir = path.join(IMG_ROOT, cat)
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.webp'))
    .map((d) => d.name)
}

function isStale(cat, file) {
  const src = path.join(IMG_ROOT, cat, file)
  const dest = path.join(IMG_ROOT, cat, THUMB_DIR, file)
  if (!fs.existsSync(dest)) return true
  return fs.statSync(src).mtimeMs > fs.statSync(dest).mtimeMs
}

/**
 * 派生名录图标小图（幂等补差）。
 * @param {{dry?:boolean}} [opts]
 * @returns {Promise<{generated:number, skipped:number, failed:string[], dry:boolean, total:number, bytes:number}>}
 */
export async function runIconThumbs({ dry = false } = {}) {
  const jobs = []
  const totals = { total: 0, skipped: 0 }
  for (const cat of CATEGORIES) {
    const all = sourceFiles(cat)
    totals.total += all.length
    const stale = all.filter((f) => isStale(cat, f))
    totals.skipped += all.length - stale.length
    for (const f of stale) jobs.push({ cat, file: f })
  }

  if (dry) {
    console.log('== 名录图标小图派生差集（--dry，不写盘）==')
    for (const j of jobs) console.log(`  + ${j.cat}/thumb/${j.file}`)
    return { generated: jobs.length, skipped: totals.skipped, failed: [], dry: true, total: totals.total, bytes: 0 }
  }

  for (const cat of CATEGORIES) fs.mkdirSync(path.join(IMG_ROOT, cat, THUMB_DIR), { recursive: true })

  const failed = []
  const queue = [...jobs]
  let generated = 0
  let bytes = 0

  async function worker() {
    while (queue.length) {
      const { cat, file } = queue.shift()
      const src = path.join(IMG_ROOT, cat, file)
      const dest = path.join(IMG_ROOT, cat, THUMB_DIR, file)
      try {
        await sharp(src)
          .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: QUALITY })
          .toFile(dest)
        bytes += fs.statSync(dest).size
        generated++
      } catch (e) {
        failed.push(`${cat}/${file}: ${e.message}`)
        fs.rmSync(dest, { force: true }) // 半成品不留盘
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  // 孤儿清理：原图移除后 thumb 不留
  for (const cat of CATEGORIES) {
    const valid = new Set(sourceFiles(cat))
    const dir = path.join(IMG_ROOT, cat, THUMB_DIR)
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.webp') && !valid.has(f)) fs.rmSync(path.join(dir, f))
    }
  }

  return { generated, skipped: totals.skipped, failed, dry: false, total: totals.total, bytes }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const dry = process.argv.includes('--dry')
  runIconThumbs({ dry })
    .then((r) => {
      console.log(
        `ICON_THUMBS generated=${r.generated} skipped=${r.skipped} failed=${r.failed.length} total=${r.total}` +
          (r.bytes ? ` bytes=${Math.round(r.bytes / 1024)}KB` : ''),
      )
      for (const f of r.failed) console.log(`  ⚠ ${f}`)
    })
    .catch((e) => {
      console.error('[icon-thumbs] 意外异常：', e)
      process.exit(1)
    })
}
