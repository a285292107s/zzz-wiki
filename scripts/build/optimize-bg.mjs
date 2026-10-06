/* ============================================================
 * optimize-bg.mjs — 静态背景/品牌图优化（一次性、可重跑）
 *
 * 背景与品牌图此前是「原图直出」：
 *   - page-bg.png 1920×1231 / 95KB：内页固定铺满视口（cover），手机视口 390×844
 *     只用到中心一条，1920px 超采 2.5 倍
 *   - home-bg.webp 2400×1080 / 213KB：首页壁纸，同样超采；但它同时是 og:image
 *     （2400×1080，index.html 已声明尺寸），故**保留原图**，另出窄屏变体
 *   - logo.png 229×244 / 11KB：站头以 24×26 CSS px 展示，超采近 5 倍
 *   - favicon.png 229×244 / 11KB
 *
 * 产出（webp 全平台可用；运行时仍零外部请求）：
 *   page-bg.webp（1920w q72）· page-bg-mobile.webp（900w q68）
 *   home-bg-mobile.webp（1100w q58，与原图同构图，仅尺寸/质量下调）
 *   logo.png 96×102（24×26 的 4x 上限，覆盖 DPR3 余量）
 *   favicon.png 180×192（iOS 主屏图标上限）
 *
 * 窄屏变体经 tokens.css 的媒体查询切换（--page-bg-image / --home-bg-image）。
 * 幂等：page-bg.png 首次转换后删除（webp 成为资产本体）。
 * 用法：node scripts/build/optimize-bg.mjs
 * ============================================================ */

import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const kb = (p) => Math.round(fs.statSync(p).size / 1024)
const report = []
const log = (name, before, after) => {
  report.push(`  ${name.padEnd(26)} ${String(before).padStart(4)}KB → ${String(after).padStart(4)}KB`)
}

async function makePageBg() {
  const src = fs.existsSync('public/page-bg.png') ? 'public/page-bg.png' : 'public/page-bg.webp'
  if (!fs.existsSync(src)) return console.warn('  ⚠ page-bg 源缺失，跳过')
  const before = kb(src)
  const meta = await sharp(src).metadata()
  await sharp(src).resize({ width: 1920, withoutEnlargement: true }).webp({ quality: 72 }).toFile('public/page-bg.webp')
  await sharp(src).resize({ width: 900, withoutEnlargement: true }).webp({ quality: 68 }).toFile('public/page-bg-mobile.webp')
  log(`page-bg ${meta.width}w`, before, kb('public/page-bg.webp'))
  if (src.endsWith('.png')) fs.unlinkSync(src)
}

async function makeHomeBgMobile() {
  if (!fs.existsSync('public/home-bg.webp')) return console.warn('  ⚠ home-bg.webp 缺失，跳过')
  const before = kb('public/home-bg.webp')
  await sharp('public/home-bg.webp').resize({ width: 1100, withoutEnlargement: true }).webp({ quality: 58 }).toFile('public/home-bg-mobile.webp')
  log('home-bg-mobile', before, kb('public/home-bg-mobile.webp'))
}

/** 就地重采样：仅当当前尺寸大于目标（幂等，重跑不二次缩水） */
async function shrinkInPlace(file, width, height) {
  if (!fs.existsSync(file)) return console.warn(`  ⚠ ${file} 缺失，跳过`)
  const meta = await sharp(file).metadata()
  if (meta.width <= width && meta.height <= height) {
    report.push(`  ${path.basename(file).padEnd(26)} 已是 ${meta.width}×${meta.height}，跳过`)
    return
  }
  const before = kb(file)
  const buf = await sharp(file).resize({ width, height, fit: 'inside', withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer()
  fs.writeFileSync(file, buf)
  log(`${path.basename(file)} ${meta.width}×${meta.height}`, before, kb(file))
}

async function main() {
  await makePageBg()
  await makeHomeBgMobile()
  await shrinkInPlace('public/logo.png', 96, 102)
  await shrinkInPlace('public/favicon.png', 180, 192)
  console.log('== 背景/品牌图优化 ==')
  console.log(report.join('\n'))
}

main().catch((e) => {
  console.error('[optimize-bg] ', e instanceof Error ? e.message : e)
  process.exit(1)
})
