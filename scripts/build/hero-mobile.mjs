/* ============================================================
 * hero-mobile.mjs — 详情页 hero 的窄屏派生（mobile 变体）
 *
 * Mindscape 原图（2552×1080，均值 351KB）在详情页满栏铺底（object-cover）：
 *   - 桌面：hero 盒 1168×497 CSS px，DPR2 需 ~2336px → 原图正合适
 *   - 手机：hero 盒 350×388，可见窗 350 CSS px；cover 缩放后源图等效需 ~1300px
 *     → 2552px 原图在手机上超采约 2 倍（314KB 换 ~130KB 的观感）
 * 故为手机派生 1400w 变体：public/data/img/hero/mobile/{同名}.webp
 *
 * 构图安全：等比缩放不改构图坐标系，AgentHead 的 pos/zoom/originY 校准参数
 * 对派生图同样成立（与 hero-cards 同一原则）。
 *
 * 幂等：派生缺失或原图更新（重下/换形态）时重生；原图移除后清理孤儿。
 * 由 sync-data.ts 在 card 派生之后调用（单一写入者）；产物随 public/data 入库。
 *
 * CLI：node scripts/build/hero-mobile.mjs [--dry]
 * ============================================================ */

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'

const HERO_DIR = path.resolve('public/data/img/hero')
const MOBILE_DIR = path.join(HERO_DIR, 'mobile')
/** 手机可见窗 350 CSS px；cover 后源图等效需求 ~1300px，1400px 留余量 */
const MAX_WIDTH = 1400
const QUALITY = 62
const CONCURRENCY = 4

function sourceHeroes() {
  return fs
    .readdirSync(HERO_DIR, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.webp'))
    .map((d) => d.name)
}

function isStale(src) {
  const dest = path.join(MOBILE_DIR, src)
  if (!fs.existsSync(dest)) return true
  return fs.statSync(path.join(HERO_DIR, src)).mtimeMs > fs.statSync(dest).mtimeMs
}

/**
 * 派生窄屏 hero（幂等补差）。
 * @param {{dry?:boolean}} [opts]
 * @returns {Promise<{generated:number, skipped:number, failed:string[], dry:boolean, total:number}>}
 */
export async function runHeroMobile({ dry = false } = {}) {
  const all = fs.existsSync(HERO_DIR) ? sourceHeroes() : []
  const stale = all.filter(isStale)

  if (dry) {
    console.log('== hero mobile 派生差集（--dry，不写盘）==')
    for (const f of stale) console.log(`  + hero/mobile/${f}`)
    return { generated: stale.length, skipped: all.length - stale.length, failed: [], dry: true, total: all.length }
  }

  fs.mkdirSync(MOBILE_DIR, { recursive: true })
  const failed = []
  const queue = [...stale]
  let generated = 0

  async function worker() {
    while (queue.length) {
      const file = queue.shift()
      const src = path.join(HERO_DIR, file)
      const dest = path.join(MOBILE_DIR, file)
      try {
        await sharp(src).resize({ width: MAX_WIDTH, withoutEnlargement: true }).webp({ quality: QUALITY }).toFile(dest)
        generated++
      } catch (e) {
        failed.push(`${file}: ${e.message}`)
        fs.rmSync(dest, { force: true }) // 半成品不留盘
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  const valid = new Set(all)
  for (const f of fs.readdirSync(MOBILE_DIR)) {
    if (f.endsWith('.webp') && !valid.has(f)) fs.rmSync(path.join(MOBILE_DIR, f))
  }

  return { generated, skipped: all.length - stale.length, failed, dry: false, total: all.length }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const dry = process.argv.includes('--dry')
  runHeroMobile({ dry })
    .then((r) => {
      console.log(
        `HERO_MOBILE generated=${r.generated} skipped=${r.skipped} failed=${r.failed.length} total=${r.total}`,
      )
      for (const f of r.failed) console.log(`  ⚠ ${f}`)
    })
    .catch((e) => {
      console.error('[hero-mobile] 意外异常：', e)
      process.exit(1)
    })
}
