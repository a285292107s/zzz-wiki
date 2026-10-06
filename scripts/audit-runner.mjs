/* ============================================================
 * audit-runner.mjs — npm run audit：列出可用审计脚本与用法
 * （脚本本体是 playwright-cli run-code --filename 目标，需 preview 运行中）
 * ============================================================ */

import fs from 'node:fs'
import path from 'node:path'

const DIR = 'scripts/audits'
const files = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.js'))
  .sort()

console.log('\n== 品质审计工具箱 ==（需 preview :4175 运行中）\n')
console.log('运行方式（每脚本）：playwright-cli open http://localhost:4175 && playwright-cli run-code --filename=' + DIR + '/<脚本>')
console.log('')
for (const f of files) {
  const src = fs.readFileSync(path.join(DIR, f), 'utf8')
  const docLine = src
    .split('\n')
    .find((l) => l.includes('基线') || l.includes('检查项') || l.trim().startsWith('// '))
    ?.replace(/^[\s/()*|-]+/, '')
    ?.slice(0, 60)
  console.log(`  ${f.padEnd(24)} ${docLine ?? ''}`)
}
console.log('\n基线数值与取舍记录见 temp/quality-baseline.md（重建方法见各脚本头注释）。\n')
