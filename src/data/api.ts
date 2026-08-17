/* ============================================================
 * 本地静态数据客户端 — 数据由 scripts/build-data.mjs 生成：
 *   - 来源：git.mero.moe/dimbreath/ZenlessData（Dimbreath 解包数据）
 *   - 输出：public/data/（契约与旧 nanoka.cc 一致）
 * 运行时零外部依赖、零 CORS 问题。
 *
 *   manifest.json / character.json / weapon.json / bangboo.json / equipment.json
 *   zh/character/{id}.json
 *
 * P1 重构（DESIGN.md §6）：kind 式接口（list/detail）+ DataError 错误归一化
 * + 请求超时 + BASE_URL 派生 + lang 参数预留；旧的 api.characters() 等保持兼容。
 * ============================================================ */

import type {
  BangbooDetail,
  BangbooListItem,
  CharacterDetail,
  CharacterListItem,
  DiskDriveDetail,
  DiskDriveListItem,
  WEngineDetail,
  WEngineListItem,
} from './types'

/* ---------- 领域类型 ---------- */

/** 数据类别（与 public/data/{file}.json 及 catalog.listFile 同键） */
export type DataKind = 'character' | 'weapon' | 'bangboo' | 'equipment'

/** 支持的语言（预留；当前站点只渲染 zh） */
export type Lang = 'zh' | 'en' | 'ja' | 'ko'

export const DEFAULT_LANG: Lang = 'zh'

/* ---------- 错误归一化 ---------- */

export type DataErrorKind = 'http' | 'network' | 'manifest'

export class DataError extends Error {
  readonly kind: DataErrorKind
  readonly status?: number
  readonly url?: string

  constructor(
    kind: DataErrorKind,
    message: string,
    opts: { status?: number; url?: string; cause?: unknown } = {},
  ) {
    super(message)
    this.name = 'DataError'
    this.kind = kind
    this.status = opts.status
    this.url = opts.url
    if (opts.cause !== undefined) (this as { cause?: unknown }).cause = opts.cause
  }
}

/* ---------- 请求层 ---------- */

const REQUEST_TIMEOUT_MS = 10_000

/** 数据根路径：尊重 BASE_URL（子路径部署时不再 404）。 */
function toDataUrl(path: string): string {
  const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')
  return `${base}/data/${path}`
}

const cache = new Map<string, Promise<unknown>>()

async function getJson<T>(path: string): Promise<T> {
  const url = toDataUrl(path)
  const hit = cache.get(url)
  if (hit) return hit as Promise<T>

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
  const p = fetch(url, { signal: ctrl.signal })
    .then((r) => {
      if (!r.ok) {
        throw new DataError('http', `HTTP ${r.status} · ${url}`, { status: r.status, url })
      }
      return r.json() as Promise<T>
    })
    .catch((e) => {
      cache.delete(url)
      if (e instanceof DataError) throw e
      throw new DataError(
        'network',
        e instanceof Error ? e.message : String(e),
        { url, cause: e },
      )
    })
    .finally(() => clearTimeout(timer))
  cache.set(url, p)
  return p
}

/* ---------- 版本 ---------- */

let versionPromise: Promise<string> | null = null

interface Manifest {
  zzz?: {
    latest?: string
    [k: string]: unknown
  }
  generated?: string
  [k: string]: unknown
}

export function gameVersion(): Promise<string> {
  versionPromise ??= getJson<Manifest>('manifest.json').then((m) => {
    const v = m.zzz?.latest
    if (!v) throw new DataError('manifest', 'manifest missing zzz.latest')
    return v
  })
  return versionPromise
}

/* ---------- list / detail ---------- */

/** list payloads are { [numericId]: item } — return array with Id attached */
function normalize<T extends Record<string, unknown>>(dict: Record<string, T>): T[] {
  return Object.entries(dict).map(([k, v]) => ({ ...v, Id: Number(k) }))
}

async function listRaw<T extends Record<string, unknown>>(kind: DataKind): Promise<T[]> {
  await gameVersion() // 存在性检查：本地 manifest 缺失时报错更早
  const data = await getJson<Record<string, T>>(`${kind}.json`)
  return normalize<T>(data)
}

async function detailRaw<T>(kind: DataKind, id: number | string, lang: Lang): Promise<T> {
  await gameVersion()
  return getJson<T>(`${lang}/${kind}/${id}.json`)
}

/* ---------- 公开接口 ---------- */

export interface Api {
  /** 名录（按类别） */
  list<T extends Record<string, unknown>>(kind: DataKind): Promise<T[]>
  /** 详情（按类别 + id + 语言，默认 zh） */
  detail<T>(kind: DataKind, id: number | string, lang?: Lang): Promise<T>

  /* ---- 兼容接口（新代码请用 list / detail） ---- */
  characters(): Promise<CharacterListItem[]>
  character(id: number | string): Promise<CharacterDetail>
  wengines(): Promise<WEngineListItem[]>
  wengine(id: number | string): Promise<WEngineDetail>
  bangboos(): Promise<BangbooListItem[]>
  bangboo(id: number | string): Promise<BangbooDetail>
  disks(): Promise<DiskDriveListItem[]>
  disk(id: number | string): Promise<DiskDriveDetail>
}

export const api: Api = {
  list: listRaw,
  detail: (kind, id, lang = DEFAULT_LANG) => detailRaw(kind, id, lang),

  /* ---- 兼容接口（新代码请用 list / detail） ---- */
  characters: () => listRaw<CharacterListItem>('character'),
  character: (id) => detailRaw<CharacterDetail>('character', id, DEFAULT_LANG),
  wengines: () => listRaw<WEngineListItem>('weapon'),
  wengine: (id) => detailRaw<WEngineDetail>('weapon', id, DEFAULT_LANG),
  bangboos: () => listRaw<BangbooListItem>('bangboo'),
  bangboo: (id) => detailRaw<BangbooDetail>('bangboo', id, DEFAULT_LANG),
  disks: () => listRaw<DiskDriveListItem>('equipment'),
  disk: (id) => detailRaw<DiskDriveDetail>('equipment', id, DEFAULT_LANG),
}

/** Localised display name — 唯一实现在 utils/names.ts（DESIGN.md P0）。 */
export { locName } from '@/utils/names'