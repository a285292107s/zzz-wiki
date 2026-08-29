/* ============================================================
 * signatureEngine — 代理人 → 专属音擎（signature W-Engine）解析。
 *
 * 源站对专属音擎的命名约定：code_name / icon 为 `Weapon_[A|S]_<代理人id>`
 * （如 1091 星见雅 → Weapon_S_1091），其中字母随代理人稀有度（A=rank3 / S=rank4）。
 * 因此可从武器名录里的图标名以该约定反查某代理人的专属音擎。
 *
 * 例外：个别代理人的专属音擎未按上述约定命名（如 1551 佩洛伊斯 → Weapon_S_Common_04，
 * 一件「公共池 S 级」却点名佩洛伊斯的特例）。在此以覆盖表显式登记。
 *
 * 纯函数模块：不依赖 Vue / api（DESIGN.md §5.2），可单测。
 * ============================================================ */

import type { CharacterListItem, WEngineListItem } from '@/data/types'

/**
 * 命名约定外特例：代理人 id → 专属音擎 id。
 * 1551 佩洛伊斯（Pyrois）：专属音擎为「日冕遗蜕」（Weapon_S_Common_04，id 14155），
 * 未走 `Weapon_S_1551` 命名（见 DATA_GUIDE §1 角色/音擎口径）。命中需同时存在于武器名录。
 */
export const SIGNATURE_ENGINE_OVERRIDES: Record<number, number> = {
  1551: 14155,
}

/** 专属音擎 id → 归属代理人 id（覆盖表转置，供音擎详情反向反查） */
export const SIGNATURE_ENGINE_OWNER_OVERRIDES: Record<number, number> = Object.fromEntries(
  Object.entries(SIGNATURE_ENGINE_OVERRIDES).map(([agentId, engineId]) => [engineId, Number(agentId)]),
)

/**
 * 由武器名录解析某代理人的专属音擎；无则返回 null。
 * @param agentId 代理人 id（详情 detail.id）
 * @param weapons 武器名录条目（WEngineListItem[]，来自 /data/live/weapon.json）
 */
export function signatureEngineFor(
  agentId: number | null | undefined,
  weapons: WEngineListItem[],
): WEngineListItem | null {
  if (agentId == null) return null

  // 1) 覆盖表优先（命名约定外的特例）
  const overrideId = SIGNATURE_ENGINE_OVERRIDES[agentId]
  if (overrideId != null) {
    const hit = weapons.find((w) => w.Id === overrideId)
    if (hit) return hit
  }

  // 2) 命名约定：Weapon_[A|S]_<agentId>
  const re = new RegExp(`^Weapon_[AS]_${agentId}$`)
  return weapons.find((w) => re.test(w.icon ?? '')) ?? null
}

/**
 * 由武器名录条目反查归属该音擎的代理人（拥有者/签名匹配者）；无则返回 null。
 * 与 signatureEngineFor 互逆（命名约定 + 覆盖表转置），供音擎详情 head 反向交叉引用。
 * @param weaponId 音擎 id（详情 id）
 * @param engineCodeName 音擎 code_name（详情的 Weapon_[A|S]_<agentId> 命名）
 * @param agents 代理人名录条目（CharacterListItem[]，来自 /data/live/character.json）
 */
export function ownerAgentForEngine(
  engineId: number | null | undefined,
  engineCodeName: string | null | undefined,
  agents: CharacterListItem[],
): CharacterListItem | null {
  // 1) 覆盖表转置（命名约定外的特例）
  const overrideAgentId = engineId != null ? SIGNATURE_ENGINE_OWNER_OVERRIDES[engineId] : undefined
  if (overrideAgentId != null) {
    const hit = agents.find((a) => a.Id === overrideAgentId)
    if (hit) return hit
  }

  // 2) 命名约定：Weapon_[A|S]_<agentId> → 提取 agentId，再在名录中命中
  const m = /^Weapon_[AS]_(\d+)$/.exec(engineCodeName ?? '')
  if (!m) return null
  const agentId = Number(m[1])
  return agents.find((a) => a.Id === agentId) ?? null
}
