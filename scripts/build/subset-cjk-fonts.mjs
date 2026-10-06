/* ============================================================
 * subset-cjk-fonts.mjs — 按站点实际字符集裁剪 CJK 衬线分片（产物进 public/）
 *
 * 为什么需要：Google 官方分片按编码区切，每片覆盖数千码位（~20-80KB），
 * 而页面只用到其中寥寥几十字。实测首页要拉 13 片 / 924KB —— 这是当前 LCP
 * 的主要构成（文字 LCP 随字体换装重新计时，见 DATA_GUIDE §10）。
 *
 * 做法：
 *   1. 读 `.cache/cjk-raw/faces.json`（download-cjk-fonts.mjs 的产出）
 *   2. collectCharset() 得到站点可渲染字符集（数据 JSON + 代码字符串 + index.html）
 *   3. 逐片取「该片 unicode-range ∩ 站点字符集」，用 subset-font 裁剪并把
 *      可变字重轴钉在 500（站内唯一字重档位）
 *   4. 输出到 public/fonts/noto-serif-sc/，文件名取内容 sha1 前 10 位（内容寻址：
 *      字符集变化 → 文件名变化 → 天然破缓存），并清理未被引用的旧文件
 *   5. 重生成 public/fonts/noto-serif-sc.css（unicode-range 只保留**实际覆盖**的
 *      码位，浏览器不会为不存在的字形发起请求）与脚本清单
 *
 * 正确性由 verify-cjk-fonts.mjs 的「字符集全覆盖」门禁把守：站点字符集中任一
 * 字符必须落在某个 @font-face 的 unicode-range 内，否则该字退回系统宋体
 * （字形混排比整段回退更刺眼）。
 *
 * 用法：node scripts/build/subset-cjk-fonts.mjs（需先跑 download:fonts:cjk）
 * ============================================================ */

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import subsetFont from 'subset-font'
import { collectCharset, codepoints, parseUnicodeRange, toUnicodeRange } from './charset.mjs'

const RAW_DIR = '.cache/cjk-raw'
const FACES_IN = path.join(RAW_DIR, 'faces.json')
const FACE_DIR = 'public/fonts/noto-serif-sc'
const CSS_OUT = 'public/fonts/noto-serif-sc.css'
const MANIFEST_OUT = 'scripts/build/cjk-fonts-manifest.json'
const FAMILY = 'Noto Serif SC'
/** 站内唯一字重档位。注意：Google 现行分片是**静态实例**（无 fvar 轴，
 *  usWeightClass=500）——不要去钉可变轴（harfbuzz 会报 axis 不存在并中断）。 */
const WEIGHT = 500
/** 单片体积目标（KB）：Google 官方分片按编码区切，常用字集中在少数 30-47KB 大
 *  分片里，页面为一个分片付全部字节而只用其中几十字。这里对超目标分片按码位
 *  二分递归细分——页面只为「含它所需字形」的小片付费，实测首页载荷再降约一半。
 *  调小 = 更省字节但更多请求；10KB 是两者平衡点（HTTP/2 多路复用成本低）。 */
const TARGET_KB = Number(process.env.CJK_TARGET_KB ?? 10)
const TARGET = TARGET_KB * 1024

