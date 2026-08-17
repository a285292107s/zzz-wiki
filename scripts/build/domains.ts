/* ============================================================
 * domains.ts — 角色/音擎/邦布/驱动盘 名录+详情构建（原 build-data.mjs 迁出）。
 * ============================================================ */

import {
  BASE,
  CONCURRENCY,
  fetchJson,
  mapConcurrent,
} from './io'
import { normalizeCharacterDetail, toListDict } from './normalize'

type Dict = Record<string, Record<string, unknown>>

export async function buildCharacters(ver: string): Promise<{ list: Dict; details: Dict }> {
  const listRaw = (await fetchJson(
    `${BASE}/zzz/${ver}/character.json`,
    `${ver}/character.json`,
  )) as Dict
  const ids = Object.keys(listRaw)
  const detailsRaw = await mapConcurrent(ids, CONCURRENCY, (id) =>
    fetchJson(`${BASE}/zzz/${ver}/zh/character/${id}.json`, `${ver}/zh/character/${id}.json`),
  )

  const list = toListDict(listRaw)
  const details: Dict = {}
  for (let i = 0; i < ids.length; i++) {
    details[ids[i]] = normalizeCharacterDetail(detailsRaw[i] as Record<string, unknown>)
  }
  return { list, details }
}

export async function buildWeapons(ver: string): Promise<{ list: Dict; details: Dict }> {
  const listRaw = (await fetchJson(
    `${BASE}/zzz/${ver}/weapon.json`,
    `${ver}/weapon.json`,
  )) as Dict
  const ids = Object.keys(listRaw)
  const detailsRaw = await mapConcurrent(ids, CONCURRENCY, (id) =>
    fetchJson(`${BASE}/zzz/${ver}/zh/weapon/${id}.json`, `${ver}/zh/weapon/${id}.json`),
  )

  const list = toListDict(listRaw)
  const details: Dict = {}
  for (let i = 0; i < ids.length; i++) {
    const d = detailsRaw[i] as Record<string, unknown>
    // 与旧契约一致：weapon_type 值英文；其余字段透传
    const w = (d.weapon_type ?? {}) as Record<string, unknown>
    const k = Object.keys(w)[0]
    details[ids[i]] = k
      ? { ...d, weapon_type: { [k]: specialEn(k, String(w[k])) } }
      : d
  }
  return { list, details }
}

export async function buildBangboos(ver: string): Promise<{ list: Dict; details: Dict }> {
  const listRaw = (await fetchJson(
    `${BASE}/zzz/${ver}/bangboo.json`,
    `${ver}/bangboo.json`,
  )) as Dict
  const ids = Object.keys(listRaw)
  const detailsRaw = await mapConcurrent(ids, CONCURRENCY, (id) =>
    fetchJson(`${BASE}/zzz/${ver}/zh/bangboo/${id}.json`, `${ver}/zh/bangboo/${id}.json`),
  )

  const list = toListDict(listRaw)
  const details: Dict = {}
  for (let i = 0; i < ids.length; i++) {
    details[ids[i]] = detailsRaw[i] as Record<string, unknown>
  }
  return { list, details }
}

export async function buildDiscs(ver: string): Promise<{ list: Dict; details: Dict }> {
  const listRaw = (await fetchJson(
    `${BASE}/zzz/${ver}/equipment.json`,
    `${ver}/equipment.json`,
  )) as Dict
  const ids = Object.keys(listRaw)
  const detailsRaw = await mapConcurrent(ids, CONCURRENCY, (id) =>
    fetchJson(`${BASE}/zzz/${ver}/zh/equipment/${id}.json`, `${ver}/zh/equipment/${id}.json`),
  )

  const list = toListDict(listRaw)
  const details: Dict = {}
  for (let i = 0; i < ids.length; i++) {
    details[ids[i]] = detailsRaw[i] as Record<string, unknown>
  }
  return { list, details }
}

/** 职业码 → 英文（与 normalize.SPECIALTY_EN 同源；buildWeapons 用） */
import { SPECIALTY_EN } from './normalize'
function specialEn(key: string, fallback: string): string {
  return SPECIALTY_EN[key] ?? fallback
}
