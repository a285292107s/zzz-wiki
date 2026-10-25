import { describe, expect, it } from 'vitest'

import { DOC_RE, plan, render } from '../scripts/check-diff.mjs'

const cmds = (files: string[]): string[] => plan(files).steps.map(([, cmd]) => cmd)

describe('验证选步', () => {
  it('纯文档改动不跑任何检查', () => {
    expect(plan(['README.md', 'docs/decisions/0001.md']).steps).toHaveLength(0)
    expect(render('HEAD', ['AGENTS.md'])).toContain('只有文档改动')
  })

  it('非文档改动一律带类型、全量单测、CJK 字体覆盖', () => {
    const list = cmds(['src/domain/sections.ts'])
    expect(list).toContain('npx vue-tsc -b')
    expect(list).toContain('pnpm test')
    expect(list).toContain('node scripts/verify-cjk-fonts.mjs')
  })

  it('改视图或共享组件才触发页面快检', () => {
    expect(cmds(['src/views/AgentsView.vue'])).toContain('pnpm run verify:ui')
    expect(cmds(['src/components/detail/DetailHead.vue'])).toContain('pnpm run verify:ui')
    expect(cmds(['src/domain/sections.ts'])).not.toContain('pnpm run verify:ui')
  })

  it('改入口 index.html 也算页面面', () => {
    expect(cmds(['index.html'])).toContain('pnpm run verify:ui')
  })

  it('图片资产只查本地完整性，不查页面', () => {
    const list = cmds(['public/data/img/hero/1011.webp'])
    expect(list).toContain('node scripts/verify-icons.mjs --local')
    expect(list).not.toContain('pnpm run verify:ui')
  })

  it('数据真值与部署配置只给手动提示（要预览服务才能跑）', () => {
    expect(plan(['public/data/live/zh/character.json']).notes.join('\n')).toContain('verify:data')
    expect(plan(['vercel.json']).notes.join('\n')).toContain('verify-vercel')
  })

  it('构建/依赖面改动提示收工前跑整链路', () => {
    expect(plan(['package.json']).notes.join('\n')).toContain('build:ci')
  })

  it('文档后缀只认 md/txt', () => {
    expect(DOC_RE.test('QUALITY.md')).toBe(true)
    expect(DOC_RE.test('src/styles/base.css')).toBe(false)
    expect(DOC_RE.test('public/data/featured-pool.json')).toBe(false)
  })
})
