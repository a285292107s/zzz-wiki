/* ============================================================
 * verify-cjk-fonts.mjs — CJK 衬线分片字体完整性校验
 *
 * 校验 download-cjk-fonts.mjs 的产出（public/fonts/noto-serif-sc/）：
 *   1) 清单 JSON 存在且结构合法（family/weights/faces/files）
 *   2) files 中每个分片文件存在且非空
 *   3) 生成的 noto-serif-sc.css 内 @font-face 数与清单 faces 一致
 *   4) css 中引用的每个本地 url 都有对应文件、每个文件都被 css 引用
 *
 * 任一不满足 → 非零退出：分片缺失会让特定字符退回系统宋体（字形混排，
 * 比整段回退更刺眼）；css/清单漂移说明生成流程被手改。
 *
 * 离线可用（纯文件与文本检查）。
 * 用法：node scripts/verify-cjk-fonts.mjs
 * ============================================================ */

import fs from 'node:fs'
import path from 'node:path'

const MANIFEST = 'scripts/build/cjk-fonts-manifest.json'
const CSS_FILE = 'public/fonts/noto-serif-sc.css'
const DIR = 'public/fonts/noto-serif-sc'

let bad = 0
const fail = (msg) => {
  bad++
  console.error(`  ✖ ${msg}`)
}

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
}

console.log(
  bad
    ? `\n== CJK 字体校验 == 未通过（${bad} 项问题）`
    : `\n== CJK 字体校验 == 通过：${m.files.length} 个分片 / ${m.faces} 条 @font-face / 字重 ${m.weights.join('/')} 全部就绪`,
)
process.exitCode = bad ? 1 : 0
