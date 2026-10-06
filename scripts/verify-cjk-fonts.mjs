/* ============================================================
 * verify-cjk-fonts.mjs — CJK 衬线分片字体完整性 + 字符集覆盖校验
 *
 * 校验 subset-cjk-fonts.mjs 的产出（public/fonts/noto-serif-sc/ 与 CSS/清单）：
 *   1) 清单 JSON 存在且结构合法（family/weights/faces/files）
 *   2) files 中每个分片文件存在且非空
 *   3) 生成的 noto-serif-sc.css 内 @font-face 数与清单 faces 一致
 *   4) css 中引用的每个本地 url 都有对应文件、每个文件都被 css 引用
 *   5) **字符集全覆盖**：站点可渲染字符集（charset.mjs）中任一字符都必须落在
 *      某个 @font-face 的 unicode-range 内——缺一个字符，该字就会退回系统宋体，
 *      与相邻字形成字形混排（比整段回退更刺眼），而裁剪后不再有官方大分片兜底
 *
 * 任一不满足 → 非零退出。
 *
 * 离线可用（纯文件与文本检查）。
 * 用法：node scripts/verify-cjk-fonts.mjs
 * ============================================================ */

import fs from 'node:fs'
import path from 'node:path'
import { collectCharset, parseUnicodeRange } from './build/charset.mjs'

const MANIFEST = 'scripts/build/cjk-fonts-manifest.json'
const CSS_FILE = 'public/fonts/noto-serif-sc.css'
const DIR = 'public/fonts/noto-serif-sc'

let bad = 0
const fail = (msg) => {
  bad++
  console.error(`  ✖ ${msg}`)
}
const warn = (msg) => console.warn(`  ⚠ ${msg}`)

const m = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : null
if (!m || !Array.isArray(m.files) || !m.family || !Array.isArray(m.weights)) {
  fail(`清单 ${MANIFEST} 缺失或结构非法`)
  console.error('\n== CJK 字体校验 == 未通过')
  process.exit(1)
}

for (const f of m.files) {
  const p = path.join(DIR, f)
  const ok = fs.existsSync(p) && fs.statSync(p).size > 0
  if (!ok) {
    fail(`/fonts/noto-serif-sc/${f} 缺失或为空 → 该分片覆盖的字符退回系统宋体（字形混排）`)
    bad++
  }
}

const css = fs.existsSync(CSS_FILE) ? fs.readFileSync(CSS_FILE, 'utf8') : ''
if (!css) {
  fail(`${CSS_FILE} 缺失`)
} else {
  const faces = (css.match(/@font-face/g) || []).length
  if (faces !== m.faces) fail(`css @font-face 数 ${faces} ≠ 清单 faces ${m.faces}（生成流程被手改？）`)

  // css 引用 ↔ 文件 双向对账
  const referenced = new Set([...css.matchAll(/noto-serif-sc\/([^)']+)/g)].map((x) => x[1]))
  for (const r of referenced) {
    if (!m.files.includes(r)) fail(`css 引用了清单外文件 ${r}（清单过期）`)
  }
  for (const f of m.files) {
    if (!referenced.has(f)) fail(`文件 ${f} 未被 css 引用（孤儿分片）`)
  }

  const weights = new Set([...css.matchAll(/font-weight:\s*(\d+)/g)].map((x) => x[1]))
  for (const w of m.weights) {
    if (!weights.has(String(w))) fail(`css 缺少字重 ${w} 的 @font-face`)
  }

  // 5) 字符集覆盖：裁剪后没有官方大分片兜底，缺字即字形混排。
  //    判据限定在「字体自身能提供的码位」（清单 supplyRange，由 subset 阶段
  //    从源分片 unicode-range 并集固化）：字体本就没有的字形（谚文、部分符号）
  //    在任何方案下都会回退系统字体，不是裁剪缺口。
  const declared = new Set()
  for (const mt of css.matchAll(/unicode-range:\s*([^;]+);/g)) {
    for (const p of parseUnicodeRange(mt[1])) declared.add(p)
  }
  const canSupply = new Set(
    m.supplyRange ? parseUnicodeRange(m.supplyRange) : [],
  )
  if (!m.supplyRange) {
    warn('清单缺少 supplyRange（旧版产物）——跳过字符集覆盖校验；重跑 subset:fonts:cjk 可恢复')
  }

  const charset = collectCharset()
  const required = [...charset].filter((p) => canSupply.has(p))
  const missing = required.filter((p) => !declared.has(p))
  const unsupported = charset.size - required.length
  if (missing.length) {
    const sample = missing
      .slice(0, 24)
      .map((p) => String.fromCodePoint(p))
      .join('')
    fail(
      `字符集覆盖缺口 ${missing.length} 个（示例「${sample}」）→ 这些字会退回系统宋体；` +
        `重跑 npm run download:fonts:cjk && npm run subset:fonts:cjk`,
    )
  } else if (m.supplyRange) {
    console.log(
      `  字符集覆盖：字体可提供的 ${required.length} 码点全部已声明` +
        (unsupported > 0 ? `（另有 ${unsupported} 码点字体本就不含，按预期回退系统字体）` : ''),
    )
  }
}

console.log(
  bad
    ? `\n== CJK 字体校验 == 未通过（${bad} 项问题）`
    : `\n== CJK 字体校验 == 通过：${m.files.length} 个分片 / ${m.faces} 条 @font-face / 字重 ${m.weights.join('/')}` +
        (m.bytes ? ` / ${(m.bytes / 1024).toFixed(0)}KB（源片 ${(m.sourceBytes / 1024).toFixed(0)}KB）` : ''),
)
process.exitCode = bad ? 1 : 0
