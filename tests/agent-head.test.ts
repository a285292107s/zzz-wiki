// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AgentHead from '../src/components/detail/AgentHead.vue'
import type { CharacterDetail } from '../src/data/types'

/** 最小角色样本：只需 hero 逻辑涉及的字段（id 驱动 Mindscape 场景图命名） */
const detail = {
  id: 1011,
  name: '测试代理人',
  code_name: 'TEST',
  rarity: 4,
  element_type: { 201: 'Fire' },
  weapon_type: { 1: 'Attack' },
  hit_type: { 101: 'Slash' },
  special_element_type: null,
} as unknown as CharacterDetail

function heroImg(w: ReturnType<typeof mount>) {
  return w.find('.hero-bg img')
}

describe('AgentHead hero 底图（本地优先 + CDN 兜底）', () => {
  it('首选本地化头图（/data/img/hero/Mindscape_{id}_2.webp）', () => {
    const w = mount(AgentHead, { props: { detail } })
    expect(heroImg(w).attributes('src')).toBe('/data/img/hero/Mindscape_1011_2.webp')
  })

  it('本地图加载失败时切换到 nanoka CDN 兜底，不破暗', async () => {
    const w = mount(AgentHead, { props: { detail } })
    await heroImg(w).trigger('error')
    expect(heroImg(w).attributes('src')).toBe(
      'https://static.nanoka.cc/assets/zzz/Mindscape_1011_2.webp',
    )
  })

  it('两级候选均失败时隐藏底图（降为底色，不渲染 img）', async () => {
    const w = mount(AgentHead, { props: { detail } })
    await heroImg(w).trigger('error')
    await heroImg(w).trigger('error')
    expect(heroImg(w).exists()).toBe(false)
  })

  it('切换角色（组件复用）时游标重置回本地候选', async () => {
    const w = mount(AgentHead, { props: { detail } })
    await heroImg(w).trigger('error')
    expect(heroImg(w).attributes('src')).toContain('static.nanoka.cc')
    await w.setProps({ detail: { ...detail, id: 1021 } })
    expect(heroImg(w).attributes('src')).toBe('/data/img/hero/Mindscape_1021_2.webp')
  })
})