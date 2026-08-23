/* ============================================================
 * 本地静态数据客户端 — 数据由 scripts/build-data.mjs 生成：
 *   - 来源：git.mero.moe/dimbreath/ZenlessData（Dimbreath 解包数据）
 *   - 输出：public/data/（契约与旧 nanoka.cc 一致）
 * 运行时零外部依赖、零 CORS 问题。
 *
 *   manifest.json（根，版本元信息）
 *   {live,latest}/character.json / weapon.json / bangboo.json / equipment.json
 *   {live,latest}/zh/character/{id}.json …
 *
 * 双数据版本：live = 游戏在线版本数据；latest = 源站最新数据（含前瞻/测试服内容）。
 * 默认 live；切版本经 dataVersion（localStorage 持久化，URL ?ver= 参数优先，双向同步见
 * composables/useVersionSync）→ App 层以 key 重挂视图。
 *
 * P1 重构（DESIGN.md §6）：kind 式接口（list/detail）+ DataError 错误归一化
 * + 请求超时 + BASE_URL 派生 + lang 参数预留；旧的 api.characters() 等保持兼容。
 * ============================================================ */

import { ref, type Ref } from 'vue'
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

/** 数据类别（与 {version}/{file}.json 及 catalog.listFile 同键） */
export type DataKind = 'character' | 'weapon' | 'bangboo' | 'equipment'

/** 支持的语言（预留；当前站点只渲染 zh） */
export type Lang = 'zh' | 'en' | 'ja' | 'ko'

export const DEFAULT_LANG: Lang = 'zh'

/* ---------- 数据版本 ---------- */

/** 数据版本：live = 游戏在线版本数据；latest = 源站最新数据（含前瞻/测试服内容） */
export type DataVersion = 'live' | 'latest'

export const DEFAULT_DATA_VERSION: DataVersion = 'live'
const DATA_VERSION_KEY = 'zzz-wiki:data-version'

function loadVersion(): DataVersion {
  if (typeof localStorage !== 'undefined') {
    const v = localStorage.getItem(DATA_VERSION_KEY)
    if (v === 'live' || v === 'latest') return v
  }
  return DEFAULT_DATA_VERSION
}

/** 全局数据版本（模块级响应式，localStorage 持久化）。切换后由 App 层重挂视图刷新全部数据 */
export const dataVersion: Ref<DataVersion> = ref(loadVersion())

export function setDataVersion(v: DataVersion): void {
  if (v === dataVersion.value) return
  dataVersion.value = v
  try {
    localStorage.setItem(DATA_VERSION_KEY, v)
  } catch {
    // 隐私模式等不可写场景忽略（本次会话内仍生效）
  }
}

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
 * manifest 位于数据根；其余数据端点按当前数据版本分目录（/data/{version}/…）。 */
function toDataUrl(path: string): string {
  const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')
  const segmented = path === 'manifest.json' ? path : `${dataVersion.value}/${path}`
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
    latest?: string
    live?: string
    liveAvailable?: boolean
    [k: string]: unknown
  }
  generated?: string
  [k: string]: unknown
}

/** 双数据版本的版本号元信息（来自根 manifest.json，永不硬编码） */
export interface DataVersions {
  latest: string
  live: string
  /** live 目录是否独立数据（false = 构建期降级沿用 latest，前端不提供 live 档） */
  liveAvailable: boolean
  generated?: string
}

export function dataVersions(): Promise<DataVersions> {
  versionsPromise ??= getJson<Manifest>('manifest.json').then((m) => {
    const latest = m.zzz?.latest
    if (!latest) throw new DataError('manifest', 'manifest missing zzz.latest')
    return {
      latest,
      live: m.zzz?.live ?? latest,
      liveAvailable: m.zzz?.liveAvailable !== false,
      generated: m.generated,
    }
  })
  return versionsPromise
}

/** 兼容别名：latest 版本号（旧接口，新代码请用 dataVersions()） */
export function gameVersion(): Promise<string> {
  return dataVersions().then((v) => v.latest)
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