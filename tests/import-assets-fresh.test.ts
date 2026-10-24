import { describe, expect, it } from 'vitest'
import { isFresh } from '../scripts/build/import-assets.mjs'

const entry = { srcRel: 'ui/Sprite/A.png', srcSize: 100, sig: 'q88|e1600|t0' }

describe('import-assets 新鲜度判据', () => {
  it('无清单条目时视为待处理', () => {
    expect(isFresh(undefined, entry)).toBe(false)
    expect(isFresh(null, entry)).toBe(false)
  })

  it('源相对路径、字节数、转换签名三者一致才算已同步', () => {
    expect(isFresh({ src: 'ui/Sprite/A.png', bytes: 100, rule: 'q88|e1600|t0' }, entry)).toBe(true)
  })

  it('改转换参数必须重转（否则改 RULES 会被静默跳过）', () => {
    expect(isFresh({ src: 'ui/Sprite/A.png', bytes: 100, rule: 'q90|e1600|t0' }, entry)).toBe(false)
    expect(isFresh({ src: 'ui/Sprite/A.png', bytes: 100, rule: 'q88|e0|t0' }, entry)).toBe(false)
  })

  it('源换了或源大小变了必须重转', () => {
    expect(isFresh({ src: 'ui/Sprite/B.png', bytes: 100, rule: 'q88|e1600|t0' }, entry)).toBe(false)
    expect(isFresh({ src: 'ui/Sprite/A.png', bytes: 99, rule: 'q88|e1600|t0' }, entry)).toBe(false)
  })

  it('旧条目没有签名时按已同步放行（升级判据不重编码整仓）', () => {
    expect(isFresh({ src: 'ui/Sprite/A.png', bytes: 100 }, entry)).toBe(true)
  })

  it('清单里存绝对路径的旧写法不再被误判为新数据', () => {
    expect(isFresh({ src: 'C:/dump/ui/Sprite/A.png', bytes: 100, rule: 'q88|e1600|t0' }, entry)).toBe(false)
  })
})
