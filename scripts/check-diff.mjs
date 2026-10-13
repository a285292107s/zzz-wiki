/* ============================================================
 * check-diff.mjs — 按「实际改动」算出最小验证集（只读：不执行任何检查，只打印该跑什么）
 *
 * 用法：
 *   pnpm run check:diff                    有未提交改动 → 基准 HEAD；工作区干净 → 基准 HEAD~1
 *   pnpm run check:diff -- --base <ref>    指定基准
 *   node scripts/check-diff.mjs --files src/styles/base.css,src/views/HomeView.vue
 *                                          （不改仓库，直接问「这些文件该跑什么」）
 *
 * 为什么要有它：浏览器层一项就要几十秒（viewport-overflow 实测 52.4s，regression-walk 分钟级），
 * 「29 项里该跑哪些」不该由 AI 每次临场判断——没有成本信号时，判断必然滑向"全跑一遍最安全"。
 * 这里把「改了什么 → 该跑什么」变成仓库里的一张表，照着输出抄命令即可。
 * 依据与触发映射：docs/audit/2026-10-e2e-first-principles.md §4 P4（一次性产物）；
 * 新增审计脚本的准入判据见 scripts/audits/README.md。
 *
 * 结构：classify() 是纯函数（喂它文件清单即可，不碰 git、不打印），由 tests/check-diff.test.ts 守着；
 * collect() 是唯一读 git 的地方；改动规则表时请同步改测试。
 * ============================================================ */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

export const AUDIT_DIR = 'scripts/audits'
export const AUDIT_SCRIPTS = fs
  .readdirSync(AUDIT_DIR)
  .filter((f) => f.endsWith('.js'))
  .sort()

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
const norm = (p) => p.replace(/\\/g, '/').trim()

