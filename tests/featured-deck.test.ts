// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import FeaturedDeck from '@/components/home/FeaturedDeck.vue'
import type { FeaturedCard } from '@/composables/useFeaturedAgents'

/** 造 N 张卡（结构同 buildFeaturedCards 的输出，只留测试关心的字段） */
function cards(n: number): FeaturedCard[] {
  return Array.from({ length: n }, (_, i) => ({
    id: 1000 + i,
    no: String(i + 1).padStart(2, '0'),
    zh: `角色${i + 1}`,
    en: `Agent ${i + 1}`,
    elementZh: '冰',
    elementColor: '#5ac8fa',
    srcs: [{ src: `/data/img/hero/mobile/Mindscape_${1000 + i}_2.webp` }],
    pos: '50%',
    zoom: 1.2,
    originY: 50,
    to: `/agents/${1000 + i}`,
  }))
}

const RouterLinkStub = defineComponent({
  name: 'RouterLinkStub',
  props: { to: { type: [String, Object], default: '' } },
  setup(props, { slots }) {
    // 真 vue-router 的 <RouterLink> 会拦下点击自行导航；桩同样拦，否则 jsdom 会去真的跳页
    const onClick = (e: MouseEvent) => e.preventDefault()
    return () => h('a', { href: String(props.to), onClick }, slots.default?.())
  },
})

const global = { stubs: { RouterLink: RouterLinkStub, HollowImage: true } }

/** 取景框宽（跟手换算基准）：jsdom 没有布局，clientWidth 恒为 0 → 打桩。
 *  组件只在 **pointerdown 那一刻**读它（静止态位移走百分比，不需要宽）。
 *  先 restoreAllMocks 再打桩：否则 spyOn 会包在上一用例的桩上，数值被平方。 */
const VP_W = 1000
function stubLayout(): void {
  vi.restoreAllMocks()
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('deck-viewport') ? VP_W : 0
  })
}

async function mountDeck(n = 4) {
  stubLayout()
  const wrapper = mount(FeaturedDeck, { props: { cards: cards(n) }, global })
  // 取景框宽是 onMounted 里量出来的：首渲染还没有它，等一拍让轨道摆正
  await wrapper.vm.$nextTick()
  return wrapper
}

type DeckWrapper = Awaited<ReturnType<typeof mountDeck>>

/** 轨道内联平移的 x（px）。位移是一条 `calc(基位移% + 跟手px)`（见 trackStyle）：
 *  百分比按取景框宽（VP_W）折算成 px，故这里要传入同一基准。
 *  读 **live CSSOM**（element.style）而非 attributes('style')：
 *  Vue 对 style 绑定是直接改 CSSOM，属性序列化停在初次渲染，读 attributes 会拿到旧值 */
