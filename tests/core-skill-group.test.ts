// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CoreSkillGroup from '../src/components/detail/CoreSkillGroup.vue'
import type { CoreEnhanceLevel, CoreSkill } from '../src/domain/sections'

/** 7 级核心技样本（无潜能双轮结构） */
const row: CoreSkill = {
  coreName: '测试被动',
  extraName: '测试额外能力',
  levelCount: 7,
  hasEnhance: false,
  levels: Array.from({ length: 7 }, (_, i) => ({
    no: i + 1,
    level: i + 1,
    enhanced: false,
    coreName: '测试被动',
    extraName: '测试额外能力',
    desc: ['被动描述', '额外能力描述'],
  })),
}

/** A-F 六档核心技强化：解锁门槛 15/25/35/45/55/60（与游戏数据口径一致） */
const enhance: CoreEnhanceLevel[] = [15, 25, 35, 45, 55, 60].map((unlockAt, i) => ({
  no: 'ABCDEF'[i],
  unlockAt,
  bonus: [{ name: `属性${i + 1}`, value: 1, text: '1%' }],
}))

/** 档位状态类断言辅助：返回各行的两态类集合 */
function tierStates(w: ReturnType<typeof mount>) {
  return w.findAll('.tier').map((li) => ({
    unlocked: li.classes().includes('is-unlocked'),
    locked: li.classes().includes('is-locked'),
  }))
}

describe('CoreSkillGroup 核心技强化（解锁档位）', () => {
  it('缺省 charLevel 视为满级：全部解锁、计数满态琥珀', () => {
    const w = mount(CoreSkillGroup, { props: { row, enhance } })
    expect(w.find('.enhance-count').text()).toBe('6/6')
    expect(w.find('.enhance-count').classes()).toContain('is-full')
    const states = tierStates(w)
    expect(states.every((s) => s.unlocked && !s.locked)).toBe(true)
  })

  it('角色等级 30：解锁 A/B 两档，C-F 弱化', () => {
    const w = mount(CoreSkillGroup, { props: { row, enhance, charLevel: 30 } })
    expect(w.find('.enhance-count').text()).toBe('2/6')
    expect(w.find('.enhance-count').classes()).not.toContain('is-full')
    expect(tierStates(w)).toEqual([
      { unlocked: true, locked: false },
      { unlocked: true, locked: false },
      { unlocked: false, locked: true },
      { unlocked: false, locked: true },
      { unlocked: false, locked: true },
      { unlocked: false, locked: true },
    ])
  })

  it('角色等级低于首档门槛：0/6、全部弱化', () => {
    const w = mount(CoreSkillGroup, { props: { row, enhance, charLevel: 14 } })
    expect(w.find('.enhance-count').text()).toBe('0/6')
    expect(tierStates(w)).toEqual(
      Array.from({ length: 6 }, () => ({ unlocked: false, locked: true })),
    )
  })

  it('随 charLevel 变化实时联动（60 全解锁 → 40 剩 C-F 未解锁）', async () => {
    const w = mount(CoreSkillGroup, { props: { row, enhance, charLevel: 60 } })
    expect(w.find('.enhance-count').text()).toBe('6/6')
    await w.setProps({ charLevel: 40 })
    expect(w.find('.enhance-count').text()).toBe('3/6')
    expect(tierStates(w)[2].unlocked).toBe(true)
    expect(tierStates(w)[3].locked).toBe(true)
  })

  it('档位行内容：档号 + 解锁门槛 + 加成数值', () => {
    const w = mount(CoreSkillGroup, { props: { row, enhance: [enhance[2]] } })
    const tier = w.find('.tier')
    expect(tier.find('.tier-no').text()).toBe('C')
    expect(tier.find('.tier-gate').text()).toBe('Lv.35')
    expect(tier.find('.tier-bonus').text()).toContain('属性3')
    expect(tier.find('.tier-bonus').text()).toContain('+1%')
  })

  it('enhance 为空时强化区块整体不渲染', () => {
    const w = mount(CoreSkillGroup, { props: { row, enhance: [] } })
    expect(w.find('.enhance').exists()).toBe(false)
  })
})

describe('CoreSkillGroup {CAL:…} 内嵌公式（核心被动路径）', () => {
  /** 青衣核心被动同款：常量公式占位（{CAL:5+5,1,2} → 10），随等级不变 */
  const calRow: CoreSkill = {
    coreName: '旋劲入斗',
    extraName: '蓄魂',
    levelCount: 7,
    hasEnhance: false,
    levels: Array.from({ length: 7 }, () => ({
      no: 1,
      level: 1,
      enhanced: false,
      coreName: '旋劲入斗',
      extraName: '蓄魂',
      desc: [
        '在发动终结一击时，若触发[极限闪避]，可以直接施加{CAL:5+5,1,2}层[羁服]',
        '额外能力描述',
      ],
    })),
  }

  it('描述中的 {CAL:} 常量公式按数值渲染，不回显原始标记', () => {
    const w = mount(CoreSkillGroup, { props: { row: calRow } })
    const desc = w.findAll('.desc')[0].text()
    expect(desc).toContain('可以直接施加10层[羁服]')
    expect(desc).not.toContain('{CAL')
  })
})