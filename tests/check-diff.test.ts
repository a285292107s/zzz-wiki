import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  AUDIT_SCRIPTS,
  HUNK_RULES,
  PROBES,
  SCRIPT_RULES,
  classify,
  parseChangedLines,
  parseHunks,
  render,
  styleRanges,
} from '../scripts/check-diff.mjs'

type Hunks = (f: string) => [number, number][] | null
const noHunks: Hunks = () => null

/** 跑一遍 classify，把「本次会跑到的浏览器脚本」取出来（合并所有命中文件） */
function scriptsOf(files: string[], readFile?: (f: string) => string, hunks: Hunks = noHunks) {
  const { hits } = classify(files, readFile, hunks)
  const out = new Set<string>()
  for (const h of hits) for (const s of h.scripts) out.add(s)
  return out
}

/** 构造「改动行固定落在某区间」的 hunks 回调 */
const at = (ranges: [number, number][]): Hunks => () => ranges

describe('check-diff：改动 → 该跑什么', () => {
  it('样式表改动触发几何/间距/命中区一族，但不触发首页飞行', () => {
    const s = scriptsOf(['src/styles/base.css'])
    for (const name of ['viewport-overflow', 'reflow-spacing', 'touch-targets', 'composition-audit']) {
      expect(s.has(name), name).toBe(true)
    }
    expect(s.has('hero-flight')).toBe(false)
  })

  it('页面与 .vue 样式改动走 dev 快检，不再日常跑全站 axe/landmarks', () => {
    const view = classify(['src/views/AboutView.vue'])
    expect([...view.extraCommands]).toContain('pnpm run verify:ui')
    expect(scriptsOf(['src/views/AboutView.vue']).has('axe-a11y')).toBe(false)
    expect(scriptsOf(['src/views/AboutView.vue']).has('landmarks')).toBe(false)

    const ag = 'src/views/AgentsView.vue'
    const regs = styleRanges(fs.readFileSync(ag, 'utf8'))
    const styleHit = classify([ag], undefined, at([[regs[0][0], regs[0][0]]]))
    expect([...styleHit.extraCommands]).toContain('pnpm run verify:ui')
    expect(scriptsOf([ag], undefined, at([[regs[0][0], regs[0][0]]])).has('viewport-overflow')).toBe(false)
  })

  it('首页与视图过渡改动触发 hero-flight', () => {
    expect(scriptsOf(['src/views/HomeView.vue']).has('hero-flight')).toBe(true)
    expect(scriptsOf(['src/utils/viewTransition/index.ts']).has('hero-flight')).toBe(true)
  })

  it('首页 hero 的几何/形态/取景模块按「族前缀」命中 hero-flight', () => {
    // 这几个文件是 hero-flight 第 6/11 项（起飞前取景变形）判据的真正被守护对象：
    // 只按 src/components/home/ 匹配时，改它们会得到「0 项」——漏跑比多跑危险。
    for (const f of [
      'src/utils/deckFraming.ts',
      'src/utils/deckGesture.ts',
      'src/composables/useHeroForm.ts',
      'src/composables/useFeaturedAgents.ts',
      'src/data/heroGenderVariants.ts',
      'src/data/heroImageSources.ts',
      'src/data/heroCalibration.ts',
    ]) {
      expect(scriptsOf([f]).has('hero-flight'), f).toBe(true)
    }
  })

  it('校准工具 cameraRect 不是首页 hero 的依赖，不误伤 hero-flight', () => {
    // 它只服务 CalibrateView（离线校准页），hero-flight 不测那个页面。
    expect(scriptsOf(['src/utils/cameraRect.ts']).has('hero-flight')).toBe(false)
  })

  it('路由表变更仍触发全站走查；单页改动改由 dev 快检接住', () => {
    const router = scriptsOf(['src/router/index.ts'], undefined, at([[1, 1]]))
    expect(router.has('axe-a11y')).toBe(true)
    expect(router.has('landmarks')).toBe(true)
    expect(router.has('content-sweep')).toBe(true)

    const { extraCommands } = classify(['src/views/AboutView.vue'], undefined, at([[1, 1]]))
    expect([...extraCommands]).toContain('pnpm run verify:ui')
    // 只改页面内容不必再跑一遍 sitemap 走查，也不必日常跑全站 28 组合 axe
    expect(scriptsOf(['src/views/AboutView.vue'], undefined, at([[1, 1]])).has('content-sweep')).toBe(false)
    expect(scriptsOf(['src/views/AboutView.vue'], undefined, at([[1, 1]])).has('axe-a11y')).toBe(false)
  })

  it('离线面含离线兜底页与响应头', () => {
    for (const f of ['public/sw.js', 'public/offline.html', 'vercel.json']) {
      const s = scriptsOf([f])
      expect(s.has('offline-check'), f).toBe(true)
      expect(s.has('csp-check'), f).toBe(true)
    }
  })

  it('字体样式表与字体文件归字体一族，且不再顺带触发版面几何四项', () => {
    const s = scriptsOf(['public/fonts/noto-serif-sc.css'])
    for (const name of ['font-weight-calibration', 'typography-audit', 'color-audit']) {
      expect(s.has(name), name).toBe(true)
    }
    expect(s.has('viewport-overflow')).toBe(false)
    expect(scriptsOf(['public/fonts/PublicSans-400.woff2']).has('typography-audit')).toBe(true)
  })

  it('入口 HTML 里的字体预加载触发字体一族', () => {
    expect(scriptsOf(['index.html']).has('font-weight-calibration')).toBe(true)
  })

  it('交互组件按控件类型分别映射（不把滑条/搜索的检查互相泼过去）', () => {
    const slider = scriptsOf(['src/components/detail/LevelSlider.vue'])
    expect(slider.has('slider-keyboard')).toBe(true)
    expect(slider.has('quick-search')).toBe(false)

    for (const f of ['src/components/list/SearchField.vue', 'src/components/QuickSearch.vue']) {
      const s = scriptsOf([f])
      expect(s.has('quick-search'), f).toBe(true)
      expect(s.has('slider-keyboard'), f).toBe(false)
    }

    for (const f of [
      'src/components/NavScrollButton.vue',
      'src/components/BackToTop.vue',
      'src/components/detail/DetailPager.vue',
      'src/components/list/FilterDropdown.vue',
    ]) {
      const s = scriptsOf([f])
      expect(s.has('keyboard-journey'), f).toBe(true)
      expect(s.has('slider-keyboard'), f).toBe(false)
      expect(s.has('quick-search'), f).toBe(false)
    }
  })

  it('交互 composable 命中的是真正管交互的那几个', () => {
    for (const f of ['src/composables/useNavScrollable.ts', 'src/composables/useDetailPager.ts']) {
      expect(scriptsOf([f]).has('keyboard-journey'), f).toBe(true)
    }
    // 悬停预热与列表排序不是键盘风险面，别被 useDetail 前缀泼到
    for (const f of ['src/composables/useDetailPrefetch.ts', 'src/composables/useCatalogSort.ts']) {
      expect(scriptsOf([f]).has('quick-search'), f).toBe(false)
      expect(scriptsOf([f]).has('slider-keyboard'), f).toBe(false)
    }
  })

  it('非交互组件不被键盘规则误伤', () => {
    const s = scriptsOf(['src/components/HollowImage.vue'])
    expect(s.has('keyboard-journey')).toBe(false)
  })

  it('数据真值改动额外要求 verify:data', () => {
    const { extraCommands } = classify(['public/data/live/noun.json'])
    expect([...extraCommands]).toContain('pnpm run verify:data')
  })

  it('图片资产不再触发 243 页 content-sweep，只查本地图标清单', () => {
    const { hits, extraCommands } = classify([
      'public/data/img/weapon-art/card/Weapon_S_1641_GachaEF.webp',
    ])
    expect([...extraCommands]).toContain('pnpm run verify:icons -- --local')
    expect(hits.flatMap((h) => [...h.scripts])).not.toContain('content-sweep')
  })

  it('共享组件改动要求快检（影响面跨页面）', () => {
    const { extraCommands } = classify(['src/components/state/AsyncState.vue'])
    expect([...extraCommands]).toContain('pnpm run verify:ui')
  })

  it('多文件命中取并集', () => {
    const s = scriptsOf(['src/router/index.ts', 'public/sw.js'])
    expect(s.has('content-sweep')).toBe(true)
    expect(s.has('csp-check')).toBe(true)
  })
})

