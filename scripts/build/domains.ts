/* ============================================================
 * domains.ts — 角色/音擎/邦布/驱动盘 名录+详情构建（原 build-data.mjs 迁出）。
 *
 * 多语言（2026-10，ADR-004 落地）：四类目都按 LANGS 各构建一套完整数据面
 * （名录 + 详情），彼此只在「本地化文本」上不同：
 *   - 名录：源站名录是**单份**（无语言段端点，`/zzz/{ver}/character.json` 对
 *     `/zzz/{ver}/{lang}/character.json` 全 404），英文描述的底本 + zh/en/ja/ko 四语名字段；
 *     故按语言重建名录 = 用**该语言的详情**注入本地化展示字段（阵营名、特殊属性名、
 *     音擎效果文本），源站那部分字段四语共享。
 *   - 详情：源站按语言端点提供，逐语言抓取 + 规整。
 *   - 术语：`<Term:N>` 的名称来自**该语言**的 noun.json（中文术语名不能出现在英文正文里）。
 * ============================================================ */

import fs from 'node:fs'
import path from 'node:path'

import {
  BASE,
  CONCURRENCY,
  fetchJson,
  mapConcurrent,
} from './io'
import { normalizeCharacterDetail, resolveTerms, toListDict, type TermNames } from './normalize'
import { LANGS, type Lang } from '../../src/domain/lang'

type Dict = Record<string, Record<string, unknown>>

/** 按语言的产物容器：语言码 → 该语言的那份数据 */
export type ByLang<T> = Record<Lang, T>

/** 单语言构建产物：名录（本地化注入后的行）+ 详情 */
export interface LangBuild {
  list: Dict
  details: Dict
}

/**
 * 阵营细分补充（构建期注入名录）：源数据 camp 为粗粒度阵营（如 16=罗斯凯利法），
 * 按官方设定把已知角色细分到下属组织（如 罗斯凯利法·弗林特工坊）。
 * 单一事实源 src/data/camp-supplement.json（口径=官方设定 / biligame 角色图鉴阵营属性）；
 * 上游若原生引入细分阵营，删除对应条目即回归源数据。图标映射见 src/data/filter-assets.json。
 *
 * **仅对中文生效**：这张表是中文策展的展示名，源站对细分阵营没有四语名。
 * 若把它套到非中文名录，会得到「英文条目里混中文阵营名」；
 * 若只借用其中的数字码再配源站粗粒度名，则多个细分码会同名（筛选下拉出现重复项）。
 * 故非中文一律走源站粗粒度阵营，各语言内部自洽。
 */
const CAMP_SUPPLEMENT: { camps: Record<string, string>; assign: Record<string, number> } = (() => {
  const p = path.resolve('src/data/camp-supplement.json')
  if (!fs.existsSync(p)) return { camps: {}, assign: {} }
  return JSON.parse(fs.readFileSync(p, 'utf8'))
})()

/** 把细分阵营码/展示名覆写到名录行（详情 camp 字段保持源数据不动）。 */
function applyCampSupplement(list: Dict): void {
  for (const [id, fine] of Object.entries(CAMP_SUPPLEMENT.assign)) {
    const name = CAMP_SUPPLEMENT.camps[String(fine)]
    if (name && list[id]) {
      list[id]['camp'] = fine
      list[id]['camp_name'] = name
    }
  }
}

/** 拉取整类详情；单个 id 失败仅告警并跳过（名录仍产出）。
 *  源站单文件瞬时故障不应让整次构建失败 → sync-data 判定失败则不提交、沿用旧数据。 */
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
 * 名词表原始全量（源站同域 JSON `{lang}/noun.json`）：
 * `{ 术语ID → { name, title, desc, skill } }`。
 * 全量下沉到 `/data/live/{lang}/noun.json`，供前端浮层展示 title/desc；解析名称不依赖此全量。
 */
export type NounEntry = { name?: string; title?: string; desc?: string; skill?: string }
export type NounDict = Record<string, NounEntry>

/** 拉取某语言的名词表全量（fetchJson 按版本+语言缓存，供 resolveTerms 名称 + 前端词典两用）。 */
export async function loadNoun(ver: string, lang: Lang): Promise<NounDict> {
  return (await fetchJson(
    `${BASE}/zzz/${ver}/${lang}/noun.json`,
    `${ver}/${lang}/noun.json`,
  )) as NounDict
}

