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
 * 触发映射以 docs/audit/2026-10-e2e-first-principles.md §4 P4 为主干，并补上 P4 没写、但确实有守护对象的
 * 改动面（页面文件、字体样式表、首页 hero 的几何/形态模块）——P4 是当时的快照，**本文件才是随改动维护的活表**。
 * 新增审计脚本的准入判据见 scripts/audits/README.md。
 *
 * 两层分界（2026-10，个人项目/UI 快速迭代）：**页面与 .vue 样式改动走 dev 快检
 * `pnpm run verify:ui`（约 30 秒、无需构建）；重型审计（axe 28 组合、全站走查、冷缓存预算）
 * 只在发版前 audit:all**。把发版级范围压到每次迭代，成本会先吃掉迭代速度。
 * 快检没有入口时（组件/全局 CSS/数据）仍按下面的脚本表走。
 *
 * 三条铁律（改规则前先读）：
 *   1. 宁可少报也不漏报是错的——漏报（该跑没让跑）比多报危险，方向不对等。但多报同样有害：
 *      工具一旦"狼来了"就会被无视，所以精度靠下面的行级判断，不靠"凡是 .vue 就全跑"。
 *   2. 路径规则写"文件族前缀"（如 `src/data/hero`）而不是逐个文件名，新增同族文件自动跟上；
 *      规则引用的脚本名必须真实存在（有测试守着，改名会失败而不是静默少跑）。
 *   3. 文档（.md/.txt）不触发任何浏览器层——`src` 下的 README 里写到 `@media print` 不是风险面。
 *
 * 结构：classify() 是纯函数（喂它文件清单 + 读文件/读 diff 行号的回调，不碰 git、不打印），
 * 由 tests/check-diff.test.ts 守着；collect() 是唯一读 git 的地方；改动规则表时请同步改测试。
 * ============================================================ */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

export const AUDIT_DIR = 'scripts/audits'
export const AUDIT_SCRIPTS = fs
  .readdirSync(AUDIT_DIR)
  .filter((f) => f.endsWith('.js'))
  .sort()

/* 常用脚本组：多组共用同一批脚本时从这里取，避免同一份清单写好几次后各自漂移 */
const FONT_SCRIPTS = ['font-weight-calibration', 'typography-audit', 'color-audit']
const LAYOUT_SCRIPTS = ['viewport-overflow', 'reflow-spacing', 'touch-targets', 'composition-audit']
const KEYBOARD_SCRIPTS = ['keyboard-journey', 'focus-visible', 'axe-states']

/** 文档不触发浏览器层（见文件头铁律 3） */
export const DOC_RE = /\.(md|txt)$/

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
const norm = (p) => p.replace(/\\/g, '/').trim()

