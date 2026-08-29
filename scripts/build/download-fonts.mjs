/* ============================================================
 * download-fonts.mjs — 西文字体本地化（Tier 1）
 *
 * 从 Google Fonts css2 拉取自托管西文字体（JetBrains Mono / Public Sans，
 * 仅 latin 子集）→ public/fonts/{family}-{weight}.woff2，使站点
 * 「运行时零外部请求」且「等宽编号 / 去 Inter 味」真正落地。
 *
 * 幂等：已存在且非空则跳过，可重复运行增补缺失。
 * 网络失败仅告警，不置失败码——字体是**持久资产**，拉取属"增补/更新"而非部署必需；
 * 缺文件由 verify-fonts.mjs 门禁把守（含 CI），前端另有系统栈回退不破版。
 *
 * 用法：node scripts/build/download-fonts.mjs
 * 环境：需外网；有代理时设 NODE_USE_ENV_PROXY=1。
 * ============================================================ */

import fs from 'node:fs'
import { FONTS, FONT_DIR, fontFile } from './font-inventory.mjs'

const GA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

/** 仅允许从该字体 CDN 主机拉取（拒绝 css2 响应里混入的任意 https://*.woff2，防供应链/响应漂移） */
const FONT_ORIGIN = 'https://fonts.gstatic.com/'

async function cssFor(family, weights) {
  const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${weights.join(';')}&display=swap`
  const res = await fetch(url, { headers: { 'User-Agent': GA } })
  if (!res.ok) throw new Error(`fonts.css HTTP ${res.status} ${url}`)
  return await res.text()
}

/** 取指定字族 latin 子集（仅 latin，drop latin-ext/cyrillic/greek 等冗余）的 @font-face 清单 */
function latinFaces(css, weights) {
  const out = []
  // css2 按子集分组，每组以注释 `/* <subset> *​/` 开头
  const blocks = css.split(/\/\*\s*([a-z-]+)\s*\*\//).slice(1)
  for (let i = 0; i < blocks.length; i += 2) {
    const subset = blocks[i]
    const block = blocks[i + 1]
    if (subset !== 'latin') continue
    const weight = /\bfont-weight:\s*(\d+)/.exec(block)?.[1]
    if (!weight || !weights.includes(+weight)) continue
    const url = /url\((https:[^)]+?\.woff2)\)/.exec(block)?.[1]
    if (!url) continue
    out.push({ weight, url })
  }
  return out
}

async function main() {
  fs.mkdirSync(FONT_DIR, { recursive: true })
  let ok = 0
  let skipped = 0
  const failed = []

  for (const f of FONTS) {
    let faces
    try {
      faces = latinFaces(await cssFor(f.family, f.weights), f.weights)
    } catch (e) {
      failed.push({ family: f.family, weight: '', msg: e instanceof Error ? e.message : String(e) })
      continue
    }
    if (faces.length === 0) {
      console.warn(`  ⚠ ${f.family}: 未解析到 latin @font-face（疑为 Google Fonts 响应变更），请人工检查`)
      continue
    }
    for (const { weight, url } of faces) {
      const dest = fontFile(f, weight)
      if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
        skipped++
        continue
      }
      if (!url.startsWith(FONT_ORIGIN)) {
        failed.push({ family: f.family, weight, msg: `url 非允许主机（${FONT_ORIGIN}），已拒绝` })
        continue
      }
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
        ok++
      } catch (e) {
        failed.push({ family: f.family, weight, msg: e instanceof Error ? e.message : String(e) })
      }
    }
  }

  console.log(`== 字体本地化 == 下载 ${ok}，已存在跳过 ${skipped}，失败 ${failed.length}`)
  for (const x of failed) {
    console.log(`  ⚠ ${x.family}${x.weight ? '-' + x.weight : ''}: ${x.msg}（依赖仓库内既有字体/系统栈回退）`)
  }
  if (ok === 0 && skipped === 0 && failed.length === 0) {
    console.warn('⚠ 本次无任何下载/跳过/失败记录（疑为 Google Fonts 响应变更或未解析到 latin 子集），请人工检查')
  }
}

main()
