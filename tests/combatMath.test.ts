import { describe, expect, it } from 'vitest'
import {
  anomalyBonusZone,
  anomalyCritZone,
  anomalyMasteryZone,
  bonusZone,
  chainProduct,
  critExpectation,
  damageLevelZone,
  dazeRecoverySeconds,
  dazeRecoverySpeed,
  defenseZone,
  disorderLevelZone,
  disorderRatio,
  enemyDefense,
  formatFactor,
  formatInt,
  formatPercent,
  formatSignedPercent,
  freezeSeconds,
  pierceBonusZone,
  pierceTradeoff,
  relativeGain,
  shieldDefenseZone,
  stunVulnerabilityZone,
  vulnerabilityZone,
  withShieldDamageRatio,
} from '../src/domain/combatMath'

const BOSS_DEF = 952.8

describe('防御区 · 与 2.0 版导论的算例对齐', () => {
  it('60 级首领防御 952.8，默认防御区 0.4545', () => {
    expect(enemyDefense(60)).toBeCloseTo(BOSS_DEF, 4)
    expect(defenseZone(BOSS_DEF)).toBeCloseTo(0.4545, 4)
  })

  it('24% 穿透率单独收益 15.06%', () => {
    const before = defenseZone(BOSS_DEF)
    const after = defenseZone(BOSS_DEF, { penRate: 0.24 })
    expect(relativeGain(before, after)).toBeCloseTo(0.1506, 4)
  })

  it('妮可 40% 减防在场时，24% 穿透率收益 11.17%（减防与穿透率乘算）', () => {
    const before = defenseZone(BOSS_DEF, { defDown: 0.4 })
    const after = defenseZone(BOSS_DEF, { defDown: 0.4, penRate: 0.24 })
    expect(relativeGain(before, after)).toBeCloseTo(0.1117, 4)
  })

  it('丽娜 30% 穿透率在场时，24% 穿透率收益 18.56%（穿透率之间加算）', () => {
    const before = defenseZone(BOSS_DEF, { penRate: 0.3 })
    const after = defenseZone(BOSS_DEF, { penRate: 0.54 })
    expect(relativeGain(before, after)).toBeCloseTo(0.1856, 4)
  })

  it('贯穿伤害跳过防御区，对首领为常规伤害的 2.2 倍', () => {
    expect(1 / defenseZone(BOSS_DEF)).toBeCloseTo(2.2, 2)
  })

  it('无视防御与减防加算，并与穿透率乘算', () => {
    const both = defenseZone(BOSS_DEF, { defIgnore: 0.2, defDown: 0.2, penRate: 0.5 })
    const same = defenseZone(BOSS_DEF, { defDown: 0.4, penRate: 0.5 })
    expect(both).toBeCloseTo(same, 10)
  })

  it('24% 穿透率对 30% 增伤的取舍：结算台与小账共用同一组数', () => {
    const bare = pierceTradeoff(BOSS_DEF)
    expect(bare.zoneBefore).toBeCloseTo(0.4545, 3)
    expect(bare.zoneAfter).toBeCloseTo(0.523, 3)
    expect(bare.gain).toBeCloseTo(0.1506, 4)
    expect(bare.breakEvenBonusZone).toBeCloseTo(1.9917, 3)

    expect(pierceTradeoff(BOSS_DEF, { defDown: 0.4 }).gain).toBeCloseTo(0.1117, 4)
    expect(pierceTradeoff(BOSS_DEF, { penBefore: 0.3 }).gain).toBeCloseTo(0.1856, 4)
  })

  it('防御区不越过 1（穿透吃满即视为无防）', () => {
    expect(defenseZone(BOSS_DEF, { penRate: 1 })).toBe(1)
  })
})

describe('秽盾 · 防御与减伤叠加', () => {
  it('秽浊流界下防御 ×1.8，防御区降至 0.3165', () => {
    expect(shieldDefenseZone(BOSS_DEF)).toBeCloseTo(0.3165, 4)
  })

  it('防御区损失与 25% 减伤合计为无盾时的 52.22%', () => {
    expect(withShieldDamageRatio(BOSS_DEF)).toBeCloseTo(0.5222, 4)
  })

  it('贯穿伤害对持盾首领为常规伤害的 3.16 倍', () => {
    expect(1 / shieldDefenseZone(BOSS_DEF)).toBeCloseTo(3.16, 2)
  })
})

