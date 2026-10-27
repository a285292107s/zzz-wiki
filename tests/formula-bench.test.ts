// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import SettlementBench from '../src/components/formula/SettlementBench.vue'

function mountBench(): VueWrapper {
  return mount(SettlementBench, {
    global: { stubs: { RouterLink: true }, renderStubDefaultSlot: true },
  })
}

function gates(w: VueWrapper): Record<string, string> {
  return Object.fromEntries(
    w.findAll('.gate').map((g) => [g.find('.g-name').text(), g.find('.g-factor').text()]),
  )
}

/** 闸条读数（去掉 × 的画符）与页面显示的总倍率 */
function chain(w: VueWrapper) {
  const factors = w.findAll('.gate').map((g) => Number(g.find('.g-factor').text().replace('×', '')))
  const total = Number(/总倍率 ×([\d.]+)/.exec(w.find('.out-sub').text())?.[1])
  return { factors, product: factors.reduce((p, x) => p * x, 1), total }
}

function damage(w: VueWrapper): number {
  return Number(w.find('.out-value').text().replace(/,/g, ''))
}

function warnText(w: VueWrapper): string {
  return w.find('.out-warn').exists() ? w.find('.out-warn').text() : ''
}

async function clickButton(w: VueWrapper, selector: string, label: string) {
  const btn = w.findAll(selector).find((b) => b.text().trim() === label)
  if (!btn) throw new Error(`找不到按钮：${label}`)
  await btn.trigger('click')
  await nextTick()
}

async function setSlider(w: VueWrapper, label: string, value: number) {
  const input = w.findAll('input[type="range"]').find((i) => i.attributes('aria-label') === label)
  if (!input) throw new Error(`找不到滑条：${label}`)
  await input.setValue(String(value))
  await nextTick()
}

describe('结算台 · 读数与乘区链一致', () => {
  it('默认态：基础 10,000 × 增伤 ×2.2 × 暴击期望 ×1.72 × 防御 ×0.4545', () => {
    const w = mountBench()
    expect(damage(w)).toBe(17200)
    expect(w.find('.out-sub').text()).toContain('总倍率 ×1.72')
    const g = gates(w)
    expect(g['增伤区']).toBe('×2.2')
    expect(g['暴击区（期望）']).toBe('×1.72')
    expect(g['防御区']).toBe('×0.4545')
    expect(warnText(w)).toBe('')
  })

  it('闸条读数相乘等于页面显示的总倍率（精度足够复算）', async () => {
    const w = mountBench()
    for (const preset of ['重置', '24% 穿透率', '失衡窗口', '持秽盾首领'] as const) {
      await clickButton(w, '.presets .seg', preset)
      const { product, total } = chain(w)
      expect(product).toBeCloseTo(total, 2)
    }
  })

  it('贯穿增伤区按有效范围 [0.2, 9] 封顶：900% 显示 ×9 并提示截断', async () => {
    const w = mountBench()
    await clickButton(w, '.bench-modes .seg', '贯穿伤害')
    await setSlider(w, '贯穿增伤', 900)
    expect(gates(w)['贯穿增伤区']).toBe('×9')
    expect(warnText(w)).toContain('贯穿增伤区达上限 ×9')
  })

  it('增伤区顶到上限：×6 并提示', async () => {
    const w = mountBench()
    await setSlider(w, '增伤区', 600)
    expect(warnText(w)).toContain('增伤区达上限 ×6')
    expect(gates(w)['增伤区']).toBe('×6')
  })

  it('选中持秽盾首领即自带 25% 减伤（无需预设）', async () => {
    const w = mountBench()
    await clickButton(w, '.ctl-enemies .seg', '持秽盾首领')
    const g = gates(w)
    expect(g['防御区']).toBe('×0.3165')
    expect(g['减易伤区']).toBe('×0.75')
    expect(damage(w)).toBe(8981)
  })

  it('预设与敌人档位不互相残留：预设后切回首领，减易伤回到 ×1', async () => {
    const w = mountBench()
    await clickButton(w, '.presets .seg', '持秽盾首领')
    await clickButton(w, '.ctl-enemies .seg', '首领敌人')
    expect(gates(w)['减易伤区']).toBe('×1')
    expect(damage(w)).toBe(17200)
  })

  it('减易伤压到下限：×0.2 并提示', async () => {
    const w = mountBench()
    await setSlider(w, '减易伤', -100)
    expect(gates(w)['减易伤区']).toBe('×0.2')
    expect(warnText(w)).toContain('减易伤区达下限 ×0.2')
  })

  it('24% 穿透率预设把防御区推到 ×0.523，并给出可对照的收益读数', async () => {
    const w = mountBench()
    await clickButton(w, '.presets .seg', '24% 穿透率')
    expect(gates(w)['防御区']).toBe('×0.523')
    expect(damage(w)).toBe(19791)
    const note = w.find('.preset-note').text()
    expect(note).toContain('驱动盘 V 位主词条')
    expect(note).toContain('×0.4545 → ×0.523')
    expect(note).toContain('15.06%')
  })

  it('每个预设只改自己那一项，点「重置」才清空全部', async () => {
    const w = mountBench()
    await setSlider(w, '增伤区', 300)
    await clickButton(w, '.presets .seg', '24% 穿透率')
    expect(gates(w)['增伤区']).toBe('×4')
    expect(gates(w)['防御区']).toBe('×0.523')
    expect(w.find('[aria-pressed="true"][class*="seg"]').exists()).toBe(true)

    await clickButton(w, '.presets .seg', '重置')
    expect(gates(w)['增伤区']).toBe('×2.2')
    expect(gates(w)['防御区']).toBe('×0.4545')
    expect(damage(w)).toBe(17200)
  })

  it('提示行随预设切换：失衡给倍率、秽盾给防御与减伤读数', async () => {
    const w = mountBench()
    await clickButton(w, '.presets .seg', '失衡窗口')
    expect(w.find('.preset-note').text()).toContain('失衡易伤区 ×2')

    await clickButton(w, '.presets .seg', '持秽盾首领')
    const note = w.find('.preset-note').text()
    expect(note).toContain('防御区 ×0.3165')
    expect(note).toContain('减易伤区 ×0.75')
  })

  it('24% 穿透率给出去小账的入口，空闲图例也是同一入口', async () => {
    const idle = mountBench()
    expect(idle.find('.preset-link').text()).toContain('完整取舍')

    const w = mountBench()
    await clickButton(w, '.presets .seg', '24% 穿透率')
    const links = w.findAll('.preset-link')
    expect(links.length).toBe(1)
    expect(links[0].text()).toContain('穿透率与防御区')
  })
})