function trackShiftX(wrapper: DeckWrapper): number {
  const el = wrapper.find('.deck-track').element as HTMLElement
  const m = /translate3d\(calc\((-?[\d.]+)% \+ (-?[\d.]+)px\)/.exec(el.style.transform)
  if (!m) return Number.NaN
  return (Number(m[1]) / 100) * VP_W + Number(m[2])
}

function dragBy(wrapper: DeckWrapper, dx: number): void {
  const vp = wrapper.find('.deck-viewport')
  vp.element.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 500, button: 0 }))
  window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 500 + dx }))
  window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 500 + dx }))
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('FeaturedDeck 结构与无障碍', () => {
  it('每张角色卡恰好一个 slide、一个链接，槽位按百分比排布（不需要测量）', async () => {
    const wrapper = await mountDeck(4)
    const slides = wrapper.findAll('.deck-slide')
    const links = wrapper.findAll('a')
    expect(slides).toHaveLength(4)
    expect(links).toHaveLength(4)
    expect(links.map((l) => l.attributes('href'))).toEqual([
      '/agents/1000',
      '/agents/1001',
      '/agents/1002',
      '/agents/1003',
    ])
    // 槽位横向位置走 --slot-index（0..3），CSS 里换成 left: s·100%
    expect(slides.map((s) => s.attributes('style'))).toEqual([
      expect.stringContaining('--slot-index: 0'),
      expect.stringContaining('--slot-index: 1'),
      expect.stringContaining('--slot-index: 2'),
      expect.stringContaining('--slot-index: 3'),
    ])
  })

  it('slide 语义按 APG 补齐：role=group + aria-roledescription + 可访问名；链接名自带可见文本', async () => {
    const wrapper = await mountDeck(4)
    const slides = wrapper.findAll('.deck-slide')
    for (const s of slides) {
      expect(s.attributes('role')).toBe('group')
      expect(s.attributes('aria-roledescription')).toBe('角色卡')
      expect(s.attributes('aria-label')).toMatch(/^第 [1-4] 位：角色[1-4] · 编号 \d{2} · 冰$/)
    }
    expect(slides[0]!.attributes('aria-label')).toBe('第 1 位：角色1 · 编号 01 · 冰')
    // 卡内链接只包立绘（alt=""），可见文本在**图下的标本签**里（不在链接内部），
    // 故链接自带 aria-label（含同样的字串）即满足 Label in Name，也不会触发
    // axe label-content-name-mismatch（该规则以元素自身的可见文本为基准）。
    const firstLink = wrapper.findAll('a')[0]!
    expect(firstLink.attributes('aria-label')).toBe('角色1 · 编号 01 · 冰')
    expect(firstLink.attributes('aria-labelledby')).toBeUndefined()
  })

  it('非活动卡不进 Tab 序列；活动卡标 aria-current', async () => {
    const wrapper = await mountDeck(4)
    const links = wrapper.findAll('a')
    expect(links[0]!.attributes('tabindex')).toBeUndefined()
    expect(links[0]!.attributes('aria-current')).toBe('true')
    for (const l of links.slice(1)) {
      expect(l.attributes('tabindex')).toBe('-1')
      expect(l.attributes('aria-current')).toBeUndefined()
    }
  })

  it('非自动轮播：牌堆容器 aria-live=polite，拖动中临时改 off（避免逐帧播报）', async () => {
    const wrapper = await mountDeck(4)
    const track = wrapper.find('.deck-track')
    expect(track.attributes('aria-live')).toBe('polite')
    wrapper.find('.deck-viewport').element.dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true, clientX: 500, button: 0 }),
    )
    await wrapper.vm.$nextTick()
    expect(track.attributes('aria-live')).toBe('off')
  })

  it('标本签在图下、只渲染当前卡：换卡后内容与座次同步（读屏仍拿 slide 的可访问名）', async () => {
    const wrapper = await mountDeck(4)
    // 全组件只有一份标本签（4 张卡不各留一份），且对辅助技术隐藏（信息已由 slide 提供）
    const labels = wrapper.findAll('.deck-label')
    expect(labels).toHaveLength(1)
    expect(labels[0]!.attributes('aria-hidden')).toBe('true')
    expect(labels[0]!.find('.no').text()).toBe('01')
    expect(labels[0]!.find('.el').text()).toBe('冰')
    expect(labels[0]!.find('.zh').text()).toBe('角色1')
    expect(labels[0]!.find('.en').text()).toBe('Agent 1')
    expect(wrapper.find('.deck-count').text()).toBe('01 / 04')

    // 换卡：标本签内容随之切换（图上不叠任何文字）
    await wrapper.find('.deck-viewport').trigger('keydown', { key: 'ArrowRight' })
    const after = wrapper.find('.deck-label')
    expect(after.find('.zh').text()).toBe('角色2')
    expect(after.find('.no').text()).toBe('02')
    expect(wrapper.find('.deck-count').text()).toBe('02 / 04')
  })

  it('图上不叠文字：卡片内部只装立绘（标本签在框外，立绘不被遮挡）', async () => {
    const wrapper = await mountDeck(4)
    for (const item of wrapper.findAll('.deck-item')) {
      expect(item.find('.deck-label').exists()).toBe(false)
      expect(item.find('.deck-plate').exists()).toBe(false)
      // HollowImage 在测试里是桩，故只断言「立绘宿主」在卡内、且卡内无文字层
      expect(item.find('.deck-figure').exists()).toBe(true)
      expect(item.text()).toBe('')
    }
    // 标本签挂在装裱框下、取景框之外
    expect(wrapper.find('.deck-viewport .deck-meta').exists()).toBe(false)
    expect(wrapper.find('.deck-frame > .deck-meta').exists()).toBe(true)
  })

  it('缺名录真值时按占位条渲染（名字未到达不跳变）', async () => {
    stubLayout()
    const blank = cards(2).map((c) => ({ ...c, zh: '', en: '', elementZh: '' }))
    const wrapper = mount(FeaturedDeck, { props: { cards: blank }, global })
    await wrapper.vm.$nextTick()
    const label = wrapper.find('.deck-label')
    expect(label.find('.zh').exists()).toBe(false)
    expect(label.find('.zh-bar').exists()).toBe(true)
    expect(label.find('.en-bar').exists()).toBe(true)
    expect(label.find('.no').text()).toBe('01')
  })

  it('单卡池：不渲染刻度、拖拽无意义（槽位恒为 0）', async () => {
    const wrapper = await mountDeck(1)
    expect(wrapper.find('.deck-ticks').exists()).toBe(false)
    dragBy(wrapper, -600)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.deck-count').text()).toBe('01 / 01')
  })

  it('卡片是静态槽位（不露邻卡）：slide 只有 --slot-index，无 transform/opacity/z-index', async () => {
    const wrapper = await mountDeck(4)
    for (const [i, slide] of wrapper.findAll('.deck-slide').entries()) {
      expect(slide.attributes('style')).toBe(`--slot-index: ${i};`)
    }
  })

  it('刻度声明它控制的 slide：aria-controls 指向真实存在的 slide id', async () => {
    const wrapper = await mountDeck(4)
    const controls = wrapper.findAll('.deck-tick').map((t) => t.attributes('aria-controls'))
    expect(controls).toEqual(['deck-slide-0', 'deck-slide-1', 'deck-slide-2', 'deck-slide-3'])
    for (const id of controls) expect(wrapper.find(`#${id}`).exists()).toBe(true)
  })
})

