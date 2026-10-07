import { describe, expect, it } from 'vitest'
import { injectWEngineCardDisplay } from '../scripts/build/domains'

/** 详情侧最小样本：只保留名录注入会读到的字段 */
function detail(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    base_property: { name: '基础攻击力', name2: '基础攻击力', format: '{0:0.#}', value: 46 },
    rand_property: { name: '攻击力', name2: '攻击力百分比', format: '{0:0.#%}', value: 1200 },
    talents: {
      1: { name: '炽烈吐息', desc: '装备者的攻击力提升3.5%…' },
      2: { name: '炽烈吐息', desc: '装备者的攻击力提升4.4%…' },
    },
    ...over,
  }
}

describe('injectWEngineCardDisplay · 音擎名录注入卡片展示面', () => {
  it('主/副属性与效果正文注入名录，属性只带展示所需的最小面（不含 name2）', () => {
    const row: Record<string, unknown> = { Id: 14104, zh: '硫磺石' }
    injectWEngineCardDisplay(row, detail())

    expect(row['base_property']).toEqual({ name: '基础攻击力', value: 46, format: '{0:0.#}' })
    expect(row['rand_property']).toEqual({ name: '攻击力', value: 1200, format: '{0:0.#%}' })
    expect(row['effect_name']).toBe('炽烈吐息')
    expect(row['effect_desc']).toBe('装备者的攻击力提升3.5%…')
    expect(row['effect_refine']).toBe(1)
  })

  it('格式串缺失时不写 format 键（名录保持最小形状）', () => {
    const row: Record<string, unknown> = {}
    injectWEngineCardDisplay(
      row,
      detail({
        rand_property: { name: '异常精通', value: 24 },
      }),
    )
    expect(row['rand_property']).toEqual({ name: '异常精通', value: 24 })
  })

  it('缺基础精炼档时取最小数字档，并如实标注实际档位', () => {
    const row: Record<string, unknown> = {}
    injectWEngineCardDisplay(
      row,
      detail({
        talents: {
          3: { name: '三段效果', desc: '…' },
          5: { name: '五段效果', desc: '…' },
        },
      }),
    )
    expect(row['effect_name']).toBe('三段效果')
    expect(row['effect_refine']).toBe(3)
  })

  it('非数字键的 talents（源站形状变更）不注入效果，避免卡片标注错档位', () => {
    const row: Record<string, unknown> = {}
    injectWEngineCardDisplay(row, detail({ talents: { lv1: { name: 'x', desc: 'y' } } }))
    expect(row['effect_name']).toBeUndefined()
    expect(row['effect_desc']).toBeUndefined()
    expect(row['effect_refine']).toBeUndefined()
  })

  it('属性缺 value 不注入（卡片不渲染空面板）', () => {
    const row: Record<string, unknown> = {}
    injectWEngineCardDisplay(row, detail({ base_property: { name: '基础攻击力' }, rand_property: undefined }))
    expect(row['base_property']).toBeUndefined()
    expect(row['rand_property']).toBeUndefined()
  })

  it('详情缺失（名录行 undefined）时静默跳过，不阻断构建', () => {
    expect(() => injectWEngineCardDisplay(undefined, detail())).not.toThrow()
  })
})
