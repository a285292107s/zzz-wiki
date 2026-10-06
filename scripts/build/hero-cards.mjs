/* ============================================================
 * hero-cards.mjs — 首页「今日角色」头图派生（card 变体）
 *
 * Mindscape 原图 (~500KB/张，高分辨率全景) 同时服务两处：
 *   - 详情页 AgentHead：满栏底图 → 需要原图
 *   - 首页 9:16 标本卡：约 320px 宽展示格（retina ×2 ≈ 640px，含构图 zoom ≤1.5）
 *     → 原图严重超采，4 张并列时首屏多传 ~1.5MB
 *
 * 本脚本为每张原图派生 card 变体：public/data/img/hero/card/{同名}.webp
 * （最长边 ≤800px 等比缩放，quality 68）。等比缩放不改构图坐标系，
 * 卡片的 pos/zoom/originY 校准参数（featured-pool.json）无需重算。
 *
 * 规格依据（实测，2026-10）：卡片展示格手机 242 / 桌面 291 CSS px，最大 DPR3
 * ⇒ 物理需求 ≤726px；800px 覆盖 DPR3 并留 ~10% 余量（原 1000px/q78 超采 1.4 倍）。
 * 4 张并列的首屏图片载荷 187KB → ~120KB，肉眼无损。
 *
 * 幂等：card 已存在且不旧于原图时跳过；原图更新（重下/换形态）后自动重派生。
 * 由 sync-data.ts 在图标下载后调用（单一写入者），派生图随 public/data 约定入库
 * （部署 build:ci 只构建已提交快照，不重建数据）。
 *
 * CLI：node scripts/build/hero-cards.mjs [--dry]
 * ============================================================ */

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'

const HERO_DIR = path.resolve('public/data/img/hero')
const CARD_DIR = path.join(HERO_DIR, 'card')
/** 卡片展示格手机 242 / 桌面 291 CSS px；DPR3 ⇒ ≤726px，800px 留 ~10% 余量 */
const MAX_WIDTH = 800
const QUALITY = 68
const CONCURRENCY = 4

/** 原图列表：仅 hero 根目录的 .webp（不含 card/ 子目录） */
function sourceHeroes() {
  return fs
    .readdirSync(HERO_DIR, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.webp'))
    .map((d) => d.name)
}

/** 派生是否需要（重）生成：缺失或原图比 card 新（重下/换形态后自动跟随） */
function isStale(src) {
  const dest = path.join(CARD_DIR, src)
  if (!fs.existsSync(dest)) return true
  return fs.statSync(path.join(HERO_DIR, src)).mtimeMs > fs.statSync(dest).mtimeMs
}

/**
 * 派生今日角色 card 头图（幂等补差）。
 * @param {{dry?:boolean}} [opts] dry 只列出将生成的差集、不写盘
 * @returns {Promise<{generated: number, skipped: number, failed: string[], dry: boolean, total: number}>}
 */
export async function runHeroCards({ dry = false } = {}) {
  const all = fs.existsSync(HERO_DIR) ? sourceHeroes() : []
  const stale = all.filter(isStale)

  if (dry) {
    console.log('== hero card 派生差集（--dry，不写盘）==')
    for (const f of stale) console.log(`  + hero/card/${f}`)
    return { generated: stale.length, skipped: all.length - stale.length, failed: [], dry: true, total: all.length }
  }

  fs.mkdirSync(CARD_DIR, { recursive: true })
  const failed = []
  const queue = [...stale]
  let generated = 0

  async function worker() {
    while (queue.length) {
      const file = queue.shift()
      const src = path.join(HERO_DIR, file)
      const dest = path.join(CARD_DIR, file)
      try {
        await sharp(src).resize({ width: MAX_WIDTH, withoutEnlargement: true }).webp({ quality: QUALITY }).toFile(dest)
        generated++
      } catch (e) {
        failed.push(`${file}: ${e.message}`)
        fs.rmSync(dest, { force: true }) // 半成品不留盘：下次重派生
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  // 原图已从 hero/ 移除的孤儿 card 清理（形态表变更等），保持 card/ 与原图一一对应
  const valid = new Set(all)
  for (const f of fs.readdirSync(CARD_DIR)) {
    if (f.endsWith('.webp') && !valid.has(f)) fs.rmSync(path.join(CARD_DIR, f))
  }

  return { generated, skipped: all.length - stale.length, failed, dry: false, total: all.length }
}

/* CLI 入口（sync-data 进程内调用 runHeroCards，不经本分支） */
if (process.argv[1] && pathToFileURLSafe(process.argv[1]) === import.meta.url) {
  const dry = process.argv.includes('--dry')
  runHeroCards({ dry })
    .then((r) => {
      console.log(
        `HERO_CARDS generated=${r.generated} skipped=${r.skipped} failed=${r.failed.length} total=${r.total}`,
      )
      for (const f of r.failed) console.log(`  ⚠ ${f}`)
    })
    .catch((e) => {
      console.error('[hero-cards] 意外异常：', e)
      process.exit(1)
    })
}

function pathToFileURLSafe(p) {
  try {
    return pathToFileURL(p).href
  } catch {
    return ''
  }
}
