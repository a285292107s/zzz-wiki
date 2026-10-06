// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetCompareBench, useCompareBench } from '@/composables/useCompareBench'

const KEY = 'zzz-wiki:compare'

/** 模拟「刷新页面」：重置模块实例，使模块级 load() 重新执行（读 localStorage） */
async function freshBench() {
  vi.resetModules()
  const mod = await import('@/composables/useCompareBench')
  return { b: mod.useCompareBench(), mod }
}

describe('对照台内容（useCompareBench）', () => {
  beforeEach(() => {
    localStorage.clear()
    __resetCompareBench()
  })

  it('加入同类目条目：追加且去重', () => {
    const b = useCompareBench()
    expect(b.add('/agents', 1011)).toBe('added')
    expect(b.add('/agents', 1021)).toBe('added')
    expect(b.add('/agents', 1011)).toBe('exists') // 重复加入不占位
    expect(b.ids.value).toEqual([1011, 1021])
    expect(b.count.value).toBe(2)
  })

  it('上限 3：第 4 条被拒（返回 full，不改内容）', () => {
    const b = useCompareBench()
    b.add('/agents', 1011)
    b.add('/agents', 1021)
    b.add('/agents', 1031)
    expect(b.isFull.value).toBe(true)
    expect(b.add('/agents', 1041)).toBe('full')
    expect(b.ids.value).toEqual([1011, 1021, 1031])
  })

  it('跨类目加入 → 清空并重开一桌（而不是拒绝，拒绝会让用户困惑）', () => {
    const b = useCompareBench()
    b.add('/agents', 1011)
    b.add('/agents', 1021)
    expect(b.add('/w-engines', 14162)).toBe('replaced')
    expect(b.catPath.value).toBe('/w-engines')
    expect(b.ids.value).toEqual([14162])
  })

  it('移除：移除到空则整桌清掉（不留空壳）', () => {
    const b = useCompareBench()
    b.add('/agents', 1011)
    b.add('/agents', 1021)
    b.remove(1011)
    expect(b.ids.value).toEqual([1021])
    b.remove(1021)
    expect(b.isEmpty.value).toBe(true)
    expect(b.catPath.value).toBeNull()
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('清空：一次清掉并删存档', () => {
    const b = useCompareBench()
    b.add('/agents', 1011)
    b.clear()
    expect(b.isEmpty.value).toBe(true)
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('持久化：刷新后读回同一桌', async () => {
    useCompareBench().add('/agents', 1011)
    useCompareBench().add('/agents', 1021)
    const { b } = await freshBench()
    expect(b.ids.value).toEqual([1011, 1021])
    expect(b.catPath.value).toBe('/agents')
  })

  it('损坏存档一律丢弃（不因坏数据让站点崩）', async () => {
    for (const bad of ['{', 'null', '[]', '{"catPath":1,"ids":"x"}', '{"catPath":"/agents","ids":["a"]}']) {
      localStorage.setItem(KEY, bad)
      const { b } = await freshBench()
      expect(b.isEmpty.value).toBe(true)
    }
  })

  it('存档超过上限时截断为 3 条', async () => {
    localStorage.setItem(KEY, JSON.stringify({ catPath: '/agents', ids: [1, 2, 3, 4, 5] }))
    const { b } = await freshBench()
    expect(b.ids.value).toEqual([1, 2, 3])
  })

  it('写入失败（隐私模式）不影响内存态', async () => {
    const { b } = await freshBench()
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => b.add('/agents', 1011)).not.toThrow()
    expect(b.ids.value).toEqual([1011])
    spy.mockRestore()
  })
})