/* ---------- 一、路径规则：改到这个路径，就该跑这些脚本 ---------- */
export const SCRIPT_RULES = [
  {
    why: '首页 hero：共享元素飞行 / 视图过渡 / 卡片取景与形态',
    // 写"族前缀"而非逐个文件名：首页 hero 的几何与内容模块分布在 utils/composables/data 三处，
    // 逐个列举会随着新增文件静默失效（deckFraming 就是这样漏掉的）。
    re: /^(?:src\/views\/HomeView\.vue$|src\/components\/home\/|src\/utils\/viewTransition\/|src\/utils\/deck|src\/composables\/use(?:HeroForm|FeaturedAgents)\.ts$|src\/data\/hero)/,
    scripts: ['hero-flight'],
  },
  {
    why: '设计令牌 / 字体资源',
    // 字体样式表在 public/fonts（CJK 分片 @font-face），不是 src 下的设计令牌，但归同一批脚本。
    re: /^(?:src\/styles\/(?:tokens|base)\.css|public\/fonts\/)|\.(?:woff2?|ttf|otf)$/,
    scripts: FONT_SCRIPTS,
  },
  {
    why: '离线兜底与响应头',
    re: /^(?:public\/sw\.js|public\/offline\.html|vercel\.json)$/,
    scripts: ['offline-check', 'csp-check'],
  },
  {
    why: '路由表 / 页面集合变了',
    re: /^src\/router\//,
    scripts: ['content-sweep', 'axe-a11y', 'landmarks'],
  },
  {
    why: '页面被改：本地先跑快检（渲染锚点/横向溢出/landmark/axe），发版前再跑全套',
    // 重型审计（axe-a11y 28 组合、landmarks 9 路由）留给发版前 audit:all：
    // 每次改一屏就跑全站 28 组合属于"发版级买迭代级"，2026-10 起改走 dev 快检。
    re: /^src\/views\//,
    commands: ['pnpm run verify:ui'],
  },
  {
    why: '共享组件（影响面跨页面）：快检至少覆盖受影响页面，发版前再跑全套',
    re: /^src\/components\//,
    commands: ['pnpm run verify:ui'],
  },
  {
    why: '样式表（几何、间距、命中区都可能变）',
    re: /^src\/.*\.css$/,
    scripts: LAYOUT_SCRIPTS,
  },
  {
    why: '滑条键盘操作',
    re: /Slider[A-Za-z]*\.vue$/,
    scripts: ['slider-keyboard', ...KEYBOARD_SCRIPTS],
  },
  {
    why: '搜索框 / 快速搜索面板',
    re: /(?:QuickSearch|Search)[A-Za-z]*\.vue$|^src\/composables\/useQuickSearch/,
    scripts: ['quick-search', ...KEYBOARD_SCRIPTS],
  },
  {
    why: '交互控件 / 键盘链路',
    // token 出现在文件名中即命中（不是紧贴 `.vue`）：NavScrollButton、FilterDropdown 这类
    // 「token + 限定词」命名才是本仓库常态，只认精确后缀会静默漏掉它们。
    // composables 只列真正管交互的那几个——useDetailPrefetch（悬停预热）不是键盘风险面。
    re: /(?:Nav|Menu|Dropdown|Pager|BackToTop)[A-Za-z]*\.vue$|^src\/composables\/use(?:NavScrollable|DetailNavigation|DetailPager|DetailSections)/,
    scripts: KEYBOARD_SCRIPTS,
  },
  {
    why: '图片元素 / 图标资产（可访问名）',
    re: /^src\/components\/HollowImage\.vue$|^src\/domain\/filterIcons\.ts$/,
    scripts: ['ax-tree', 'axe-a11y'],
  },
  {
    why: '数据真值（JSON/清单：页面内容与同源校验）',
    re: /^public\/data\/(?!img\/)/,
    scripts: ['content-sweep'],
    commands: ['pnpm run verify:data'],
  },
  {
    why: '图片资产（只影响资产存在性，不改变页面内容）',
    re: /^public\/data\/img\//,
    commands: ['pnpm run verify:icons -- --local'],
  },
  { why: '审计脚本自身被改（只复跑被改的那几项）', re: /^scripts\/audit/, selfAudit: true },
]

/* ---------- 二、行级规则：同一个文件里改模板还是改样式，风险面完全不同 ----------
 * 55 个 .vue 里 30 个含 `@media`。若按"文件含 <style> 就触发几何审计"来判，
 * 改一个字的说文案也会打出 4 项浏览器检查——这正是"狼来了"。
 * 所以这里看 diff 的新增/删除行号落在哪：只有改动行真的落在 `<style>` 块内才算布局改动。
 * 拿不到 diff 行号时（--files 干跑模式）退回整文件判断，并在输出里标注"按整文件判断"。 */
export const HUNK_RULES = [
  {
    why: '<style> 块被改（几何、间距、命中区、断点）：本地先跑快检，发版前再跑全套',
    test: (ctx) => ctx.inStyle && /\.(?:vue|html)$/.test(ctx.file),
    commands: ['pnpm run verify:ui'],
  },
]

