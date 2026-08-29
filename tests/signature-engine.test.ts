import { describe, expect, it } from 'vitest'
import {
  signatureEngineFor,
  ownerAgentForEngine,
  SIGNATURE_ENGINE_OVERRIDES,
  SIGNATURE_ENGINE_OWNER_OVERRIDES,
} from '../src/domain/signatureEngine'
import type { CharacterListItem, WEngineListItem } from '../src/data/types'

/** 最小武器名录条目：仅保留解析所需字段（Id / icon） */
function w(id: number, icon: string): WEngineListItem {
  return { Id: id, icon } as unknown as WEngineListItem
}

/** 最小代理人名录条目：仅保留解析所需字段（Id / zh） */
function a(id: number, zh: string): CharacterListItem {
  return { Id: id, zh } as unknown as CharacterListItem
}

const weapons: WEngineListItem[] = [
  w(13101, 'Weapon_A_1011'),          // 安比 A 级专属
  w(14109, 'Weapon_S_1091'),          // 星见雅 S 级专属
  w(14102, 'Weapon_S_1021'),          // 猫又 S 级专属
  w(14155, 'Weapon_S_Common_04'),     // 佩洛伊斯专属（命名约定外 → 覆盖表）
  w(14001, 'Weapon_S_Common_01'),     // 公共池 S（非专属）
  w(12001, 'Weapon_B_Common_01'),     // 公共池 B（非专属）
]

const agents: CharacterListItem[] = [
  a(1011, '安比'),
  a(1091, '雅'),
  a(1021, '猫又'),
  a(1551, '佩洛伊斯'),
]

describe('signatureEngineFor — 代理人 → 专属音擎解析', () => {
  it('按命名约定命中共识例（S 级：Weapon_S_<id>）', () => {
    expect(signatureEngineFor(1091, weapons)?.Id).toBe(14109)
    expect(signatureEngineFor(1021, weapons)?.Id).toBe(14102)
  })

  it('按命名约定命中 A 级（Weapon_A_<id>）并回带正确条目', () => {
    const hit = signatureEngineFor(1011, weapons)
    expect(hit?.Id).toBe(13101)
    expect(hit?.icon).toBe('Weapon_A_1011')
  })

  it('命名约定外特例（1551）经覆盖表命中，而非按 _1551 反查', () => {
    expect(SIGNATURE_ENGINE_OVERRIDES[1551]).toBe(14155)
    expect(signatureEngineFor(1551, weapons)?.Id).toBe(14155)
  })

  it('公共池通用音擎不会被误判为某代理人的专属（无 _<id> 后缀）', () => {
    // 不存在 _1091 结尾的 Weapon_S_1091 之外的匹配 → 命中唯一命名
    expect(signatureEngineFor(14001, weapons)).toBeNull()
  })

  it('agentId 为 null / undefined 时返回 null（不抛错）', () => {
    expect(signatureEngineFor(null, weapons)).toBeNull()
    expect(signatureEngineFor(undefined, weapons)).toBeNull()
  })

  it('无对应专属音擎的 id 返回 null', () => {
    expect(signatureEngineFor(9999, weapons)).toBeNull()
  })

  it('武器名录为空时返回 null', () => {
    expect(signatureEngineFor(1091, [])).toBeNull()
  })

  it('覆盖表命中的 id 不在名录时回退按命名约定（名录缺该件则 null）', () => {
    // 覆盖表指定 14155，但名录里无该条目且无 _1551 命名 → null
    expect(signatureEngineFor(1551, [w(999, 'Weapon_S_1011')])).toBeNull()
  })
})

describe('ownerAgentForEngine — 音擎 → 归属代理人反查（与 signatureEngineFor 互逆）', () => {
  it('按命名约定从 code_name 提取 agentId 并命中名录（S 级）', () => {
    const owner = ownerAgentForEngine(14109, 'Weapon_S_1091', agents)
    expect(owner?.Id).toBe(1091)
    expect(owner?.zh).toBe('雅')
  })

  it('按命名约定命中 A 级（Weapon_A_<id>）', () => {
    const owner = ownerAgentForEngine(13101, 'Weapon_A_1011', agents)
    expect(owner?.Id).toBe(1011)
    expect(owner?.zh).toBe('安比')
  })

  it('命名约定外特例（14155）经覆盖表转置命中归属代理人', () => {
    expect(SIGNATURE_ENGINE_OWNER_OVERRIDES[14155]).toBe(1551)
    const owner = ownerAgentForEngine(14155, 'Weapon_S_Common_04', agents)
    expect(owner?.Id).toBe(1551)
    expect(owner?.zh).toBe('佩洛伊斯')
  })

  it('公共池通用音擎（无 _<id> 后缀命名）返回 null', () => {
    expect(ownerAgentForEngine(14001, 'Weapon_S_Common_01', agents)).toBeNull()
  })

  it('命名约定命中的 agentId 不在名录时返回 null', () => {
    expect(ownerAgentForEngine(9999, 'Weapon_S_9999', agents)).toBeNull()
  })

  it('engineId 为 null 但 code_name 仍在时按命名约定命中；code_name 缺失则 null（不抛错）', () => {
    // engineId 缺失但 code_name 提供了命名 → 仍能反查（互逆逻辑独立于 engineId）
    expect(ownerAgentForEngine(null, 'Weapon_S_1091', agents)?.Id).toBe(1091)
    expect(ownerAgentForEngine(14109, null, agents)).toBeNull()
    expect(ownerAgentForEngine(14109, '', agents)).toBeNull()
    expect(ownerAgentForEngine(null, null, agents)).toBeNull()
  })

  it('代理人名录为空时返回 null', () => {
    expect(ownerAgentForEngine(14109, 'Weapon_S_1091', [])).toBeNull()
  })
})
