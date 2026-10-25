import { execFileSync, execSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export const DOC_RE = /\.(md|txt)$/

const norm = (p) => p.replace(/\\/g, '/').trim()
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()

export function collectChanged(base) {
  const tracked = git('diff', '--name-only', base).split('\n').map(norm).filter(Boolean)
  const untracked = git('ls-files', '--others', '--exclude-standard').split('\n').map(norm).filter(Boolean)
  return [...new Set([...tracked, ...untracked])]
}

export function lastCommitFiles() {
  try {
    return git('diff', '--name-only', 'HEAD~1', 'HEAD').split('\n').map(norm).filter(Boolean)
  } catch {
    return []
  }
}

const STEPS = {
  types: ['类型', 'npx vue-tsc -b'],
  tests: ['全量单测', 'pnpm test'],
  fonts: ['CJK 字体覆盖（新文案缺字会退回系统宋体）', 'node scripts/verify-cjk-fonts.mjs'],
  ui: ['页面快检（3 断点 + axe，自动起 dev 服务）', 'pnpm run verify:ui'],
  icons: ['本地图标完整性', 'node scripts/verify-icons.mjs --local'],
}

const RENDER_RE = /^(?:index\.html$|src\/App\.vue$|src\/main\.ts$|src\/(?:views|components|styles|composables|utils|data)\/)/

const NOTES = [
  [/^src\/domain\//, '域逻辑变了：数值口径由单测守；页面文案与结构由发版前的 audit:core（content-sweep）兜'],
  [/^public\/data\/(?!img\/)/, '数据真值变了：旧版会被读，先 pnpm run verify:data；预览后 pnpm run audit:core（content-sweep 读构建产物）'],
  [/^(?:vercel\.json|\.vercelignore|public\/sw\.js|public\/offline\.html)$/, '部署/缓存/离线面变了：node scripts/verify-vercel-config.mjs；预览后复跑 csp-check 与 offline-check'],
  [/^scripts\/audits\//, '审计脚本自己变了：先 playwright-cli list 收掉遗留会话，预览后只复跑被改的那一项'],
  [/^(?:src\/styles\/|public\/fonts\/)/, '设计令牌/字体资产变了：预览后复跑 color-audit、typography-audit、font-weight-calibration'],
  [/^(?:package\.json|pnpm-lock\.yaml|vitest\.config\.ts|vite\.config\.ts)$/, '构建/依赖面变了：收工前跑一次 pnpm run build:ci（含类型 + 资产门禁 + 部署段，约 25 秒）'],
]

export function plan(changed) {
  const steps = []
  const notes = []
  const hit = (re) => changed.some((f) => re.test(f))
  const app = changed.filter((f) => !DOC_RE.test(f))
  if (app.length === 0) return { steps, notes }
  steps.push(STEPS.types, STEPS.tests, STEPS.fonts)
  if (hit(RENDER_RE)) steps.push(STEPS.ui)
  if (hit(/^public\/data\/img\//)) steps.push(STEPS.icons)
  for (const [re, note] of NOTES) if (hit(re)) notes.push(note)
  return { steps, notes }
}

export function render(base, changed) {
  const { steps, notes } = plan(changed)
  const app = changed.filter((f) => !DOC_RE.test(f))
  const L = ['']
  L.push(`== 该跑什么 ==  基准 ${base} · 改动 ${changed.length} 个文件（其中非文档 ${app.length} 个）`)
  L.push('')
  if (app.length === 0) {
    L.push('  只有文档改动：不需要跑任何检查。')
    L.push('')
    return L.join('\n')
  }
  L.push('【自动跑】')
  for (const [label, cmd] of steps) L.push(`  ${cmd.padEnd(38)} ${label}`)
  if (notes.length) {
    L.push('')
    L.push('【手动看一眼】')
    for (const n of notes) L.push(`  · ${n}`)
  }
  L.push('')
  return L.join('\n')
}

function main() {
  const argv = process.argv.slice(2)
  const baseArg = argv.indexOf('--base') === -1 ? null : argv[argv.indexOf('--base') + 1]
  const filesFlag = argv.indexOf('--files')
  let base = baseArg
  let changed

  if (filesFlag !== -1) {
    const files = []
    for (let i = filesFlag + 1; i < argv.length && !argv[i].startsWith('--'); i++) files.push(...argv[i].split(','))
    base = '(来自 --files)'
    changed = [...new Set(files.map(norm).filter(Boolean))]
  } else if (baseArg) {
    base = baseArg
    changed = collectChanged(base)
  } else if (git('status', '--porcelain') !== '') {
    base = 'HEAD（未提交改动）'
    changed = collectChanged('HEAD')
  } else {
    base = 'HEAD~1（已提交的最新一次）'
    changed = lastCommitFiles()
  }

  process.stdout.write(render(base, changed))

  const { steps } = plan(changed)
  if (!argv.includes('--run') || steps.length === 0) return
  for (const [label, cmd] of steps) {
    process.stdout.write(`\n$ ${cmd}   # ${label}\n`)
    try {
      execSync(cmd, { stdio: 'inherit', shell: true })
    } catch (error) {
      process.exit(typeof error.status === 'number' ? error.status : 1)
    }
  }
}

const entry = process.argv[1]
const invokedDirectly =
  !!entry &&
  (() => {
    try {
      return import.meta.url.toLowerCase() === pathToFileURL(entry).href.toLowerCase()
    } catch {
      return false
    }
  })()
if (invokedDirectly) main()