/* ---------- 三、内容探针：路径看不出、但读一眼就知道要跑什么 ----------
 * 只放「特殊模式」这类高精度信号：声明了就说明这文件真的管这条轴。
 * 不加 `font-weight`、`<img` 这种常见声明——它们会让每次组件改动都打出一串浏览器检查。
 * 探针只在 UI 类文件上生效：文档（.md）与脚本里提到 `@media print` 不是改动的风险面。 */
export const PROBES = [
  { text: '@media print', why: '含打印样式', scripts: ['print-mode'] },
  { text: 'prefers-reduced-motion', why: '含减动效分支', scripts: ['motion-audit'] },
  { text: 'forced-colors', why: '含高对比度分支', scripts: ['forced-colors'] },
  { text: 'serviceWorker', why: '涉及 SW 注册', scripts: ['offline-check'] },
  { text: 'transition: all', why: '含 transition: all（动效审计硬查项）', scripts: ['motion-audit'] },
  { text: 'woff2', why: '涉及字体预加载', scripts: FONT_SCRIPTS },
]
export const probeable = (f) =>
  (/^(src|public)\//.test(f) && /\.(vue|css|ts|mts|html)$/.test(f)) || f === 'index.html'

/* ---------- 四、diff 行号 → 「改动行是否落在 <style> 块内」 ---------- */

/** 从 `git diff -U0` 文本里取出每个文件的新侧改动行号区间；纯删除取锚点行 */
export function parseHunks(diffText) {  const out = new Map()
  let cur = null
  for (const line of diffText.split('\n')) {
    if (line.startsWith('+++ ')) {
      const p = line.slice(4).trim()
      cur = p === '/dev/null' ? null : norm(p.replace(/^b\//, ''))
      if (cur && !out.has(cur)) out.set(cur, [])
      continue
    }
    const m = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line)
    if (!m || !cur) continue
    const start = Number(m[1])
    const len = m[2] === undefined ? 1 : Number(m[2])
    out.get(cur).push(len === 0 ? [start, start] : [start, start + len - 1])
  }
  return out
}

/** 从 `git diff -U0` 文本里取出每个文件的改动行内容（增删两侧都要：删掉分支同样是风险面） */
export function parseChangedLines(diffText) {
  const out = new Map()
  let cur = null
  for (const line of diffText.split('\n')) {
    if (line.startsWith('+++ ')) {
      const p = line.slice(4).trim()
      cur = p === '/dev/null' ? null : norm(p.replace(/^b\//, ''))
      if (cur && !out.has(cur)) out.set(cur, [])
      continue
    }
    if (!cur) continue
    if (line.startsWith('---') || line.startsWith('@@')) continue
    if (line.startsWith('+') || line.startsWith('-')) out.get(cur).push(line.slice(1))
  }
  return out
}

/** 文件里 `<style>` … `</style>` 的行号区间（1 基，闭区间） */
export function styleRanges(text) {
  const lines = text.split('\n')
  const out = []
  let start = -1
  for (let i = 0; i < lines.length; i++) {
    if (start === -1 && /<style[\s>]/.test(lines[i])) start = i + 1
    else if (start !== -1 && /<\/style>/.test(lines[i])) {
      out.push([start, i + 1])
      start = -1
    }
  }
  if (start !== -1) out.push([start, lines.length])
  return out
}

/** ranges 为 null（拿不到 diff）→ 整文件粗判；否则必须与某个 <style> 区间相交 */
export function touchesStyle(file, ranges, readFile) {
  const regs = styleRanges(readFile(file))
  if (regs.length === 0) return false
  if (ranges === null) return true
  return ranges.some(([a, b]) => regs.some(([c, d]) => a <= d && c <= b))
}

/** ---------- 五、匹配：纯函数（不碰 git、不打印，可被测试直接调用） ----------
 *
 * @param {string[]} changed 改动文件（仓库相对路径，正斜杠）
 * @param {(f: string) => string} [readFile] 读文件内容（测试可注入）
 * @param {(f: string) => [number, number][] | null} [hunks] 取该文件的新侧改动行号区间；
 *   null 表示拿不到 diff（--files 干跑 / 未跟踪文件），行级规则退回整文件判断
 * @param {(f: string) => string[] | null} [changedLines] 取该文件的改动行内容（增删两侧）；
 *   null 同样表示拿不到 diff，内容探针退回整文件判断
 */
export function classify(
  changed,
  readFile = (f) => fs.readFileSync(f, 'utf8'),
  hunks = () => null,
  changedLines = () => null,
) {
  const hits = []
  const extraCommands = new Set()
  const selfAuditFiles = []
  const judgeFiles = []
  const coarseFiles = []

  for (const file of changed) {
    const why = []
    const scripts = new Set()
    // 独立于文档守卫：scripts/audits/README.md 是判据文档本身，改它同样要提示人工自检
    const isSelf = /^scripts\/audit/.test(file)

    if (!DOC_RE.test(file)) {
      for (const rule of SCRIPT_RULES) {
        if (!rule.re.test(file)) continue
        if (rule.selfAudit) continue // isSelf 已在上方判定（且不挡 .md）
        why.push(rule.why)
        for (const s of rule.scripts ?? []) scripts.add(s)
        for (const c of rule.commands ?? []) extraCommands.add(c)
      }

      const exists = fs.existsSync(file)
      if (exists && /\.(?:vue|html)$/.test(file)) {
        const ranges = hunks(file)
        if (touchesStyle(file, ranges, readFile)) {
          if (ranges === null) coarseFiles.push(file)
          for (const rule of HUNK_RULES) {
            if (!rule.test({ file, inStyle: true, coarse: ranges === null })) continue
            why.push(rule.why)
            for (const s of rule.scripts ?? []) scripts.add(s)
            for (const c of rule.commands ?? []) extraCommands.add(c)
          }
        }
      }

      // 内容探针：只在 UI 类文件上生效，且只看实际存在的文件；有 diff 时只看改动行——
      // 同一文件里未被改动的 prefers-reduced-motion 分支不该把 motion-audit 拖回每次迭代。
      if (probeable(file) && exists) {
        const diffText = changedLines(file)
        const src = diffText === null ? readFile(file) : diffText.join('\n')
        for (const probe of PROBES) {
          if (!src.includes(probe.text)) continue
          why.push(probe.why)
          for (const s of probe.scripts) scripts.add(s)
        }
      }
    }

    if (isSelf) {
      selfAuditFiles.push(file)
      // 单项脚本被改 → 复跑它即可；判据表（audit-all.mjs / audit-runner.mjs）被改则是另一回事：
      // 判据本身变了，复跑单项证明不了判据仍成立，必须人工按 README 逐项自检。
      const isSingleAudit = file.startsWith(`${AUDIT_DIR}/`) && file.endsWith('.js')
      if (!isSingleAudit) judgeFiles.push(file)
    }
    if (why.length || scripts.size) hits.push({ file, why: [...new Set(why)], scripts })
  }

  const selfAuditScripts = selfAuditFiles
    .filter((f) => f.startsWith(`${AUDIT_DIR}/`) && f.endsWith('.js'))
    .map((f) => f.split('/').pop())
  const matchedScripts = new Set()
  for (const h of hits) for (const s of h.scripts) matchedScripts.add(s)

  return { hits, extraCommands, selfAuditFiles, selfAuditScripts, judgeFiles, coarseFiles, matchedScripts }
}

/* ---------- 六、取改动清单（唯一读 git 的地方） ---------- */
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
  // --files 模式没有 diff 行号：hunks 返回 null，让行级规则退回整文件判断
  if (filesArg.length)
    return {
      base: '(来自 --files)',
      changed: [...new Set(filesArg.map(norm).filter(Boolean))],
      hunks: () => null,
      changedLines: () => null,
    }

  let base = argVal('--base') ?? (git('status', '--porcelain') !== '' ? 'HEAD' : 'HEAD~1')
  const readDiff = (ref) => git('diff', '--name-only', ref).split('\n').map(norm).filter(Boolean)
  let tracked
  let hunks
  let lines
  try {
    tracked = readDiff(base)
    const diffText = git('diff', '-U0', base)
    hunks = parseHunks(diffText)
    lines = parseChangedLines(diffText)
  } catch {
    base = 'HEAD' // HEAD~1 不存在（首个提交）等情况
    tracked = readDiff(base)
    const diffText = git('diff', '-U0', base)
    hunks = parseHunks(diffText)
    lines = parseChangedLines(diffText)
  }
  const untracked = git('ls-files', '--others', '--exclude-standard').split('\n').map(norm).filter(Boolean)
  // 未跟踪的新文件不在 diff 里 → hunks/lines.get 为 undefined → null → 整文件判断
  return {
    base,
    changed: [...new Set([...tracked, ...untracked])],
    hunks: (f) => hunks.get(f) ?? null,
    changedLines: (f) => lines.get(f) ?? null,
  }
}

/** ---------- 七、输出 ----------
 *
 * @param {string} base
 * @param {string[]} changed
 * @param {(f: string) => [number, number][] | null} [hunks]
 * @param {(f: string) => string[] | null} [changedLines]
 */
export function render(base, changed, hunks = () => null, changedLines = () => null) {
  const L = []
  L.push('')
  L.push(`== 最小验证集 ==  基准：${base} · 改动 ${changed.length} 个文件`)
  L.push('')

  if (changed.length === 0) {
    L.push('  无改动：不需要跑任何检查。')
    L.push('')
    return L.join('\n')
  }

  const { hits, extraCommands, selfAuditScripts, judgeFiles, coarseFiles, matchedScripts } = classify(
    changed,
    undefined,
    hunks,
    changedLines
  )
  const coarse = new Set(coarseFiles)

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

  if (hits.length === 0 && selfAuditScripts.length === 0 && judgeFiles.length === 0) {
    L.push('【触发式浏览器层】0 项——本次改动不涉及浏览器面：不要启动 preview，不要跑 audit:all。')
  } else {
    L.push(
      hits.length
        ? `【触发式浏览器层】命中 ${hits.length} 个文件`
        : '【触发式浏览器层】命中 0 个文件（存在需人工处置的改动，见下）'
    )
    for (const h of hits) {
      L.push(`  · ${h.file}`)
      if (h.why.length) L.push(`      ${h.why.join(' / ')}${coarse.has(h.file) ? '（未给 diff，按整文件判断）' : ''}`)
      if (h.scripts.size) L.push(`      → ${[...h.scripts].sort().join('  ')}`)
    }
    if (selfAuditScripts.length) {
      L.push(`  · 改动落在审计脚本上：${selfAuditScripts.join('  ')}`)
      L.push('      → 只复跑这几项，不要顺带跑全箱')
    }
    if (judgeFiles.length) {
      L.push(`  · 审计判据表被改：${judgeFiles.join('  ')}`)
      L.push('      → 判据本身变了：复跑单项证明不了判据仍成立，按 scripts/audits/README.md 逐项自检')
    }
    L.push('')
    if (matchedScripts.size || selfAuditScripts.length) {
      L.push('  前置（审计读的是构建产物）：dist 必须是当前源码构建的产物（改了 src 就先 pnpm run build，再 pnpm run preview）')
      L.push(
        `  跑单项：npx playwright-cli open http://localhost:4175; npx playwright-cli run-code --filename=${AUDIT_DIR}/<脚本>`
      )
    }
    if (extraCommands.has('pnpm run verify:ui')) {
      L.push('  快检（dev 服务，无需构建，约 15 秒）：pnpm run verify:ui')
      L.push('    · 路由缺省从改动文件推断（名录页）；详情页改动用 --route 指定一条实例，如 --route /w-engines/14164')
      L.push('    · 查：渲染锚点、图片 alt、横向溢出、控制台错误、axe violations；截图落 temp/verify-ui/')
    }
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

/* ---------- 八、CLI（只打印建议，退出码恒为 0：它是建议，不是门禁） ---------- */
function main() {
  const { base, changed, hunks, changedLines } = collect(process.argv.slice(2))
  process.stdout.write(render(base, changed, hunks, changedLines))
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