describe('check-diff：布局轴看 diff 行号，不看文件里有没有 <style>', () => {
  const page = 'src/views/AgentsView.vue'
  const regs = styleRanges(fs.readFileSync(page, 'utf8'))

  it('真实文件里确实有 <style> 块（下面的用例才有意义）', () => {
    expect(regs.length).toBeGreaterThan(0)
  })

  it('改动行落在 <style> 块内 → 走 dev 快检（不再日常跑 4 项重型版面审计）', () => {
    const ranges = at([[regs[0][0], regs[0][0]]])
    expect([...classify([page], undefined, ranges).extraCommands]).toContain('pnpm run verify:ui')
    expect(scriptsOf([page], undefined, ranges).has('viewport-overflow')).toBe(false)
    expect(scriptsOf([page], undefined, ranges).has('reflow-spacing')).toBe(false)
  })

  it('只改模板/文案（改动行不在 <style> 内）→ 不触发版面几何四项，但仍走快检', () => {
    // 全仓 55 个 .vue 有 30 个含 @media；按文件判断会让改一个字的文案也跑 4 项浏览器审计，
    // 这正是「狼来了」。行级判断是为了既不漏跑、也不多跑。
    const s = scriptsOf([page], undefined, at([[1, 1]]))
    expect(s.has('viewport-overflow')).toBe(false)
    expect(s.has('composition-audit')).toBe(false)
    // 页面本身仍要过渲染锚点 / 可访问性：由 verify:ui 在 dev 上覆盖
    expect([...classify([page], undefined, at([[1, 1]])).extraCommands]).toContain('pnpm run verify:ui')
  })

  it('拿不到 diff 行号时（--files 干跑）退回整文件判断，并标注出来', () => {
    expect([...classify([page], undefined, noHunks).extraCommands]).toContain('pnpm run verify:ui')
    const { coarseFiles } = classify([page], undefined, noHunks)
    expect(coarseFiles).toContain(page)
    expect(render('(来自 --files)', [page], noHunks)).toContain('按整文件判断')
  })

  it('parseHunks 只认新侧行号，纯删除取锚点行，/dev/null 段被忽略', () => {
    const map = parseHunks(
      [
        'diff --git a/x.vue b/x.vue',
        '--- a/x.vue',
        '+++ b/x.vue',
        '@@ -1,0 +10,3 @@',
        '@@ -50 +53,0 @@',
        'diff --git a/y.vue b/y.vue',
        '--- a/y.vue',
        '+++ /dev/null',
        '@@ -1 +0,0 @@',
      ].join('\n')
    )
    expect(map.get('x.vue')).toEqual([
      [10, 12],
      [53, 53],
    ])
    expect(map.has('y.vue')).toBe(false)
  })
})

