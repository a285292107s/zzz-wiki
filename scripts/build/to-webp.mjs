import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'

export const DEFAULT_QUALITY = 85
export const DEFAULT_MAX_LONG_EDGE = 1600

function clampQuality(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return DEFAULT_QUALITY
  return Math.min(Math.max(Math.round(n), 1), 100)
}

export async function toWebp(input, { quality = DEFAULT_QUALITY, maxLongEdge = 0 } = {}) {
  let img = sharp(input, { animated: true })
  if (maxLongEdge > 0) {
    img = img.resize({
      width: maxLongEdge,
      height: maxLongEdge,
      fit: 'inside',
      withoutEnlargement: true,
    })
  }
  return img.webp({ quality: clampQuality(quality), effort: 5 }).toBuffer()
}

export async function writeWebp(src, dest, opts = {}) {
  const buffer = await toWebp(src, opts)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, buffer)
  return { bytes: buffer.length, dest }
}

export function parseArgs(argv = process.argv.slice(2)) {
  const args = { files: [], out: '', quality: DEFAULT_QUALITY, maxLongEdge: 0 }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--out') args.out = argv[++i] ?? ''
    else if (a === '--quality') args.quality = clampQuality(argv[++i])
    else if (a === '--max-edge') args.maxLongEdge = Number(argv[++i]) || 0
    else if (!a.startsWith('--')) args.files.push(a)
  }
  return args
}

async function main() {
  const args = parseArgs()
  if (!args.files.length || !args.out) {
    console.error('用法：node scripts/build/to-webp.mjs <src...> --out <dir> [--quality 85] [--max-edge 1600]')
    process.exit(2)
  }
  let total = 0
  for (const src of args.files) {
    const dest = path.join(args.out, `${path.basename(src, path.extname(src))}.webp`)
    const { bytes } = await writeWebp(src, dest, args)
    total += bytes
    console.log(`  ✓ ${path.basename(src)} → ${path.relative(process.cwd(), dest)}（${(bytes / 1024).toFixed(0)} KB）`)
  }
  console.log(`TO_WEBP files=${args.files.length} bytes=${total}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error('[to-webp]', e)
    process.exit(1)
  })
}