/* ---------- 一、路径规则：改到这个路径，就该跑这些脚本 ---------- */
export const SCRIPT_RULES = [
  {
    why: '首页共享元素飞行 / 视图过渡',
    re: /^(src\/utils\/viewTransition\/|src\/components\/home\/|src\/views\/HomeView\.vue$)/,
    scripts: ['hero-flight'],
  },
  {
    why: '设计令牌 / 字体资源',
    re: /^(src\/styles\/tokens\.css|src\/styles\/base\.css)$|\.(woff2?|ttf|otf)$/,
    scripts: ['font-weight-calibration', 'typography-audit', 'color-audit'],
  },
  {
    why: '离线与响应头',
    re: /^(public\/sw\.js|vercel\.json)$/,
    scripts: ['offline-check', 'csp-check'],
  },
  { why: '路由表 / 页面集合变了', re: /^src\/router\//, scripts: ['content-sweep', 'axe-a11y', 'landmarks'] },
  {
    why: '样式表（几何、间距、命中区都可能变）',
    re: /\.css$/,
    scripts: ['viewport-overflow', 'reflow-spacing', 'touch-targets', 'composition-audit'],
  },
  {
    why: '交互 / 键盘链路 / 滑条',
    // token 出现在文件名中即命中（不是紧贴 `.vue`）：NavScrollButton、SearchField 这类
    // 「token + 限定词」命名才是本仓库的常态，只认精确后缀会静默漏掉它们。
    re: /(Nav|Menu|Search|Slider|Dropdown|Pager|Toolbar|BackToTop)[A-Za-z]*\.vue$|^src\/composables\/use(Nav|Scroll|Focus|Detail|Quick)/,
    scripts: ['keyboard-journey', 'focus-visible', 'axe-states', 'slider-keyboard', 'quick-search'],
  },
  {
    why: '图片元素 / 图标资产（可访问名）',
    re: /^src\/components\/HollowImage\.vue$|^src\/domain\/filterIcons\.ts$/,
    scripts: ['ax-tree', 'axe-a11y'],
  },
  {
    why: '数据真值',
    re: /^public\/data\//,
    scripts: ['content-sweep'],
    commands: ['pnpm run verify:data'],
  },
  { why: '审计脚本自身被改（只复跑被改的那几项）', re: /^scripts\/audit/, selfAudit: true },
]

/* ---------- 二、内容探针：路径看不出、但读一眼就知道要跑什么 ----------
 * 只放「特殊模式」这类高精度信号：声明了就说明这文件真的管这条轴。
 * 不加 `font-weight`、`<img` 这种常见声明——它们会让每次组件改动都打出一串浏览器检查，
 * 工具一旦"狼来了"就会被无视，比不做还糟。字重与图片的归属脚本已由路径规则覆盖。
 * 探针只在 UI 类文件上生效：文档（.md）与脚本里提到 `@media print` 不是改动的风险面。 */
export const PROBES = [
  { text: '@media print', why: '含打印样式', scripts: ['print-mode'] },
  { text: 'prefers-reduced-motion', why: '含减动效分支', scripts: ['motion-audit'] },
  { text: 'forced-colors', why: '含高对比度分支', scripts: ['forced-colors'] },
  { text: 'serviceWorker', why: '涉及 SW 注册', scripts: ['offline-check'] },
  { text: 'transition: all', why: '含 transition: all（动效审计硬查项）', scripts: ['motion-audit'] },
]
export const probeable = (f) =>
  (/^(src|public)\//.test(f) && /\.(vue|css|ts|mts|html)$/.test(f)) || f === 'index.html'

/* ---------- 三、匹配：纯函数（不碰 git、不打印，可被测试直接调用） ---------- */
export function classify(changed, readFile = (f) => fs.readFileSync(f, 'utf8')) {
  const hits = []
  const extraCommands = new Set()
  const selfAuditFiles = []

  for (const file of changed) {
    const why = []
    const scripts = new Set()
    let isSelf = false

    for (const rule of SCRIPT_RULES) {
      if (!rule.re.test(file)) continue
      if (rule.selfAudit) {
        isSelf = true
        continue
      }
      why.push(rule.why)
      for (const s of rule.scripts ?? []) scripts.add(s)
      for (const c of rule.commands ?? []) extraCommands.add(c)
    }

    // 内容探针：只在 UI 类文件上生效，且只看实际存在的文件
    if (probeable(file) && fs.existsSync(file)) {
      const src = readFile(file)
      for (const probe of PROBES) {
        if (!src.includes(probe.text)) continue
        why.push(probe.why)
        for (const s of probe.scripts) scripts.add(s)
      }
    }

    if (isSelf) selfAuditFiles.push(file)
    if (why.length || scripts.size) hits.push({ file, why: [...new Set(why)], scripts })
  }

  const selfAuditScripts = selfAuditFiles
    .filter((f) => f.startsWith(`${AUDIT_DIR}/`) && f.endsWith('.js'))
    .map((f) => f.split('/').pop())
  const matchedScripts = new Set()
  for (const h of hits) for (const s of h.scripts) matchedScripts.add(s)

  return { hits, extraCommands, selfAuditFiles, selfAuditScripts, matchedScripts }
}

/* ---------- 四、取改动清单（唯一读 git 的地方） ---------- */
function collect(argv) {
  const argVal = (name) => {
    const i = argv.indexOf(name)
    return i === -1 ? null : argv[i + 1]
  }
  const filesArg = []
  const fi = argv.indexOf('--files')
  if (fi !== -1) {
    for (let i = fi + 1; i < argv.length; i++) {
      if (argv[i].startsWith('--')) break
      filesArg.push(...argv[i].split(','))
    }
  }
  if (filesArg.length) return { base: '(来自 --files)', changed: [...new Set(filesArg.map(norm).filter(Boolean))] }

  let base = argVal('--base') ?? (git('status', '--porcelain') !== '' ? 'HEAD' : 'HEAD~1')
  const readDiff = (ref) => git('diff', '--name-only', ref).split('\n').map(norm).filter(Boolean)
  let tracked
  try {
    tracked = readDiff(base)
  } catch {
    base = 'HEAD' // HEAD~1 不存在（首个提交）等情况
    tracked = readDiff(base)
  }
  const untracked = git('ls-files', '--others', '--exclude-standard').split('\n').map(norm).filter(Boolean)
  return { base, changed: [...new Set([...tracked, ...untracked])] }
}

/* ---------- 五、输出 ---------- */
function render(base, changed) {
  const L = []
  L.push('')
  L.push(`== 最小验证集 ==  基准：${base} · 改动 ${changed.length} 个文件`)
  L.push('')

  if (changed.length === 0) {
    L.push('  无改动：不需要跑任何检查。')
    L.push('')
    return L.join('\n')
  }

  const { hits, extraCommands, selfAuditFiles, selfAuditScripts, matchedScripts } = classify(changed)

  L.push('改动文件：')
  for (const f of changed) L.push(`  ${f}`)
  L.push('')
  L.push('【每次改动都跑】')
  L.push('  npx vue-tsc -b         类型（build:ci 的第一段就是它）')
  L.push('  pnpm run test:changed  单测：按改动自动选相关用例（纯文档改动 0 个用例；工作区干净时也是 0 个）')
  L.push('                         已提交后再跑要给基准：npx vitest run --changed HEAD~1')
  L.push('                         改动含 package.json / vitest 配置时会退化为全量——安全的过选，不是异常')
  for (const c of extraCommands) L.push(`  ${c}`)
  L.push('')

  if (hits.length === 0 && selfAuditScripts.length === 0) {
    L.push('【触发式浏览器层】0 项——本次改动不涉及浏览器面：不要启动 preview，不要跑 audit:all。')
    if (selfAuditFiles.length) L.push(`  （改到的 ${selfAuditFiles.join('、')} 不属浏览器脚本）`)
  } else {
    L.push(`【触发式浏览器层】命中 ${hits.length} 个文件`)
    for (const h of hits) {
      L.push(`  · ${h.file}`)
      if (h.why.length) L.push(`      ${h.why.join(' / ')}`)
      if (h.scripts.size) L.push(`      → ${[...h.scripts].sort().join('  ')}`)
    }
    if (selfAuditScripts.length) {
      L.push(`  · 改动落在审计脚本上：${selfAuditScripts.join('  ')}`)
      L.push('      → 只复跑这几项，不要顺带跑全箱')
    }
    L.push('')
    L.push('  前置：dist 必须是当前源码构建的产物（改了 src 就先 pnpm run build，再 pnpm run preview）')
    L.push(
      `  跑单项：npx playwright-cli open http://localhost:4175; npx playwright-cli run-code --filename=${AUDIT_DIR}/<脚本>`
    )
  }
  L.push('')
  const untouched = Math.max(0, AUDIT_SCRIPTS.length - matchedScripts.size - selfAuditScripts.length)
  L.push(
    `【本次不跑】其余 ${untouched} / ${AUDIT_SCRIPTS.length} 个浏览器脚本（与改动面无交集）；发版前用 pnpm run audit:all 全箱兜底。`
  )
  L.push('  这不是"图省事"：这些脚本的判据多数是"计数 === 0"型，空跑只会给出与本次改动无关的绿灯。')
  const touchesApp = changed.some((f) => /^(src|public)\//.test(f) || f === 'index.html')
  if (touchesApp) {
    L.push('')
    L.push('【合并/发版前 · L3 冒烟，约 5 分钟】——不是每次编辑都跑，是"改动确实进到页面"时的合入门槛：')
    L.push('  content-sweep  csp-check  transfer-profile  viewport-overflow  keyboard-journey')
  }
  L.push('')
  return L.join('\n')
}

/* ---------- 六、CLI（只打印建议，退出码恒为 0：它是建议，不是门禁） ---------- */
function main() {
  const { base, changed } = collect(process.argv.slice(2))
  process.stdout.write(render(base, changed))
}

// 被 import（测试）时不执行 CLI；直接运行时才跑
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