describe('其余乘区', () => {
  it('暴击期望等于 1 + 暴击率 × 暴击伤害', () => {
    expect(critExpectation(0.05, 0.5)).toBeCloseTo(1.025, 6)
    expect(critExpectation(0.8, 2)).toBeCloseTo(2.6, 6)
  })

  it('增伤区有效范围 [0, 6]，减易伤区 [0.2, 2]', () => {
    expect(bonusZone(7)).toBe(6)
    expect(bonusZone(-2)).toBe(0)
    expect(vulnerabilityZone(0, 0.9)).toBeCloseTo(0.2, 6)
  })

  it('失衡易伤区分失衡 / 未失衡两档范围', () => {
    expect(stunVulnerabilityZone(true, 1)).toBe(2)
    expect(stunVulnerabilityZone(false, 1)).toBe(2)
    expect(stunVulnerabilityZone(false, 3)).toBe(3)
    expect(stunVulnerabilityZone(true, 6)).toBe(5)
  })

  it('贯穿增伤区、异常增伤区、异常暴击区各有独立上限', () => {
    expect(pierceBonusZone(12)).toBe(9)
    expect(anomalyBonusZone(5)).toBe(3)
    expect(anomalyCritZone(5)).toBe(3)
    expect(anomalyMasteryZone(400)).toBe(4)
    expect(anomalyMasteryZone(2000)).toBe(10)
  })

  it('紊乱的失衡等级区在 60 级为 1.45', () => {
    expect(disorderLevelZone(60)).toBeCloseTo(1.45, 6)
    expect(disorderLevelZone(1)).toBeCloseTo(1.0075, 6)
  })

  it('伤害等级区从 1 级 1.00 线性补到 60 级 2.00，向下保留 4 位', () => {
    expect(damageLevelZone(1)).toBe(1)
    expect(damageLevelZone(60)).toBe(2)
    expect(damageLevelZone(30)).toBeCloseTo(1.4915, 4)
  })

  it('紊乱倍率按剩余时间逐格累加', () => {
    expect(disorderRatio('burn', 10)).toBe(1450)
    expect(disorderRatio('shock', 10)).toBe(1700)
    expect(disorderRatio('corrosion', 9.9)).toBeCloseTo(1637.5, 6)
    expect(disorderRatio('frostIce', 10)).toBe(525)
    expect(disorderRatio('frostFlaming', 20)).toBe(2100)
    expect(disorderRatio('flinch', 0)).toBe(450)
  })

  it('穿透值在穿透率之后从有效防御里扣除', () => {
    const withFlat = defenseZone(BOSS_DEF, { penFlat: 100 })
    const withoutFlat = defenseZone(BOSS_DEF)
    expect(withFlat).toBeGreaterThan(withoutFlat)
    expect(defenseZone(BOSS_DEF, { penFlat: 5000 })).toBe(1)
  })

  it('乘区链按乘法合并', () => {
    expect(chainProduct([2, 1.5, 0.5])).toBeCloseTo(1.5, 10)
  })
})

describe('失衡恢复与冻结时长', () => {
  it('凶心疯汉叠加 +60% / −9% 后失衡持续 8.61 秒', () => {
    const speed = dazeRecoverySpeed(0.0769, [0.6, -0.09])
    expect(speed).toBeCloseTo(0.116119, 6)
    expect(dazeRecoverySeconds(0.0769, [0.6, -0.09])).toBeCloseTo(8.61, 2)
  })

  it('装甲哈提叠加 +100% / −13% 后失衡持续 6.42 秒', () => {
    expect(dazeRecoverySeconds(0.0833, [1, -0.13])).toBeCloseTo(6.42, 2)
  })

  it('冻结时长随冻结时间抵抗收缩到 3.5 / 2.7 / 2.4 秒', () => {
    expect(freezeSeconds(0)).toBeCloseTo(3.5, 6)
    expect(freezeSeconds(0.5)).toBeCloseTo(2.75, 6)
    expect(freezeSeconds(0.75)).toBeCloseTo(2.375, 6)
  })
})

describe('显示格式', () => {
  it('千分位分组', () => {
    expect(formatInt(1234567)).toBe('1,234,567')
    expect(formatInt(999)).toBe('999')
    expect(formatInt(Number.POSITIVE_INFINITY)).toBe('—')
  })

  it('系数与百分比去掉多余的尾零', () => {
    expect(formatFactor(1.5)).toBe('×1.5')
    expect(formatFactor(0.4545)).toBe('×0.45')
    expect(formatPercent(0.5222)).toBe('52.22%')
    expect(formatSignedPercent(0.1506)).toBe('+15.06%')
    expect(formatSignedPercent(-0.09)).toBe('−9%')
  })
})
