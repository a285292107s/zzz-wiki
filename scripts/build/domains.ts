/* ============================================================
 * domains.ts — 角色/音擎/邦布/驱动盘 名录+详情构建（原 build-data.mjs 迁出）。
 * ============================================================ */

import {
  BASE,
  CONCURRENCY,
  fetchJson,
  mapConcurrent,
} from './io'
import { normalizeCharacterDetail, resolveTerms, toListDict, type TermNames } from './normalize'

type Dict = Record<string, Record<string, unknown>>

/** 拉取整类详情；单个 id 失败仅告警并跳过（名录仍产出）。
 *  源站单文件瞬时故障不应让整次构建失败 → ci-data 全量回退旧数据。 */
async function fetchDetails(
  ver: string,
  dir: string,
  ids: readonly string[],
): Promise<Array<Record<string, unknown> | undefined>> {
  const skipped: Array<{ id: string; msg: string }> = []
  const raw = await mapConcurrent(ids, CONCURRENCY, async (id) => {
    try {
      return (await fetchJson(`${BASE}/zzz/${ver}/${dir}/${id}.json`, `${ver}/${dir}/${id}.json`)) as Record<string, unknown>
    } catch (e) {
      skipped.push({ id, msg: e instanceof Error ? e.message : String(e) })
      return undefined
    }
  })
  if (skipped.length) {
    console.warn(`⚠ [${dir}] ${skipped.length} 个详情拉取失败，已跳过（名录仍产出，请人工复核）：`)
    for (const s of skipped) console.warn(`  ✖ id=${s.id} → ${s.msg}`)
  }
  return raw
}

/**
 * 名词表原始全量（源站同域 JSON zh/noun.json）：
 * `{ 术语ID → { name, title, desc, skill } }`。
 * 全量下沉到 /data/{ver}/noun.json，供前端浮层展示 title/desc；解析名称不依赖此全量。
 */
export type NounEntry = { name?: string; title?: string; desc?: string; skill?: string }
export type NounDict = Record<string, NounEntry>

/** 拉取名词表全量（fetchJson 按版本缓存，供 resolveTerms 名称 + 前端词典两用）。 */
export async function loadNoun(ver: string): Promise<NounDict> {
  return (await fetchJson(
    `${BASE}/zzz/${ver}/zh/noun.json`,
    `${ver}/zh/noun.json`,
  )) as NounDict
}

/** 名词表全量 → 仅取 name（带括号，如 "[虚曜]"）供 resolveTerms 内嵌显示名。 */
export function nounToTerms(noun: NounDict): TermNames {
  const terms: TermNames = {}
  for (const [id, v] of Object.entries(noun)) terms[id] = v?.name ?? ''
  return terms
}

/**
 * 名词表：加载全量并按 name 归纳为 TermNames（历史签名，index 用 loadNoun + nounToTerms）。
 * 仅取 name（如 "[虚曜]"），与数据内既有 <color=#FFFFFF>[虚曜]</color> 富文本形态一致。
 */
export async function loadTerms(ver: string): Promise<TermNames> {
  const dict = await loadNoun(ver)
  return nounToTerms(dict)
}

export async function buildCharacters(ver: string, terms: TermNames): Promise<{ list: Dict; details: Dict }> {
  const listRaw = (await fetchJson(
    `${BASE}/zzz/${ver}/character.json`,
    `${ver}/character.json`,
  )) as Dict
  const ids = Object.keys(listRaw)
  const detailsRaw = await fetchDetails(ver, 'zh/character', ids)

  const list = toListDict(listRaw)
  // 名录注入特殊属性展示名：详情 special_element_type.name（如 星见雅→烈霜）
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]
    const raw = detailsRaw[i] as Record<string, unknown> | undefined
    const sp = raw?.['special_element_type'] as
      | Record<string, unknown>
      | undefined
    const name = sp ? String(sp['name'] ?? '') : ''
    if (name && list[id]) list[id]['special_element'] = name

    // 名录注入阵营展示名：详情 camp 形如 {"1":"狡兔屋"}，取首个值
    const camp = raw?.['camp'] as Record<string, unknown> | undefined
    const campName = camp ? String(Object.values(camp)[0] ?? '') : ''
    if (campName && list[id]) list[id]['camp_name'] = campName
  }

  const details: Dict = {}
  for (let i = 0; i < ids.length; i++) {
    if (!detailsRaw[i]) continue
    details[ids[i]] = resolveTerms(
      normalizeCharacterDetail(detailsRaw[i] as Record<string, unknown>),
      terms,
    ) as Record<string, unknown>
  }
  return { list, details }
}

export async function buildWeapons(ver: string, terms: TermNames): Promise<{ list: Dict; details: Dict }> {
  const listRaw = (await fetchJson(
    `${BASE}/zzz/${ver}/weapon.json`,
    `${ver}/weapon.json`,
  )) as Dict
  const ids = Object.keys(listRaw)
  const detailsRaw = await fetchDetails(ver, 'zh/weapon', ids)

  const list = toListDict(listRaw)
  const details: Dict = {}
  for (let i = 0; i < ids.length; i++) {
    if (!detailsRaw[i]) continue
    const d = detailsRaw[i] as Record<string, unknown>
    // 与旧契约一致：weapon_type 值英文；其余字段透传
    const w = (d.weapon_type ?? {}) as Record<string, unknown>
    const k = Object.keys(w)[0]
    // 注入满级主属性（名录 atk = Lv.60 基础攻击力），供详情页等级滑条插值
    const atkMax = (listRaw[ids[i]] as Record<string, unknown> | undefined)?.['atk']
    const withAtkMax = atkMax != null ? { ...d, atk_max: atkMax } : d
    details[ids[i]] = (k
      ? resolveTerms({ ...withAtkMax, weapon_type: { [k]: specialEn(k, String(w[k])) } }, terms)
      : resolveTerms(withAtkMax, terms)) as Record<string, unknown>
  }
  return { list, details }
}

export async function buildBangboos(ver: string, terms: TermNames): Promise<{ list: Dict; details: Dict }> {
  const listRaw = (await fetchJson(
    `${BASE}/zzz/${ver}/bangboo.json`,
    `${ver}/bangboo.json`,
  )) as Dict
  const ids = Object.keys(listRaw)
  const detailsRaw = await fetchDetails(ver, 'zh/bangboo', ids)

  const list = toListDict(listRaw)
  const details: Dict = {}
  for (let i = 0; i < ids.length; i++) {
    if (!detailsRaw[i]) continue
    details[ids[i]] = resolveTerms(detailsRaw[i] as Record<string, unknown>, terms) as Record<string, unknown>
  }
  return { list, details }
}

export async function buildDiscs(ver: string, terms: TermNames): Promise<{ list: Dict; details: Dict }> {
  const listRaw = (await fetchJson(
    `${BASE}/zzz/${ver}/equipment.json`,
    `${ver}/equipment.json`,
  )) as Dict
  const ids = Object.keys(listRaw)
  const detailsRaw = await fetchDetails(ver, 'zh/equipment', ids)

  const list = toListDict(listRaw)
  const details: Dict = {}
  for (let i = 0; i < ids.length; i++) {
    if (!detailsRaw[i]) continue
    details[ids[i]] = resolveTerms(detailsRaw[i] as Record<string, unknown>, terms) as Record<string, unknown>
  }
  return { list, details }
}

/** 职业码 → 英文（与 normalize.SPECIALTY_EN 同源；buildWeapons 用） */
import { SPECIALTY_EN } from './normalize'
function specialEn(key: string, fallback: string): string {
  return SPECIALTY_EN[key] ?? fallback
}