describe('check-diff：内容探针的边界（守已修的「狼来了」假阳性）', () => {
  const allProbeText =
    '@media print prefers-reduced-motion forced-colors serviceWorker transition: all woff2'

  it('UI 文件里的声明会真正命中（探针没被范围限制误杀）', () => {
    const s = scriptsOf(['src/styles/base.css'], () => '@media print {} @media (prefers-reduced-motion: reduce) {}')
    expect(s.has('print-mode')).toBe(true)
    expect(s.has('motion-audit')).toBe(true)
  })

  it('文档与脚本里的同样字面量不触发浏览器检查', () => {
    for (const f of ['docs/audit/2026-10-e2e-first-principles.md', 'scripts/check-diff.mjs']) {
      const { hits } = classify([f], () => allProbeText)
      expect(hits, f).toEqual([])
    }
  })

  it('审计脚本目录内的文档（如 README）不触发 hero-flight', () => {
    const { hits, judgeFiles } = classify(['src/utils/viewTransition/README.md'], () => '取景变形 zoom')
    expect(hits).toEqual([])
    expect(judgeFiles).toEqual([])
  })

  it('但审计判据文档本身被改要提示人工自检（不被文档守卫静默挡掉）', () => {
    const { hits, judgeFiles } = classify(['scripts/audits/README.md'])
    expect(hits).toEqual([])
    expect(judgeFiles).toEqual(['scripts/audits/README.md'])
    expect(render('HEAD', ['scripts/audits/README.md'])).toContain('审计判据表被改')
  })

  it('不存在的 UI 文件不读盘、不触发探针', () => {
    const { hits } = classify(['src/utils/NotYetCreated.vue'], () => {
      throw new Error('不应读盘')
    })
    expect(hits).toEqual([])
  })

  it('探针只看改动行：同一文件里未被改的 prefers-reduced-motion 不拖回 motion-audit', () => {
    const file = 'src/components/list/CardGrid.vue'
    const read = () => fs.readFileSync(file, 'utf8')
    const untouched = classify([file], read, noHunks, () => ['<slot name="skeleton" />'])
    expect(untouched.hits.flatMap((h) => [...h.scripts])).toEqual([])
    expect(untouched.hits.flatMap((h) => h.why).join('/')).not.toContain('减动效')
    const touched = classify([file], read, noHunks, () => ['@media (prefers-reduced-motion: reduce) {}'])
    expect(touched.hits.flatMap((h) => [...h.scripts])).toContain('motion-audit')
  })

  it('parseChangedLines 收增删两侧内容、忽略文件头', () => {
    const map = parseChangedLines(
      [
        'diff --git a/x.vue b/x.vue',
        '--- a/x.vue',
        '+++ b/x.vue',
        '@@ -1,2 +1,2 @@',
        '-old line',
        '+new line',
        'diff --git a/y.vue b/y.vue',
        '--- a/y.vue',
        '+++ /dev/null',
        '@@ -1 +0,0 @@',
        '-gone',
      ].join('\n'),
    )
    expect(map.get('x.vue')).toEqual(['old line', 'new line'])
    expect(map.has('y.vue')).toBe(false)
  })
})