async function main() {
  if (!fs.existsSync(FACES_IN)) {
    console.error(`✖ 缺少 ${FACES_IN}——先跑 npm run download:fonts:cjk（需外网）`)
    process.exit(1)
  }
  const raw = JSON.parse(fs.readFileSync(FACES_IN, 'utf8'))
  const faces = raw.faces ?? []
  if (!faces.length) {
    console.error('✖ faces.json 中无分片记录')
    process.exit(1)
  }

  const points = codepoints(collectCharset())
  fs.mkdirSync(FACE_DIR, { recursive: true })

  const emitted = []
  let rawBytes = 0
  let outBytes = 0
  let skipped = 0

  /** 递归细分：整片裁剪若超目标，按码位二分再裁，直到每片 ≤ TARGET（或字符太少） */
  async function sliceFace(buf, chars, out, depth = 0) {
    const sub = await subsetFont(buf, String.fromCodePoint(...chars), { targetFormat: 'woff2' })
    if (sub.length <= TARGET || chars.length < 24 || depth >= 5) {
      out.push({ chars, buf: sub })
      return
    }
    const mid = Math.ceil(chars.length / 2)
    await sliceFace(buf, chars.slice(0, mid), out, depth + 1)
    await sliceFace(buf, chars.slice(mid), out, depth + 1)
  }

  for (const face of faces) {
    const src = path.join(RAW_DIR, face.file)
    if (!fs.existsSync(src)) {
      console.warn(`  ⚠ 原始分片缺失，跳过：${face.file}`)
      skipped++
      continue
    }
    const rangeSet = parseUnicodeRange(face.range)
    const covered = points.filter((p) => rangeSet.has(p))
    if (!covered.length) {
      skipped++
      continue
    }
    const buf = fs.readFileSync(src)
    rawBytes += buf.length
    const pieces = []
    await sliceFace(buf, covered, pieces)
    for (const piece of pieces) {
      outBytes += piece.buf.length
      const hash = crypto.createHash('sha1').update(piece.buf).digest('hex').slice(0, 10)
      const outFile = `${face.weight}-${hash}.woff2`
      fs.writeFileSync(path.join(FACE_DIR, outFile), piece.buf)
      emitted.push({ file: outFile, range: toUnicodeRange(piece.chars), chars: piece.chars.length })
    }
  }

  // 不同源片裁剪后字节可能相同（内容寻址同名）——按文件名去重
  const byFile = new Map()
  for (const e of emitted) if (!byFile.has(e.file)) byFile.set(e.file, e)
  const finalFaces = [...byFile.values()].sort((a, b) => a.file.localeCompare(b.file))

  // 清理未被引用的旧文件（切换裁剪策略/字符集变化后不留孤儿）
  const referenced = new Set(finalFaces.map((f) => f.file))
  let removed = 0
  for (const f of fs.readdirSync(FACE_DIR)) {
    if (!referenced.has(f)) {
      fs.unlinkSync(path.join(FACE_DIR, f))
      removed++
    }
  }

  const ratio = ((1 - outBytes / Math.max(rawBytes, 1)) * 100).toFixed(0)
  // 字体「能提供」的码位并集（源分片 unicode-range 之并）——verify 门禁据此界定
  // 必须覆盖的字符：字体本就没有的字形（谚文等）任何方案下都回退，不算缺口。
  // 固化进清单，使门禁在离线 CI（无 .cache/）下依然有效。
  const supply = new Set()
  for (const face of faces) for (const p of parseUnicodeRange(face.range)) supply.add(p)
  const supplyRange = toUnicodeRange([...supply].sort((a, b) => a - b))
  const lines = [
    '/* ============================================================',
    ' * Noto Serif SC 自托管（scripts/build/subset-cjk-fonts.mjs 生成，勿手改）',
    ` * ${FAMILY} ${WEIGHT} · 按站点字符集裁剪的 unicode-range 分片`,
    ` * ${finalFaces.length} 片 / ${(outBytes / 1024).toFixed(0)}KB（同批源片 ${(
      rawBytes / 1024
    ).toFixed(0)}KB，缩减 ${ratio}%）`,
    ' * 浏览器按页面实际字形按需加载；运行时零外部请求。字符集全覆盖由',
    ' * scripts/verify-cjk-fonts.mjs 门禁把守。',
    ' * ============================================================ */',
    '',
  ]
  for (const f of finalFaces) {
    lines.push('@font-face {')
    lines.push(`  font-family: '${FAMILY}';`)
    lines.push('  font-style: normal;')
    lines.push(`  font-weight: ${WEIGHT};`)
    lines.push('  font-display: swap;')
    lines.push(`  src: url('/fonts/noto-serif-sc/${f.file}') format('woff2');`)
    lines.push(`  unicode-range: ${f.range};`)
    lines.push('}')
  }
  fs.writeFileSync(CSS_OUT, lines.join('\n') + '\n')

  fs.writeFileSync(
    MANIFEST_OUT,
    JSON.stringify(
      {
        family: FAMILY,
        weights: [WEIGHT],
        faces: finalFaces.length,
        files: finalFaces.map((f) => f.file),
        source: 'subset',
        charsetSize: points.length,
        sourceFaces: faces.length,
        sourceBytes: rawBytes,
        bytes: outBytes,
        supplyRange,
      },
      null,
      2,
    ) + '\n',
  )

  console.log(
    `== CJK 分片裁剪 == 源片 ${faces.length}（空片跳过 ${skipped}）→ 输出 ${finalFaces.length} 片`,
  )
  console.log(
    `   ${(rawBytes / 1024).toFixed(0)}KB → ${(outBytes / 1024).toFixed(0)}KB（缩减 ${ratio}%）· 字符集 ${points.length} 码点 · 清理旧文件 ${removed}`,
  )
}

main().catch((e) => {
  console.error('[subset-cjk] ', e instanceof Error ? e.message : e)
  process.exit(1)
})
