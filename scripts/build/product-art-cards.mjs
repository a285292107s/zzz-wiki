import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'

const IMG_ROOT = path.resolve('public/data/img')
const ART_DIRS = ['weapon-art', 'bangboo-art']
const CARD = 'card'
const MAX_WIDTH = 800
const QUALITY = 72
const CONCURRENCY = 6

function artDirOf(name) {
  return path.join(IMG_ROOT, name)
}

function cardDirOf(name) {
  return path.join(artDirOf(name), CARD)
}

function sourceFiles(name) {
  const dir = artDirOf(name)
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.webp'))
    .map((d) => d.name)
}

function isStale(name, file) {
  const dest = path.join(cardDirOf(name), file)
  if (!fs.existsSync(dest)) return true
  return fs.statSync(path.join(artDirOf(name), file)).mtimeMs > fs.statSync(dest).mtimeMs
}

function prune(name, valid) {
  const dir = cardDirOf(name)
  if (!fs.existsSync(dir)) return 0
  let pruned = 0
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.webp') || valid.has(f)) continue
    fs.rmSync(path.join(dir, f))
    pruned++
  }
  return pruned
}

async function deriveDir(name, dry, acc) {
  const all = sourceFiles(name)
  const stale = all.filter((f) => isStale(name, f))
  acc.skipped += all.length - stale.length
  acc.total += all.length

  if (dry) {
    for (const f of stale) console.log(`  + ${name}/${CARD}/${f}`)
    acc.generated += stale.length
    return
  }

  if (all.length) fs.mkdirSync(cardDirOf(name), { recursive: true })

  const queue = [...stale]
  async function worker() {
    while (queue.length) {
      const file = queue.shift()
      const src = path.join(artDirOf(name), file)
      const dest = path.join(cardDirOf(name), file)
      try {
        await sharp(src)
          .resize({ width: MAX_WIDTH, withoutEnlargement: true })
          .webp({ quality: QUALITY })
          .toFile(dest)
        acc.bytes += fs.statSync(dest).size
        acc.generated++
      } catch (e) {
        acc.failed.push(`${name}/${file}: ${e.message}`)
        fs.rmSync(dest, { force: true })
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  acc.pruned += prune(name, new Set(all))
}

/**
 * @param {{dry?:boolean}} [opts]
 * @returns {Promise<{generated:number, skipped:number, pruned:number, failed:string[], dry:boolean, total:number, bytes:number}>}
 */
export async function runProductArtCards({ dry = false } = {}) {
  const acc = { generated: 0, skipped: 0, pruned: 0, failed: [], dry, total: 0, bytes: 0 }
  if (dry) console.log('== 产品图列表档派生差集（--dry，不写盘）==')
  for (const name of ART_DIRS) await deriveDir(name, dry, acc)
  return acc
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const dry = process.argv.includes('--dry')
  runProductArtCards({ dry })
    .then((r) => {
      console.log(
        `PRODUCT_ART_CARDS generated=${r.generated} skipped=${r.skipped} pruned=${r.pruned} failed=${r.failed.length} total=${r.total}` +
          (r.bytes ? ` bytes=${Math.round(r.bytes / 1024)}KB` : ''),
      )
      for (const f of r.failed) console.log(`  ⚠ ${f}`)
    })
    .catch((e) => {
      console.error('[product-art-cards] 意外异常：', e)
      process.exit(1)
    })
}
