// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { mount } from '@vue/test-utils'
import SkillGroup from '../src/components/detail/SkillGroup.vue'
import { SKILL_LEVEL_CAP, SKILL_LEVEL_DEFAULT, type SkillRow } from '../src/domain/sections'

/** 带数值条目的技能行样本（伤害倍率 = main + growth*(lv-1)） */
const row: SkillRow = {
  key: 'chain',
  label: '连携技',
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

describe('SkillGroup 等级上限（影画加成后的 16 级口径）', () => {
  /** 角色技能区调用形态：上限 16（含影画 +4），默认 12 */
  const roleGroup = {
    props: {
      row,
      glyph: '✕',
      srcs: [],
      levelCount: SKILL_LEVEL_CAP,
      defaultLevel: SKILL_LEVEL_DEFAULT,
    },
  }

  it('滑条可达 16 级，但默认仍停在 12 级、数值按 12 级算', () => {
    const w = mount(SkillGroup, roleGroup)
    const input = w.find('input[type="range"]')
    expect(input.attributes('max')).toBe('16')
    expect(input.attributes('min')).toBe('1')
    expect(w.find('.level-val').text()).toBe('Lv.12')
    // 12 级：100 + 10*11 = 210 → 2.1%（未被上限顶到 16 级）
    expect(w.find('.stat-val').text()).toBe('2.1%')
  })

  it('拖到 16 级时按 16 级出数值（影画满级口径）', async () => {
    const w = mount(SkillGroup, { ...roleGroup, props: { ...roleGroup.props, level: 16 } })
    expect(w.find('.level-val').text()).toBe('Lv.16')
    // 16 级：100 + 10*15 = 250 → 2.5%
    expect(w.find('.stat-val').text()).toBe('2.5%')
  })

  it('未传 defaultLevel 时退回上限（邦布「上限即满级」行为不变）', () => {
    const w = mount(SkillGroup, { props: { row, glyph: 'a', srcs: [], levelCount: 10 } })
    expect(w.find('input[type="range"]').attributes('max')).toBe('10')
    expect(w.find('.level-val').text()).toBe('Lv.10')
  })
})

describe('SkillGroup {CAL:…} 内嵌公式（如 曙色颂·转辉 伤害提升）', () => {
  /** 蕾米埃尔「特殊技：曙色颂·转辉」同款结构：描述内嵌 CAL 公式 + 无数值表的 CAL 条目 */
  const calRow: SkillRow = {
    key: 'special',
    label: '特殊技',
    keyEn: 'SPECIAL',
    hasNumbers: true,
    groups: [
      {
        name: '特殊技：曙色颂·转辉',
        desc: '进入[相变时流]状态时，蕾米埃尔会使全队角色造成的伤害提升<color=#2BAD00>{CAL:0+AvatarSkillLevel(1)*1.5,1,2}%</color>，持续60秒。',
        entries: [
          {
            name: '伤害倍率',
            formula: '{Skill:1581010, Prop:1001}',
            props: { '1581010': { main: 16470, growth: 1500, format: '%' } },
            format: '%',
          },
          {
            name: '伤害提升',
            formula: '{CAL:0+AvatarSkillLevel(1)*1.5,1,2}%',
            props: {},
          },
        ],
      },
    ],
  }

  it('描述与数值行都按当前等级出数字，不回显原始标记', () => {
    const w = mount(SkillGroup, { props: { row: calRow, glyph: '△', srcs: [] } })
    // 默认满级 12：1.5*12 = 18%
    expect(w.find('.desc').text()).toContain('伤害提升18%')
    expect(w.find('.desc').text()).not.toContain('{CAL')
    // 数值行：伤害倍率 16470+1500*11 = 32970 → 329.7%；伤害提升 18%
    expect(w.findAll('.stat-val').map((n) => n.text())).toEqual(['329.7%', '18%'])
  })

  it('随外部等级联动（Lv.1 → 1.5%）', () => {
    const w = mount(SkillGroup, { props: { row: calRow, glyph: '△', srcs: [], level: 1 } })
    expect(w.find('.desc').text()).toContain('伤害提升1.5%')
    expect(w.findAll('.stat-val').map((n) => n.text())).toEqual(['164.7%', '1.5%'])
  })
})

describe('SkillGroup 组名是游戏标记文本（日文注音不得裸插值）', () => {
  // 日文数据的**招式名**带注音标记，且只有日文有（zh/en/ko 实测 0 处）；
  // 说明文字一直走富文本工具，组名却是裸插值渲染的 → 曾把 `<ruby=…>` 原样印在行标题上。
  // 用真实数据取值，避免手写样本与线上数据脱节。
  const jaDetail = JSON.parse(
    readFileSync(path.join('public', 'data', 'live', 'ja', 'character', '1051.json'), 'utf8'),
  ) as { skill: Record<string, { description?: Array<{ name?: string }> }> }

  it('数据里确实带注音（前提锚：若数据不再带标记，本组用例应连同删除）', () => {
    const all = Object.values(jaDetail.skill).flatMap((s) => s.description ?? [])
    expect(all.some((d) => (d.name ?? '').includes('<ruby='))).toBe(true)
  })

  it('行标题渲染为可读文本，不出现 <ruby=…> 或 </ruby>', () => {
    const groups = Object.values(jaDetail.skill)
      .flatMap((s) => s.description ?? [])
      .filter((d) => (d.name ?? '').includes('<ruby='))
      .slice(0, 6)
      .map((d) => ({ name: d.name as string, desc: '说明。' }))
    expect(groups.length).toBeGreaterThan(0)

    const w = mount(SkillGroup, {
      props: {
        row: { key: 'basic', label: '通常攻撃', keyEn: 'BASIC', hasNumbers: false, groups },
        glyph: '△',
        srcs: [],
      },
    })
    const titles = w.findAll('.title-skill').map((n) => n.text())
    for (const txt of titles) {
      expect(txt).not.toContain('<ruby')
      expect(txt).not.toContain('</ruby>')
      expect(txt).not.toContain('=')
    }
    // 正向锚：注音剥掉后，汉字本体还在（不是被整段剥没了）
    expect(titles.join(' ')).toMatch(/[一-龯]/)
  })
})
