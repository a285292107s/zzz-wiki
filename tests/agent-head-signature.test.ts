// AgentHead hero 专属音擎（signature W-Engine）卡片：v-if 门控 + 图标候选 + 跳转路由。
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import AgentHead from '../src/components/detail/AgentHead.vue'
import type { CharacterDetail, WEngineListItem } from '../src/data/types'

const detail = {
  id: 1091,
  name: '星见雅',
  code_name: 'MIYABI',
  rarity: 4,
} as unknown as CharacterDetail

/** 专属音擎（命名签名：Weapon_S_1091 → Id 14109） */
const signatureEngine = {
  Id: 14109,
  icon: 'Weapon_S_1091',
  zh: '霰落星殿',
} as unknown as WEngineListItem

/** 真实 memory router：RouterLink 依 resolve 渲染 href，与运行时行为一致 */
function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/w-engines/:id', component: { template: '<div/>' } },
      // 兜底：初始 location 为空，避免 vue-router 的 "No match" 告警
      { path: '/:pathMatch(.*)*', component: { template: '<div/>' } },
    ],
  })
}

function chip(w: ReturnType<typeof mount>) {
  return w.find('.signature')
}

describe('AgentHead hero 专属音擎卡片', () => {
  it('传入 signatureEngine 时渲染卡片，链接指向 /w-engines/{Id}', () => {
    const w = mount(AgentHead, {
      props: { detail, signatureEngine },
      global: { plugins: [makeRouter()] },
    })
    const c = chip(w)
    expect(c.exists()).toBe(true)
    expect(c.attributes('href')).toBe('/w-engines/14109')
    expect(c.find('.sig-label').text()).toBe('专属音擎')
    expect(c.find('.sig-name').text()).toBe('霰落星殿')
    // 音擎图标素材是方形（400×400）→ 默认方盒（非 banner），与音擎列表同尺寸约定
    expect(c.find('.sig-icon').classes()).not.toContain('banner')
  })

  it('卡片渲染武器图标候选链（本地化优先）', () => {
    const w = mount(AgentHead, {
      props: { detail, signatureEngine },
      global: { plugins: [makeRouter()] },
    })
    expect(chip(w).find('img').attributes('src')).toBe('/data/img/weapon/Weapon_S_1091.webp')
  })

  it('未传入 signatureEngine（名录未加载/未覆盖）时不渲染卡片', () => {
    const w = mount(AgentHead, {
      props: { detail },
      global: { plugins: [makeRouter()] },
    })
    expect(chip(w).exists()).toBe(false)
  })
})
