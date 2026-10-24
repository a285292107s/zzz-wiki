// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PotentialCinemaGroup from '../src/components/detail/PotentialCinemaGroup.vue'
import type { PotentialCinema, PotentialGate } from '../src/domain/sections'

const cinema: PotentialCinema[] = [
  { no: 'I', level: 1, label: '猫的报恩 I', base: '猫的报恩', mark: 'I', name: '', desc: '', image: 'Nekomiya' },
  { no: 'II', level: 2, label: '猫的报恩 II', base: '猫的报恩', mark: 'II', name: '潜能觉醒：夜行习性', desc: '暴击伤害提升20%。', image: 'Nekomiya' },
]

const gates: Record<string, PotentialGate[]> = {
  I: [
    { slot: 'basic', kind: 'enhance', name: '普通攻击：猫猫爪刺', derived: false },
    { slot: 'basic', kind: 'new', name: '闪避：尾巴失踪术', derived: false },
    { slot: 'special', kind: 'new', name: '涡流集束手雷', derived: true },
    { slot: 'core', kind: 'extend', name: '核心被动', derived: false },
  ],
  II: [],
}

function mountGroup() {
  return mount(PotentialCinemaGroup, {
    props: {
      cinema,
      gates,
      art: '/data/img/awaken/AvatarSpecialAwakenBg_Nekomiya.webp',
      name: '/data/img/awaken/AvatarSpecialAwakenBg_NekomiyaText.webp',
      crop: '22% 50%',
    },
  })
}

describe('PotentialCinemaGroup 档位竖条', () => {
  it('默认展开首档，其余收起', () => {
    const w = mountGroup()
    const heads = w.findAll('.strip-head')
    expect(heads).toHaveLength(2)
    expect(heads.map((h) => h.attributes('aria-expanded'))).toEqual(['true', 'false'])
  })

  it('档位序号牌与立绘铭牌取解包美术', () => {
    const w = mountGroup()
    expect(w.findAll('.strip-no').map((n) => n.attributes('src'))).toEqual([
      '/data/img/awaken/ASA_01.webp',
      '/data/img/awaken/ASA_02.webp',
    ])
    expect(w.find('.plate-name').attributes('src')).toBe(
      '/data/img/awaken/AvatarSpecialAwakenBg_NekomiyaText.webp',
    )
  })

  it('点击竖条切换到该档（含按钮可访问名）', async () => {
    const w = mountGroup()
    const heads = w.findAll('.strip-head')
    await heads[1]!.trigger('click')
    expect(w.findAll('.strip-head').map((h) => h.attributes('aria-expanded'))).toEqual(['false', 'true'])
    expect(heads[1]!.attributes('aria-label')).toBe('02 猫的报恩 II')
    expect(w.find('.strip.on .strip-body').text()).toContain('暴击伤害提升')
  })

  it('有门控数据时按槽位归组逐行陈列，派生数值子块不单列', () => {
    const w = mountGroup()
    const rows = w.findAll('.strip.on .gate')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('普通攻击：猫猫爪刺')
    expect(rows[0]!.text()).toContain('闪避：尾巴失踪术')
    expect(rows[1]!.text()).toContain('核心被动')
    expect(w.find('.strip.on .strip-body').text()).not.toContain('涡流集束手雷')
  })

  it('无门控数据的档位回落到原生描述', async () => {
    const w = mountGroup()
    await w.findAll('.strip-head')[1]!.trigger('click')
    expect(w.find('.strip.on .gates').exists()).toBe(false)
    expect(w.find('.strip.on .strip-desc').exists()).toBe(true)
  })
})
