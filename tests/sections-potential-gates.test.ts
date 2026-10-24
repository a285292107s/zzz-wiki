import { describe, expect, it } from 'vitest'
import { buildPotentialGates, buildSkillRows, buildCoreSkill } from '../src/domain/sections'

describe('buildPotentialGates', () => {
  it('按档位聚合门控招式，并携带槽位与类型', () => {
    const rows = buildSkillRows({
      basic: { description: [{ name: '普通攻击：冰刃浪', desc: '新招式。', potential: [119100] }] },
      dodge: {
        description: [
          { name: '冲刺攻击：潜袭', desc: '基础。', potential: [] },
          { name: '冲刺攻击：潜袭', desc: '强化。', potential: [119100] },
        ],
      },
    }, 'zh')
    const gates = buildPotentialGates(rows, undefined, 'zh')
    expect(gates.I?.map((g) => [g.slot, g.kind, g.name])).toEqual([
      ['basic', 'new', '普通攻击：冰刃浪'],
      ['dodge', 'enhance', '冲刺攻击：潜袭'],
    ])
  })

  it('派生数值子块标记 derived（面板按招式归组时不再单列）', () => {
    const rows = buildSkillRows({
      special: {
        description: [
          { name: '强化特殊技：超规工程清障', desc: '投掷手雷。', potential: [0] },
          {
            name: '涡流集束手雷基础倍率',
            param: [{ name: '伤害倍率', desc: '{Skill:2, Prop:1001}', param: { '2': { main: 8750, growth: 800, format: '%' } } }],
            potential: [118100],
          },
        ],
      },
    }, 'zh')
    const gates = buildPotentialGates(rows, undefined, 'zh')
    expect(gates.I?.find((g) => g.derived)?.name).toBe('涡流集束手雷')
  })

  it('核心技潜能扩展记在 core 槽位，且随档位归位', () => {
    const core = buildCoreSkill(
      {
        level: {
          '1': { level: 1, name: ['凌牙厉齿', '风暴潮'], desc: ['基础', '旧'], potential: [0] },
          '8': { level: 1, name: ['凌牙厉齿', '风暴潮'], desc: ['扩', '新'], potential: [119100] },
        },
      },
      'zh',
    )
    const gates = buildPotentialGates([], core, 'zh')
    expect(gates.I?.map((g) => [g.slot, g.kind, g.name])).toEqual([
      ['core', 'extend', '核心被动'],
      ['core', 'extend', '额外能力'],
    ])
  })
})
