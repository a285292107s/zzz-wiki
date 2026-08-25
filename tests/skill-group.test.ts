// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SkillGroup from '../src/components/detail/SkillGroup.vue'
import type { SkillRow } from '../src/domain/sections'

/** 带数值条目的技能行样本（伤害倍率 = main + growth*(lv-1)） */
const row: SkillRow = {
  key: 'chain',
  zh: '连携技',
  keyEn: 'CHAIN',
  hasNumbers: true,
  groups: [
    {
      name: '连携技：行军仪仗',
      desc: '说明。',
      entries: [
        {
          name: '伤害倍率',
          formula: '{Skill:1551012, Prop:1001}',
          props: { '1551012': { main: 100, growth: 10, format: '%' } },
          format: '%',
        },
      ],
    },
  ],
}

describe('SkillGroup 等级来源（外部 v-model:level 共享）', () => {
  it('未绑定时内部自管：默认满级（12）并随该级计算', () => {
    const w = mount(SkillGroup, { props: { row, glyph: '✕', srcs: [] } })
    expect(w.find('.level-val').text()).toBe('Lv.12')
    // 12 级：100 + 10*11 = 210 → 2.1%
    expect(w.find('.stat-val').text()).toBe('2.1%')
  })

  it('外部绑定 level 时随绑定值展示并计算（连携技/终结技共享一份）', () => {
    const w = mount(SkillGroup, { props: { row, glyph: '✕', srcs: [], level: 5 } })
    expect(w.find('.level-val').text()).toBe('Lv.5')
    // 5 级：100 + 10*4 = 140 → 1.4%
    expect(w.find('.stat-val').text()).toBe('1.4%')
  })

  it('拖动滑条时发出 update:level（供父级共享源接管）', async () => {
    const w = mount(SkillGroup, { props: { row, glyph: '✕', srcs: [], level: 5 } })
    const input = w.find('input[type="range"]')
    await input.setValue('7')
    expect(w.emitted('update:level')).toBeTruthy()
    expect(w.emitted('update:level')?.at(-1)).toEqual([7])
  })
})
