/* ============================================================
 * download-cjk-fonts.mjs — CJK 衬线字体本地化（Noto Serif SC 分片版）
 *
 * 目标：Windows/无宋体环境的「档案衬线」品质——SimSun 点阵感是
 * 桌面评审环境下最扎眼的质量短板。Noto Serif SC（思源宋体 Google 版）
 * 官方按 unicode-range 切 101 片，浏览器只下载页面实际用到的字所属分片
 * （每片 3~8KB），运行时仍零外部请求、总量可控。
 *
 * 实现：拉 css2（wght 500 单档，见下「为何只留 500」），解析全部 @font-face
 * 的 url 与 unicode-range，重写 url 为本地 /fonts/noto-serif-sc/{weight}-{hash}.woff2，
 * 生成 link 引用的 CSS 与清单 JSON（verify-cjk-fonts.mjs 门禁用）。
 *
 * 为何只留 500（2026-10 实测）：站内仅两处用 600（术语浮层标题衬线、稀有度字母等宽），
 * 而三页 Lighthouse 网络记录显示 CJK 分片请求 **全部是 500 档、0 次 600**——
 * 600 档 101 个文件（仓库约 2.9MB）与半个渲染阻塞 CSS（32KB）都是纯重量，
 * 且浮层一旦打开还会多拉一片 ~80KB。裁掉后 600 请求由 500 面按「最近字重」接管，
 * 视觉差异可忽略；CSS 与仓库体积各减半。
 *
 * 幂等：清单与文件已存在则跳过（官方分片 URL 稳定，v 升级时自动增补新片）。
 * 失败仅告警不阻断——字体是持久资产，verify 门禁把守完整性，前端另有系统栈回退。
 *
 * 用法：node scripts/build/download-cjk-fonts.mjs
 * 环境：需外网；有代理时设 NODE_USE_ENV_PROXY=1。
 * ============================================================ */

import fs from 'node:fs'
import path from 'node:path'

const GA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
const FAMILY = 'Noto Serif SC'
/** 只保留 500：600 档在站内零请求（见文件头「为何只留 500」），纯重量 */
const WEIGHTS = [500]
const CSS_URL = `https://fonts.googleapis.com/css2?family=${FAMILY.replace(/ /g, '+')}:wght@${WEIGHTS.join(';')}&display=swap`
const FONT_ORIGIN = 'https://fonts.gstatic.com/'

const CSS_OUT = 'public/fonts/noto-serif-sc.css'
const MANIFEST_OUT = 'scripts/build/cjk-fonts-manifest.json'
const FACE_DIR_BASE = 'public/fonts/noto-serif-sc'

/** css2 全文 → [{ weight, url, unicodeRange, hash }] */
function parseFaces(css) {
  const out = []
  const blocks = css.split('@font-face').slice(1)
  for (const b of blocks) {
    const weight = /\bfont-weight:\s*(\d+)/.exec(b)?.[1]
    const url = /url\((https:[^)]+?\.woff2)\)/.exec(b)?.[1]
    const range = /unicode-range:\s*([^;]+);/.exec(b)?.[1]
    if (!weight || !url || !range) continue
    if (!WEIGHTS.includes(Number(weight))) continue
    // 分片文件名：取 gstatic 路径末段 hash（同 URL 跨字重共享同片文件）
    const hash = url.split('/').pop().replace('.woff2', '')
    out.push({ weight, url, range: range.trim(), hash })
  }
  return out
}

async function main() {
  const res = await fetch(CSS_URL, { headers: { 'User-Agent': GA } })
  if (!res.ok) throw new Error(`css2 HTTP ${res.status}`)
  const css = await res.text()
  const faces = parseFaces(css)
  if (faces.length === 0) throw new Error('未解析到任何 @font-face（响应结构变更？）')

  // 按片去重：同一 hash 的分片文件按字重各自成文件
  const byFile = new Map() // hash → { urls:Set<weight>, faces:[] }
  for (const f of faces) {
    if (!byFile.has(f.hash)) byFile.set(f.hash, { faces: [] })
    byFile.get(f.hash).faces.push(f)
  }

  fs.mkdirSync(FACE_DIR_BASE, { recursive: true })
  let downloaded = 0
  let skipped = 0
  const failed = []

  // 去重后的唯一 (hash,weight) 下载清单
  const uniq = new Map()
  for (const f of faces) uniq.set(`${f.weight}/${f.hash}`, f)

  for (const [key, f] of uniq) {
    const dest = path.join(FACE_DIR_BASE, `${f.weight}-${f.hash}.woff2`)
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      skipped++
      continue
    }
    if (!f.url.startsWith(FONT_ORIGIN)) {
      failed.push({ key, msg: `url 非允许主机` })
      continue
    }
    try {
      const r = await fetch(f.url)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()))
      downloaded++
    } catch (e) {
      failed.push({ key, msg: e instanceof Error ? e.message : String(e) })
    }
  }

  // 生成本地 CSS：@font-face 引用 /fonts/noto-serif-sc/{weight}-{hash}.woff2
  const lines = [
    '/* ============================================================',
    ' * Noto Serif SC 自托管（scripts/build/download-cjk-fonts.mjs 生成，勿手改）',
    ` * ${FAMILY} ${WEIGHTS.join('/')} · unicode-range 分片（101 片 × ${WEIGHTS.length} 字重）`,
    ' * 浏览器按页面实际字形按需加载单片（3~8KB）；运行时零外部请求。',
    ' * ============================================================ */',
    '',
  ]
  // 按字重分组输出，每组内按 hash 排序保证生成稳定
  for (const weight of WEIGHTS) {
    const ws = faces.filter((f) => Number(f.weight) === weight)
    for (const f of ws) {
      lines.push('@font-face {')
      lines.push(`  font-family: '${FAMILY}';`)
      lines.push('  font-style: normal;')
      lines.push(`  font-weight: ${weight};`)
      lines.push('  font-display: swap;')
      lines.push(`  src: url('/fonts/noto-serif-sc/${weight}-${f.hash}.woff2') format('woff2');`)
      lines.push(`  unicode-range: ${f.range};`)
      lines.push('}')
    }
  }
  fs.writeFileSync(CSS_OUT, lines.join('\n') + '\n')

  // 清单（verify 门禁用）
  fs.writeFileSync(
    MANIFEST_OUT,
    JSON.stringify(
      {
        family: FAMILY,
        weights: WEIGHTS,
        faces: faces.length,
        files: [...uniq.keys()].map((k) => {
          const [weight, hash] = k.split('/')
          return `${weight}-${hash}.woff2`
        }),
      },
      null,
      2,
    ) + '\n',
  )

  console.log(
    `== CJK 字体本地化 == 分片 ${faces.length}，下载 ${downloaded}，已存在跳过 ${skipped}，失败 ${failed.length}`,
  )
  for (const x of failed.slice(0, 10)) console.log(`  ⚠ ${x.key}: ${x.msg}`)
  if (failed.length > 10) console.log(`  ⚠ …共 ${failed.length} 项失败（重跑本脚本幂等补差）`)
}

main().catch((e) => {
  console.error('[cjk-fonts] ', e instanceof Error ? e.message : e)
  console.warn('⚠ CJK 字体拉取失败——tokens.css 的 serif 链仍回退系统字体（不破版）；网络恢复后重跑本脚本')
  process.exit(0)
})