describe('check-diff：输出文案不能骗人', () => {
  it('无命中时明确说 0 项，不写成「这些文件不属浏览器脚本」', () => {
    const out = render('HEAD', ['docs/README.md'])
    expect(out).toContain('0 项')
    expect(out).not.toContain('不属浏览器脚本')
  })

  it('审计判据表被改时要求人工自检，而不是静默 0 项', () => {
    const out = render('HEAD', ['scripts/audit-all.mjs'])
    expect(out).toContain('审计判据表被改')
    expect(out).toContain('scripts/audit-all.mjs')
    expect(out).not.toContain('0 项——本次改动不涉及浏览器面')
  })

  it('单个审计脚本被改时只复跑它自己', () => {
    const out = render('HEAD', ['scripts/audits/hero-flight.js'])
    expect(out).toContain('hero-flight.js')
    expect(out).toContain('只复跑这几项')
    expect(out).not.toContain('审计判据表被改')
  })

  it('无改动时直接说不用跑', () => {
    expect(render('HEAD', [])).toContain('无改动')
  })

  it('单页改动打印 dev 快检命令，且不再要求先构建产物', () => {
    const out = render('HEAD', ['src/views/AboutView.vue'])
    expect(out).toContain('pnpm run verify:ui')
    expect(out).toContain('快检（dev 服务，无需构建')
    expect(out).not.toContain('前置（审计读的是构建产物）')
  })
})

describe('check-diff：规则表卫生', () => {
  it('规则、行级规则与探针引用的每个脚本都真实存在（脚本改名会让这条失败，而不是静默少跑）', () => {
    const referenced = new Set<string>()
    for (const r of SCRIPT_RULES) for (const s of r.scripts ?? []) referenced.add(s)
    for (const r of HUNK_RULES as { scripts?: string[] }[]) for (const s of r.scripts ?? []) referenced.add(s)
    for (const p of PROBES) for (const s of p.scripts) referenced.add(s)
    expect([...referenced].filter((s) => !AUDIT_SCRIPTS.includes(`${s}.js`))).toEqual([])
  })

  it('每条路径规则都给了 why + 处置（审计脚本、命令或显式 selfAudit）', () => {
    for (const r of SCRIPT_RULES) {
      expect(r.why, String(r.re)).toBeTruthy()
      const hasDisposal =
        (r.scripts?.length ?? 0) > 0 || (r.commands?.length ?? 0) > 0 || r.selfAudit === true
      expect(hasDisposal, String(r.re)).toBe(true)
    }
  })

  it('行级规则也只给命令（不把重型审计拖回每次迭代）', () => {
    for (const r of HUNK_RULES as { scripts?: string[]; commands?: string[] }[]) {
      expect((r.scripts?.length ?? 0) > 0 || (r.commands?.length ?? 0) > 0).toBe(true)
    }
  })

  it('审计脚本自身的改动只复跑被改的那几项', () => {
    const { hits, selfAuditScripts, judgeFiles } = classify(['scripts/audits/hero-flight.js'])
    expect(selfAuditScripts).toEqual(['hero-flight.js'])
    expect(judgeFiles).toEqual([])
    expect(hits).toEqual([])
  })
})
