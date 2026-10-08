/* ============================================================
 * audit-all.mjs — npm run audit:all：**一条命令跑完整个审计箱**
 *
 * 为什么需要：`npm run audit` 只**列出**脚本，27 个审计此前全靠人工逐个跑
 * （漏跑一个就等于没有那项保障——第 111 轮发现 `verify:icons` 从未接入任何链路，
 * 正是这类问题的另一面）。本脚本把它们串起来，并**显式声明每个脚本的通过判据**。
 *
 * 判据写在这里而不是靠「输出里有没有 failed 字段」猜：不同审计的返回结构不同，
 * 猜错会得到假绿。没有判据的脚本一律标「？需人工判读」，绝不默认通过。
 *
 * 前置：preview 在 :4175 运行（npm run build:ci && npm run preview）。
 * 用法：npm run audit:all
 * 退出码：0 全部通过 · 1 有失败 · 2 前置不满足（服务未起）
 * ============================================================ */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const DIR = 'scripts/audits'
const ORIGIN = 'http://localhost:4175'

/** 每个审计的通过判据（与 README 基线一一对应；新增脚本必须在此声明判据） */
const RULES = {
  'landmarks.js': (r) =>
    Object.values(r).every((p) => p.h1 === 1 && p.main === 1 && p.footer === 1 && p.imgsNoAlt === 0),
  'transfer-profile.js': (r) => r.failed === 0, // 首访传输预算（冷缓存总重/字体/图片）
  'slider-keyboard.js': (r) => Array.isArray(r) && r.length > 0 && r.every((x) => x.delta !== 0),
  'quick-search.js': (r) => r.failed === 0,
  'spacing-audit.js': (r) => r.layout?.offScale === 0,
  'viewport-overflow.js': (r) => r.total === 0,
  'touch-targets.js': (r) => (r.problems ?? []).length === 0,
  'ax-tree.js': (r) =>
    r.totalUnnamed === 0 &&
    (r.badH1 ?? []).length === 0 &&
    (r.skippedHeadings ?? []).length === 0 &&
    r.redundantImageNames === 0,
  'font-loading.js': (r) => r.serif === 'Noto Serif SC' && r.cssLink === true,
  'font-weight-calibration.js': (r) => /^OK/.test(r.verdict ?? ''),
  'reflow-spacing.js': (r) =>
    r.reflowOverflow === 0 && r.smallTargetsAt320 === 0 && r.spacingClipped === 0 && r.spacingOverlaps === 0,
  'csp-check.js': (r) => r.failed === 0 && r.violationEvents === 0,
  'content-sweep.js': (r) =>
    !r.error && r.pagesChecked > 0 && r.pagesWithAnomalies === 0 && r.thinPages === 0 && r.placeholderOnlySections === 0,
  'motion-audit.js': (r) => r.reducedLeftovers === 0 && r.veryLongNormal === 0,
  'interaction-states.js': (r) => r.totalNoHover === 0 && r.totalNoActive === 0 && r.noFeedbackAtAll === 0,
  'color-audit.js': (r) => r.totalOffPalette === 0 && r.totalLowControl === 0,
  'typography-audit.js': (r) => r.totalSizeViolations === 0 && r.totalFamilyViolations === 0,
  'keyboard-journey.js': (r) => r.failed === 0,
  'focus-visible.js': (r) => r.totalMissing === 0,
  'forced-colors.js': (r) => r.failed === 0,
  'print-mode.js': (r) => r.failed === 0,
  'offline-check.js': (r) => r.failed === 0,
  'axe-a11y.js': (r) => r.groups === 0 && r.serious === 0,
  'axe-states.js': (r) => r.serious === 0,
  'inp-interaction.js': (r) => typeof r.worst?.dur === 'number' && r.worst.dur < 200,
  'regression-walk.js': (r) => r.failed === 0,
  // 共享元素飞行：逐帧几何证明「真的在飞」（曾经静默空转 —— 只看动画类/动画对象验不出来）
  'hero-flight.js': (r) => r.failed === 0 && r.total >= 18,
}

function serverUp() {
  try {
    execFileSync('node', ['-e', `fetch('${ORIGIN}/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))`], {
      stdio: 'ignore',
      timeout: 8000,
    })
    return true
  } catch {
    return false
  }
}

function runCode(file) {
  const out = execFileSync('playwright-cli', ['run-code', `--filename=${DIR}/${file}`, '--raw'], {
    // Windows 上 playwright-cli 是 .cmd shim，Node 直接 spawn 找不到 → 走 shell 解析
    shell: true,
    encoding: 'utf8',
    timeout: 300000,
  }).trim()
  // playwright-cli --raw 输出的是**JSON 字符串**（双重编码）：先解一层拿字符串，再解一层拿对象
  const once = JSON.parse(out)
  return typeof once === 'string' ? JSON.parse(once) : once
}

const files = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.js'))
  .sort()

if (!serverUp()) {
  console.error(`✖ ${ORIGIN} 不可用：先 \`npm run build:ci && npm run preview\`（审计读的是构建产物）`)
  process.exit(2)
}

execFileSync('playwright-cli', ['open', `${ORIGIN}/`], {
  // Windows 上 playwright-cli 是 .cmd shim，Node 直接 spawn 找不到 → 走 shell 解析
  shell: true,
  stdio: 'ignore',
})

const rows = []
for (const f of files) {
  const rule = Object.prototype.hasOwnProperty.call(RULES, f) ? RULES[f] : undefined
  process.stdout.write(`  ${f.padEnd(26)} `)
  let status = '？'
  let detail = ''
  try {
    const result = runCode(f)
    if (rule === null) {
      status = '？'
      detail = '仅测量，需人工判读'
    } else if (typeof rule === 'function') {
      const ok = rule(result)
      status = ok ? '✓' : '✗'
      detail = ok ? '' : JSON.stringify(result).slice(0, 160)
    } else {
      status = '？'
      detail = '未声明判据（请在 audit-all.mjs 的 RULES 里补上）'
    }
    rows.push({ f, status, detail })
  } catch (e) {
    rows.push({ f, status: '✗', detail: `执行失败：${String(e.message).slice(0, 120)}` })
  }
  const last = rows[rows.length - 1]
  console.log(`${last.status} ${last.detail}`)
}

execFileSync('playwright-cli', ['close'], {
  // Windows 上 playwright-cli 是 .cmd shim，Node 直接 spawn 找不到 → 走 shell 解析
  shell: true,
  stdio: 'ignore',
})

const failed = rows.filter((r) => r.status === '✗')
const manual = rows.filter((r) => r.status === '？')
console.log(
  `\n== 审计箱全量：${rows.length} 个脚本 · 通过 ${rows.filter((r) => r.status === '✓').length} · 失败 ${failed.length} · 需人工判读 ${manual.length} ==`,
)
if (manual.length) console.log(`  （人工判读：${manual.map((m) => m.f).join('、')}）`)
for (const f of failed) console.log(`  ✖ ${f.f} → ${f.detail}`)
process.exit(failed.length ? 1 : 0)



