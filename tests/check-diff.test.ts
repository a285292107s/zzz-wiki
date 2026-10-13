import { describe, expect, it } from 'vitest'
import { AUDIT_SCRIPTS, PROBES, SCRIPT_RULES, classify } from '../scripts/check-diff.mjs'

/** 跑一遍 classify，把「本次会跑到的浏览器脚本」取出来（合并所有命中文件） */
function scriptsOf(files: string[], readFile?: (f: string) => string) {
  const { hits } = classify(files, readFile)
  const out = new Set<string>()
  for (const h of hits) for (const s of h.scripts) out.add(s)
  return out
}

describe('check-diff：改动 → 该跑什么', () => {
  it('样式表改动触发几何/间距/命中区一族，但不触发首页飞行', () => {
    const s = scriptsOf(['src/styles/base.css'])
    for (const name of ['viewport-overflow', 'reflow-spacing', 'touch-targets', 'composition-audit']) {
      expect(s.has(name), name).toBe(true)
    }
    expect(s.has('hero-flight')).toBe(false)
  })

  it('首页与视图过渡改动触发 hero-flight', () => {
    expect(scriptsOf(['src/views/HomeView.vue']).has('hero-flight')).toBe(true)
    expect(scriptsOf(['src/utils/viewTransition/index.ts']).has('hero-flight')).toBe(true)
  })

  it('路由表改动触发全站走查一族', () => {
    const s = scriptsOf(['src/router/index.ts'])
    expect(s.has('content-sweep')).toBe(true)
    expect(s.has('axe-a11y')).toBe(true)
  })

  it('离线与响应头改动触发离线/安全头两项', () => {
    const s = scriptsOf(['public/sw.js', 'vercel.json'])
    expect(s.has('offline-check')).toBe(true)
    expect(s.has('csp-check')).toBe(true)
  })

  it('交互组件改动触发键盘链路一族（含 token + 限定词的命名）', () => {
    for (const f of [
      'src/components/NavScrollButton.vue',
      'src/components/SearchField.vue',
      'src/components/QuickSearch.vue',
      'src/components/detail/DetailPager.vue',
    ]) {
      expect(scriptsOf([f]).has('keyboard-journey'), f).toBe(true)
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

  it('多文件命中取并集', () => {
    const s = scriptsOf(['src/router/index.ts', 'public/sw.js'])
    expect(s.has('content-sweep')).toBe(true)
    expect(s.has('csp-check')).toBe(true)
  })
})

describe('check-diff：内容探针的边界（守已修的「狼来了」假阳性）', () => {
  const allProbeText = '@media print prefers-reduced-motion forced-colors serviceWorker transition: all'

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

  it('不存在的 UI 文件不读盘、不触发探针', () => {
    const { hits } = classify(['src/components/NotYetCreated.vue'], () => {
      throw new Error('不应读盘')
    })
    expect(hits).toEqual([])
  })
})

describe('check-diff：规则表卫生', () => {
  it('规则与探针引用的每个脚本都真实存在（脚本改名会让这条失败，而不是静默少跑）', () => {
    const referenced = new Set<string>()
    for (const r of SCRIPT_RULES) for (const s of r.scripts ?? []) referenced.add(s)
    for (const p of PROBES) for (const s of p.scripts) referenced.add(s)
    expect([...referenced].filter((s) => !AUDIT_SCRIPTS.includes(`${s}.js`))).toEqual([])
  })

  it('审计脚本自身的改动只复跑被改的那几项', () => {
    const { hits, selfAuditScripts } = classify(['scripts/audits/hero-flight.js'])
    expect(selfAuditScripts).toEqual(['hero-flight.js'])
    expect(hits).toEqual([])
  })
})
