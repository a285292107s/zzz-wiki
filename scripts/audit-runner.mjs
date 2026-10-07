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
console.log('**跑全套**：`npm run audit:all`（逐个执行 + 汇总 + 失败即非零退出；判据见 scripts/audit-all.mjs）')
console.log('单脚本：playwright-cli open http://localhost:4175 && playwright-cli run-code --filename=' + DIR + '/<脚本>')
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
console.log('\n目标值 / 当前实测 / 已知差距见 QUALITY.md（获奖级品质记分卡）；各脚本头注释含基线与取舍。\n')
