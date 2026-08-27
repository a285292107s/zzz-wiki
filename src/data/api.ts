/* ============================================================
 * 本地静态数据客户端 — 数据由 scripts/build 管线生成：
 *   - 来源：static.nanoka.cc（hakushin raw / zzz.nanoka.cc）
 *   - 输出：public/data/（契约见 DATA_GUIDE.md §3）
 * 运行时零外部依赖、零 CORS 问题。
 *
 *   manifest.json（根，版本元信息）
 *   live/character.json / weapon.json / bangboo.json / equipment.json / noun.json
 *   live/zh/character/{id}.json …
 *
 * 单数据版本（合规约定 2026-08）：站点只展示**正式服（live）**数据，
 * 数据版本号从根 manifest.json 的 zzz.live 动态取，永不硬编码。
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

/* ---------- 合规清理 ---------- */

// 2026-08 移除 live/latest 双版本切换后，旧 localStorage 偏好键已无代码读取，
// 但用户浏览器可能残留 'latest'（测试服）档位。载入时清除，避免后续误读。
const STALE_VERSION_KEY = 'zzz-wiki:data-version'
try {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(STALE_VERSION_KEY)
} catch {
  // 隐私模式等不可写场景忽略
}

/* ---------- 领域类型 ---------- */

import { CATALOG } from '@/domain/catalog'

/** 数据类别——由 catalog 名录文件名派生（单一事实源；catalog 不反向依赖本模块，无环）。
 *  新增类别先在 domain/catalog.ts 登记，此处自动跟随。 */
export type DataKind = (typeof CATALOG)[number]['listFile']

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

/** 数据根路径：尊重 BASE_URL（子路径部署时不再 404）。
 * manifest 位于数据根；名录/详情位于 /data/live/ 之下（单版本正式服目录，见 DATA_GUIDE §3）。 */
function toDataUrl(path: string): string {
  const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')
  const segmented = path === 'manifest.json' ? path : `live/${path}`
  return `${base}/data/${segmented}`
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
      // Vite dev 等环境对缺失 JSON 回退为 SPA 的 index.html（200+HTML）。
      // 数据端点不会返回 HTML，命中即视为“不存在”，让 404 语义在 dev/prod 一致。
      const ctype = typeof r.headers?.get === 'function' ? r.headers.get('content-type') ?? '' : ''
      if (ctype.includes('text/html')) {
        throw new DataError('http', `HTTP 404 · ${url}`, { status: 404, url })
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

let versionsPromise: Promise<DataVersions> | null = null

interface Manifest {
  zzz?: {
    live?: string
    source?: string
    [k: string]: unknown
  }
  generated?: string
  [k: string]: unknown
}

/** 数据版本元信息（来自根 manifest.json，永不硬编码）：
 * live = 游戏正式服数据版本号（构建期从源站 zzz.live 落地）。 */
export interface DataVersions {
  live: string
  generated?: string
}

export function dataVersions(): Promise<DataVersions> {
  versionsPromise ??= getJson<Manifest>('manifest.json').then((m) => {
    const live = m.zzz?.live
    if (!live) throw new DataError('manifest', 'manifest missing zzz.live')
    return {
      live,
      generated: m.generated,
    }
  })
  return versionsPromise
}

/** 兼容别名：正式服版本号（旧接口，新代码请用 dataVersions()） */
export function gameVersion(): Promise<string> {
  return dataVersions().then((v) => v.live)
}

/* ---------- list / detail ---------- */

/** list payloads are { [numericId]: item } — return array with Id attached */
function normalize<T extends Record<string, unknown>>(dict: Record<string, T>): T[] {
  return Object.entries(dict).map(([k, v]) => ({ ...v, Id: Number(k) }))
}

async function listRaw<T extends Record<string, unknown>>(kind: DataKind): Promise<T[]> {
  await dataVersions() // 存在性检查：本地 manifest 缺失时报错更早
  const data = await getJson<Record<string, T>>(`${kind}.json`)
  return normalize<T>(data)
}

async function detailRaw<T>(kind: DataKind, id: number | string, lang: Lang): Promise<T> {
  await dataVersions()
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
// locName 别名已移除；请直接使用 pickName。