describe('FeaturedDeck 拖拽吸附', () => {
  it('跟手：拖动中轨道位移随指针 1:1 跟随，松手吸附回原位', async () => {
    const wrapper = await mountDeck(4)
    const rest = trackShiftX(wrapper)
    expect(rest).toBe(0) // 活动卡是第 1 张，轨道无需平移

    const vp = wrapper.find('.deck-viewport')
    vp.element.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 500, button: 0 }))
    window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 400 }))
    await wrapper.vm.$nextTick()
    await nextTick()
    // 左拖 100px：跟手位移与指针 1:1，方向为负（内容跟着指针向左走）
    expect(trackShiftX(wrapper)).toBe(-100)

    window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 400 }))
    await wrapper.vm.$nextTick()
    await nextTick()
    expect(wrapper.find('.deck-count').text()).toBe('01 / 04') // 不足半张 → 回原位
    expect(trackShiftX(wrapper)).toBe(0)
  })

  it('左拖过一张：活动卡前进，标本签与轨道同步', async () => {
    const wrapper = await mountDeck(4)
    dragBy(wrapper, -VP_W)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.deck-count').text()).toBe('02 / 04')
    expect(wrapper.find('.deck-label .zh').text()).toBe('角色2')
    // 活动槽位 0 → 1：轨道左移一个取景框宽
    expect(trackShiftX(wrapper)).toBe(-VP_W)
  })

  it('右拖过一张：活动卡后退', async () => {
    const wrapper = await mountDeck(4)
    dragBy(wrapper, -VP_W)
    await wrapper.vm.$nextTick()
    dragBy(wrapper, VP_W)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.deck-count').text()).toBe('01 / 04')
  })

  it('快拖很远也只钉在两端（不越出池子）', async () => {
    const wrapper = await mountDeck(4)
    dragBy(wrapper, -10 * VP_W)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.deck-count').text()).toBe('04 / 04')
    expect(trackShiftX(wrapper)).toBe(-3 * VP_W)

    dragBy(wrapper, 10 * VP_W)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.deck-count').text()).toBe('01 / 04')
    expect(trackShiftX(wrapper)).toBe(0)
  })

  it('拖动后抑制这一次 click（拖完松手不该跳详情），下一次正常点击放行', async () => {
    const wrapper = await mountDeck(4)
    const link = wrapper.findAll('a')[0]!
    dragBy(wrapper, -VP_W)

    // 桩自己会拦导航；区分「是否被拖拽闸门拦下」要看事件是否被 stopPropagation
    let bubbled = 0
    link.element.addEventListener('click', () => {
      bubbled += 1
    })

    const ev = new MouseEvent('click', { bubbles: true, cancelable: true })
    link.element.dispatchEvent(ev)
    expect(bubbled).toBe(0)

    const ev2 = new MouseEvent('click', { bubbles: true, cancelable: true })
    link.element.dispatchEvent(ev2)
    expect(bubbled).toBe(1)
  })

  it('指针移出取景框后仍跟手：监听挂在 window 上，不依赖 pointer capture', async () => {
    const wrapper = await mountDeck(4)
    const vp = wrapper.find('.deck-viewport')
    vp.element.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 500, button: 0 }))
    // 指针已拖到取景框之外，且位移超过半张（VP_W/2 = 500）→ 应前进一张
    window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: -100 }))
    window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: -100 }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.deck-count').text()).toBe('02 / 04')
  })

  it('轨道基位移写成百分比（静止态不依赖任何测量），首帧就正确', async () => {
    vi.restoreAllMocks() // 不打桩 clientWidth：证明位移与测量无关
    const wrapper = mount(FeaturedDeck, { props: { cards: cards(4) }, global })
    await wrapper.vm.$nextTick()
    const style = (wrapper.find('.deck-track').element as HTMLElement).style.transform
    expect(style).toContain('%')
    expect(style).toContain('calc(')
    expect(trackShiftX(wrapper)).toBe(0) // 活动卡是第 1 张 → 位移 0
  })
})

