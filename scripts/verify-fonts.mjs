/* ============================================================
 * verify-fonts.mjs — 自托管字体可用性校验
 *
 * 校验 download:fonts 声明的每个字体文件在 public/fonts/ 存在且非空。
 * 缺失 → 非零退出：这类缺失会让 @font-face url(...) 404，虽然后端回退系统栈不破版，
 * 但「等宽编号 / 去 Inter 味」的本地字体意图丢失，也违反复用字体资产的预期。
 *
 * 无远程审计：字体是持久静态资产（commit 入库），无上游漂移，本地存在性即足够。
 *
 * 用法：node scripts/verify-fonts.mjs
 * 离线可用（纯文件存在性检查）。
 * ============================================================ */

import fs from 'node:fs'
import { FONTS, fontFile } from './build/font-inventory.mjs'

let bad = 0
let total = 0
for (const f of FONTS) {
  for (const w of f.weights) {
    total++
    const p = fontFile(f, w)
    const ok = fs.existsSync(p) && fs.statSync(p).size > 0
    console.log(`  ${ok ? '✓' : '✖'} /fonts/${f.file}-${w}.woff2${ok ? '' : ' 缺失 → @font-face 会 404、观感退化'}`)
    if (!ok) bad++
  }
}
console.log(`\n== 字体校验 == ${bad ? `${bad}/${total} 个字体文件缺失` : `${total} 个全部就绪`}`)
process.exitCode = bad ? 1 : 0
