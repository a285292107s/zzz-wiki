import { describe, expect, it } from 'vitest'
import { resolveLiveTarget } from '../scripts/build/live-target'

describe('resolveLiveTarget · 合规版本选择', () => {
  it('live 在可用列表 → 返回正式服版本号', () => {
    expect(
      resolveLiveTarget({ latest: '3.2.4+18409985', live: '3.1', available: ['3.1', '3.2.0+17782873'] }),
    ).toBe('3.1')
  })

  it('live 缺失（源站 schema 变更）→ 抛错拒绝构建', () => {
    expect(() => resolveLiveTarget({ latest: '3.2.4+18409985', available: ['3.1'] })).toThrow(/缺 zzz\.live/)
  })

  it('available 缺失 → 抛错拒绝构建', () => {
    expect(() => resolveLiveTarget({ live: '3.1' })).toThrow(/缺 zzz\.available/)
  })

  it('合规红线：live 不在可用列表 → 抛错，绝不以 latest 降级', () => {
    expect(() =>
      resolveLiveTarget({ latest: '3.2.4+18409985', live: '3.1', available: ['3.2.4+18409985'] }),
    ).toThrow(/不在源站可用列表/)
  })

  it('live === latest 时仍视为合法（源站确认同版本即正式服）', () => {
    expect(resolveLiveTarget({ latest: '3.1', live: '3.1', available: ['3.1'] })).toBe('3.1')
  })
})