/** 名词表全量 → 仅取 name（带括号，如 "[虚曜]"）供 resolveTerms 内嵌显示名。 */
export function nounToTerms(noun: NounDict): TermNames {
  const terms: TermNames = {}
  for (const [id, v] of Object.entries(noun)) terms[id] = v?.name ?? ''
  return terms
}

/** 逐语言的名词表全量（键=语言码） */
export async function loadNouns(ver: string): Promise<ByLang<NounDict>> {
  const entries = await Promise.all(LANGS.map(async (lang) => [lang, await loadNoun(ver, lang)] as const))
  return Object.fromEntries(entries) as ByLang<NounDict>
}

/**
 * 名录：源站单份名录 → 逐语言名录。
 * 每份都是**该语言**的展示面：把该语言详情里的阵营名与特殊属性名注入同名条目，
 * 再按该语言规整详情。源站名录本身携带的四语名字段原样保留（前端按当前语言取用）。
 */
export async function buildCharacters(
  ver: string,
  termsByLang: ByLang<TermNames>,
): Promise<ByLang<LangBuild>> {
  const listRaw = (await fetchJson(
    `${BASE}/zzz/${ver}/character.json`,
    `${ver}/character.json`,
  )) as Dict
  const ids = Object.keys(listRaw)
  const out = {} as ByLang<LangBuild>

  for (const lang of LANGS) {
    const detailsRaw = await fetchDetails(ver, `${lang}/character`, ids)
    const list = toListDict(listRaw)
    const details: Dict = {}

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]
      const raw = detailsRaw[i]
      if (!raw) continue

      // 名录注入特殊属性展示名：详情 special_element_type.name（如 星见雅→烈霜）
      const sp = raw['special_element_type'] as Record<string, unknown> | undefined
      const specialName = sp ? String(sp['name'] ?? '') : ''
      if (specialName && list[id]) list[id]['special_element'] = specialName

      // 名录注入阵营展示名：详情 camp 形如 {"1":"狡兔屋"}，取首个值
      const camp = raw['camp'] as Record<string, unknown> | undefined
      const campName = camp ? String(Object.values(camp)[0] ?? '') : ''
      if (campName && list[id]) list[id]['camp_name'] = campName

      details[id] = resolveTerms(
        normalizeCharacterDetail(raw),
        termsByLang[lang],
      ) as Record<string, unknown>
    }

    // 细分阵营补充：粗粒度 camp 覆写为官方下属组织（构建期增值，源数据缺失细分时的口径补齐）
    if (lang === 'zh') applyCampSupplement(list)

    out[lang] = { list, details }
  }
  return out
}

/**
 * 名片卡直接陈列的「音擎效果」精炼档：取基础档（1 阶）。数值随精炼变化，
 * 故 effect_refine 一并注入，由卡片标注档位（视图不硬编码）。
 */
const CARD_EFFECT_REFINE = 1

/**
 * 名录注入音擎卡片展示面（构建期增值，与详情同源同解析）：
 * - base_property / rand_property：主/副属性展示子集（中文名 + Lv.1 基础值 + 格式串），
 *   前端据此复用 sections.wEnginePropsAtLevel 呈现与详情页逐字一致的满级面板；
 * - effect_name / effect_desc / effect_refine：音擎效果名与正文（取基础精炼档）。
 * 取值来自已 resolveTerms 的详情，故名录里的术语标记与详情逐字节一致。
 */
export function injectWEngineCardDisplay(
  row: Record<string, unknown> | undefined,
  detail: Record<string, unknown>,
): void {
  if (!row) return
  for (const key of ['base_property', 'rand_property'] as const) {
    const s = detail[key] as Record<string, unknown> | undefined
    const name = typeof s?.['name'] === 'string' ? (s['name'] as string) : ''
    const value = typeof s?.['value'] === 'number' ? (s['value'] as number) : undefined
    if (!name || value == null) continue
    const format = typeof s?.['format'] === 'string' ? (s['format'] as string) : ''
    row[key] = format ? { name, value, format } : { name, value }
  }

  const talents = detail['talents'] as Record<string, Record<string, unknown>> | undefined
  if (!talents) return
  const keys = Object.keys(talents).filter((k) => Number.isFinite(Number(k)))
  if (!keys.length) return
  const refine = keys.includes(String(CARD_EFFECT_REFINE))
    ? CARD_EFFECT_REFINE
    : Math.min(...keys.map(Number))
  const picked = talents[String(refine)]
  const name = typeof picked?.['name'] === 'string' ? (picked['name'] as string) : ''
  const desc = typeof picked?.['desc'] === 'string' ? (picked['desc'] as string) : ''
  if (!name && !desc) return
  row['effect_name'] = name
  row['effect_desc'] = desc
  row['effect_refine'] = refine
}

