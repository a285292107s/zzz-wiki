/* ============================================================
 * download-cjk-fonts.mjs — CJK 衬线「原始分片」拉取（Noto Serif SC）
 *
 * 职责边界（2026-10 重构）：本脚本只负责把 Google 官方分片落到**下载缓存**
 * `.cache/cjk-raw/`（gitignored），并写出 faces.json（字重 + unicode-range）。
 * 「按站点实际字符集裁剪」由 subset-cjk-fonts.mjs 完成，产物才进 `public/`。
 * 这样仓库不再背负 5.8MB 未裁剪分片，而裁剪依据（字符集）变化时可重跑两级。
 *
 * 为何只拉 500 单档：站内 600 档零请求（详见 subset 脚本与 DATA_GUIDE §10）。
 *
 * 幂等：文件已存在且非空则跳过；官方分片 URL 稳定，版本升级时自动增补新片。
 * 失败仅告警不阻断——字体是持久资产，verify:fonts:cjk 门禁把守最终产物完整性，
 * 前端另有系统字体栈回退。
 *
 * 用法：node scripts/build/download-cjk-fonts.mjs
 * 环境：需外网；有代理时设 NODE_USE_ENV_PROXY=1。
 * ============================================================ */

import fs from 'node:fs'
import path from 'node:path'

const GA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
const FAMILY = 'Noto Serif SC'
/** 只保留 500：600 档在站内零请求，纯重量 */
const WEIGHTS = [500]
const CSS_URL = `https://fonts.googleapis.com/css2?family=${FAMILY.replace(/ /g, '+')}:wght@${WEIGHTS.join(';')}&display=swap`
const FONT_ORIGIN = 'https://fonts.gstatic.com/'

const RAW_DIR = '.cache/cjk-raw'
const FACES_OUT = path.join(RAW_DIR, 'faces.json')

/** css2 全文 → [{ weight, url, range, hash }] */
function parseFaces(css) {
  const out = []
  const blocks = css.split('@font-face').slice(1)
  for (const b of blocks) {
    const weight = /\bfont-weight:\s*(\d+)/.exec(b)?.[1]
    const url = /url\((https:[^)]+?\.woff2)\)/.exec(b)?.[1]
    const range = /unicode-range:\s*([^;]+);/.exec(b)?.[1]
    if (!weight || !url || !range) continue
    if (!WEIGHTS.includes(Number(weight))) continue
    const hash = url.split('/').pop().replace('.woff2', '')
    out.push({ weight, url, range: range.trim(), hash })
  }
  return out
}

export async function runDownloadCjkFonts() {
  const res = await fetch(CSS_URL, { headers: { 'User-Agent': GA } })
  if (!res.ok) throw new Error(`css2 HTTP ${res.status}`)
  const css = await res.text()
  const faces = parseFaces(css)
  if (faces.length === 0) throw new Error('未解析到任何 @font-face（响应结构变更？）')

  fs.mkdirSync(RAW_DIR, { recursive: true })
  let downloaded = 0
  let skipped = 0
  const failed = []
  const files = []

  for (const f of faces) {
    const file = `${f.weight}-${f.hash}.woff2`
    const dest = path.join(RAW_DIR, file)
    files.push({ weight: f.weight, file, range: f.range, hash: f.hash })
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      skipped++
      continue
    }
    if (!f.url.startsWith(FONT_ORIGIN)) {
      failed.push({ key: file, msg: 'url 非允许主机' })
      continue
    }
    try {
      const r = await fetch(f.url)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()))
      downloaded++
    } catch (e) {
      failed.push({ key: file, msg: e instanceof Error ? e.message : String(e) })
    }
  }

  // 只登记本地确实就位的分片：裁剪阶段以 faces.json 为唯一输入
  const ready = files.filter((f) => fs.existsSync(path.join(RAW_DIR, f.file)))
  fs.writeFileSync(
    FACES_OUT,
    JSON.stringify({ family: FAMILY, weights: WEIGHTS, faces: ready }, null, 2) + '\n',
  )

  console.log(
    `== CJK 原始分片 == 共 ${faces.length}，下载 ${downloaded}，缓存命中 ${skipped}，失败 ${failed.length}`,
  )
  console.log(`   清单：${FACES_OUT}（裁剪用：npm run subset:fonts:cjk）`)
  for (const x of failed.slice(0, 10)) console.log(`  ⚠ ${x.key}: ${x.msg}`)
  if (failed.length > 10) console.log(`  ⚠ …共 ${failed.length} 项失败（重跑本脚本幂等补差）`)
  return { total: faces.length, downloaded, skipped, failed: failed.length }
}

// 作为脚本直接执行时运行（被 import 时不自动跑）
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  runDownloadCjkFonts().catch((e) => {
    console.error('[cjk-fonts] ', e instanceof Error ? e.message : e)
    console.warn(
      '⚠ CJK 原始分片拉取失败——tokens.css 的 serif 链仍回退系统字体（不破版）；网络恢复后重跑本脚本',
    )
    process.exit(0)
  })
}