describe('FeaturedDeck 键盘与刻度', () => {
  it('方向键 / Home / End 切换活动卡', async () => {
    const wrapper = await mountDeck(4)
    const vp = wrapper.find('.deck-viewport')
    await vp.trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.find('.deck-count').text()).toBe('02 / 04')
    await vp.trigger('keydown', { key: 'End' })
    expect(wrapper.find('.deck-count').text()).toBe('04 / 04')
    await vp.trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.find('.deck-count').text()).toBe('03 / 04')
    await vp.trigger('keydown', { key: 'Home' })
    expect(wrapper.find('.deck-count').text()).toBe('01 / 04')
  })

  it('刻度可点跳转，并按 APG 标出当前项（aria-disabled 而非 selected）', async () => {
    const wrapper = await mountDeck(4)
    const ticks = wrapper.findAll('.deck-tick')
    expect(ticks).toHaveLength(4)
    expect(ticks[0]!.attributes('aria-disabled')).toBe('true')
    expect(ticks[1]!.attributes('aria-disabled')).toBeUndefined()
    // 选择器是 button（不是 tab：本组件没有配对的 tabpanel，套 tabs 语义会错位）
    for (const t of ticks) {
      expect(t.element.tagName).toBe('BUTTON')
      expect(t.attributes('role')).toBeUndefined()
    }
    expect(wrapper.find('.deck-ticks').attributes('role')).toBe('group')
    expect(wrapper.find('.deck-ticks').attributes('aria-label')).toBe('选择要展示的角色')

    await ticks[2]!.trigger('click')
    expect(wrapper.find('.deck-count').text()).toBe('03 / 04')
    expect(wrapper.findAll('.deck-tick')[2]!.attributes('aria-disabled')).toBe('true')
    expect(wrapper.findAll('.deck-tick')[0]!.attributes('aria-disabled')).toBeUndefined()
  })
})