export async function buildWeapons(
  ver: string,
  termsByLang: ByLang<TermNames>,
): Promise<ByLang<LangBuild>> {
  const listRaw = (await fetchJson(
    `${BASE}/zzz/${ver}/weapon.json`,
    `${ver}/weapon.json`,
  )) as Dict
  const ids = Object.keys(listRaw)
  const out = {} as ByLang<LangBuild>

  for (const lang of LANGS) {
    const detailsRaw = await fetchDetails(ver, `${lang}/weapon`, ids)
    const list = toListDict(listRaw)
    const details: Dict = {}

    for (let i = 0; i < ids.length; i++) {
      const raw = detailsRaw[i]
      if (!raw) continue
      // 与旧契约一致：weapon_type 值英文；其余字段透传
      const w = (raw.weapon_type ?? {}) as Record<string, unknown>
      const k = Object.keys(w)[0]
      // 注入满级主属性（名录 atk = Lv.60 基础攻击力），供详情页等级滑条插值
      const atkMax = (listRaw[ids[i]] as Record<string, unknown> | undefined)?.['atk']
      const withAtkMax = atkMax != null ? { ...raw, atk_max: atkMax } : raw
      const detail = (k
        ? resolveTerms({ ...withAtkMax, weapon_type: { [k]: specialEn(k, String(w[k])) } }, termsByLang[lang])
        : resolveTerms(withAtkMax, termsByLang[lang])) as Record<string, unknown>
      details[ids[i]] = detail
      injectWEngineCardDisplay(list[ids[i]], detail)
    }
    out[lang] = { list, details }
  }
  return out
}

export async function buildBangboos(
  ver: string,
  termsByLang: ByLang<TermNames>,
): Promise<ByLang<LangBuild>> {
  const listRaw = (await fetchJson(
    `${BASE}/zzz/${ver}/bangboo.json`,
    `${ver}/bangboo.json`,
  )) as Dict
  const ids = Object.keys(listRaw)
  const out = {} as ByLang<LangBuild>

  for (const lang of LANGS) {
    const detailsRaw = await fetchDetails(ver, `${lang}/bangboo`, ids)
    const list = toListDict(listRaw)
    const details: Dict = {}
    for (let i = 0; i < ids.length; i++) {
      const raw = detailsRaw[i]
      if (!raw) continue
      details[ids[i]] = resolveTerms(raw, termsByLang[lang]) as Record<string, unknown>
    }
    out[lang] = { list, details }
  }
  return out
}

export async function buildDiscs(
  ver: string,
  termsByLang: ByLang<TermNames>,
): Promise<ByLang<LangBuild>> {
  const listRaw = (await fetchJson(
    `${BASE}/zzz/${ver}/equipment.json`,
    `${ver}/equipment.json`,
  )) as Dict
  const ids = Object.keys(listRaw)
  const out = {} as ByLang<LangBuild>

  for (const lang of LANGS) {
    const detailsRaw = await fetchDetails(ver, `${lang}/equipment`, ids)
    const list = toListDict(listRaw)
    const details: Dict = {}
    for (let i = 0; i < ids.length; i++) {
      const raw = detailsRaw[i]
      if (!raw) continue
      details[ids[i]] = resolveTerms(raw, termsByLang[lang]) as Record<string, unknown>
    }
    out[lang] = { list, details }
  }
  return out
}

/** 职业码 → 英文（与 normalize.SPECIALTY_EN 同源；buildWeapons 用） */
import { SPECIALTY_EN } from './normalize'
function specialEn(key: string, fallback: string): string {
  return SPECIALTY_EN[key] ?? fallback
}
