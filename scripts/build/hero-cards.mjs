/* ============================================================
 * hero-cards.mjs — 首页「今日角色」头图派生（card / wide 两档变体）
 *
 * Mindscape 原图（1920-2580px、~350KB/张）同时服务多处：
 *   - 详情页 AgentHead：满栏底图 → 需要原图
 *   - 详情页 og:image（generate-route-html.mjs）与窄屏首屏卡片 → card 档
 *   - 首页「今日角色」整栏宽横幅 → wide 档
 *
 * 两档规格由**展示格的物理像素需求**反推，不靠感觉：
 *
 *   card（≤800px / q68）：窄屏取景框 = 100vw（390 宽 → 350 CSS px），乘逐图 zoom ≤1.49
 *     ⇒ 绘制宽 ≤448 CSS px：DPR1 余量近 2×，DPR2 需求 ~897px 略超 800（1.12×），
 *     DPR3 手机由 srcset 改选 wide。同日兼作 og:image（16:9 派生图天然适合卡片）。
 *
 *   wide（≤1600px / q72）：桌面取景框最宽 = 高度上限 clamp(240px,44vh,500px) × 2.36
 *     = 1180 CSS px，乘逐图 zoom（1.05-1.49）⇒ 绘制宽 1239-1758 CSS px。1920×1080 桌面的
 *     实际取景框是 1121 CSS px（1180 上界未及）⇒ 1121×1.28 ≈ 1435px，1600px 这一档留出余量
 *     （此前只有 800px 一档 → 被放大 1.96×、DPR2 下 3.9×，首页第一屏肉眼可见发糊）。
 *
 * 前端候选链（useFeaturedAgents.ts）把两档交给 srcset 让浏览器自己选：
 *   `card 800w, wide 1600w, 原图 1920w` + `sizes` = 挂载期取景框宽（纯 px，上界 1180px）
 *   ⇒ 手机/DPR≤2 取 card（~30KB）、桌面 DPR1 取 wide（~81KB）、DPR≥1.21 落回原图。
 *   **规格与展示格绑定**：改取景框尺寸/比例或 zoom 上界时必须重算这两档，否则又会糊。
 *
 * 幂等：某档已存在且不旧于原图时跳过；原图更新（重下/换形态）后自动重派生。
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

/** 派生档位：maxWidth/quality 的依据见文件头（展示格物理像素需求） */
const VARIANTS = [
  { name: 'card', dir: path.join(HERO_DIR, 'card'), maxWidth: 800, quality: 68 },
  { name: 'wide', dir: path.join(HERO_DIR, 'wide'), maxWidth: 1600, quality: 72 },
]
const CONCURRENCY = 4

/** 原图列表：仅 hero 根目录的 .webp（不含 card/ wide/ mobile/ 子目录） */
function sourceHeroes() {
  return fs
    .readdirSync(HERO_DIR, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.webp'))
    .map((d) => d.name)
}

/** 派生是否需要（重）生成：缺失或原图比派生新（重下/换形态后自动跟随） */
function isStale(variant, src) {
  const dest = path.join(variant.dir, src)
  if (!fs.existsSync(dest)) return true
  return fs.statSync(path.join(HERO_DIR, src)).mtimeMs > fs.statSync(dest).mtimeMs
}

/**
 * 派生今日角色头图（card + wide 两档，幂等补差）。
 * @param {{dry?:boolean}} [opts] dry 只列出将生成的差集、不写盘
 * @returns {Promise<{generated: number, skipped: number, failed: string[], dry: boolean, total: number,
 *   variants: Record<string, {generated: number, skipped: number}>}>}
 */
export async function runHeroCards({ dry = false } = {}) {
  const all = fs.existsSync(HERO_DIR) ? sourceHeroes() : []
  const stale = []
  const variants = {}
  for (const v of VARIANTS) {
    const jobs = all.filter((f) => isStale(v, f))
    variants[v.name] = { generated: 0, skipped: all.length - jobs.length }
    for (const f of jobs) stale.push({ v, f })
  }

  if (dry) {
    console.log('== hero 派生差集（--dry，不写盘）==')
    for (const { v, f } of stale) console.log(`  + hero/${v.name}/${f}`)
    return {
      generated: stale.length,
      skipped: all.length * VARIANTS.length - stale.length,
      failed: [],
      dry: true,
      total: all.length,
      variants,
    }
  }

  const failed = []
  const queue = [...stale]
  let generated = 0

  async function worker() {
    while (queue.length) {
      const { v, f } = queue.shift()
      const src = path.join(HERO_DIR, f)
      const dest = path.join(v.dir, f)
      try {
        fs.mkdirSync(v.dir, { recursive: true })
        await sharp(src)
          .resize({ width: v.maxWidth, withoutEnlargement: true })
          .webp({ quality: v.quality })
          .toFile(dest)
        variants[v.name].generated++
        generated++
      } catch (e) {
        failed.push(`${v.name}/${f}: ${e.message}`)
        fs.rmSync(dest, { force: true }) // 半成品不留盘：下次重派生
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  // 原图已从 hero/ 移除的孤儿派生清理（形态表变更等），保持各档与原图一一对应
  const valid = new Set(all)
  for (const v of VARIANTS) {
    if (!fs.existsSync(v.dir)) continue
    for (const f of fs.readdirSync(v.dir)) {
      if (f.endsWith('.webp') && !valid.has(f)) fs.rmSync(path.join(v.dir, f))
    }
  }

  return {
    generated,
    skipped: all.length * VARIANTS.length - stale.length,
    failed,
    dry: false,
    total: all.length,
    variants,
  }
}

/* CLI 入口（sync-data 进程内调用 runHeroCards，不经本分支） */
if (process.argv[1] && pathToFileURLSafe(process.argv[1]) === import.meta.url) {
  const dry = process.argv.includes('--dry')
  runHeroCards({ dry })
    .then((r) => {
      console.log(
        `HERO_CARDS generated=${r.generated} skipped=${r.skipped} failed=${r.failed.length} total=${r.total}`,
      )
      for (const [name, s] of Object.entries(r.variants)) {
        console.log(`  ${name}: generated=${s.generated} skipped=${s.skipped}`)
      }
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

