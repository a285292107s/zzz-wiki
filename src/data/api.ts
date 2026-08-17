/* ============================================================
 * 本地静态数据客户端 — 数据由 scripts/build-data.mjs 生成：
 *   - 来源：git.mero.moe/dimbreath/ZenlessData（Dimbreath 解包数据）
 *   - 输出：public/data/（契约与旧 nanoka.cc 一致）
 * 运行时零外部依赖、零 CORS 问题。
 *
 *   manifest.json / character.json / weapon.json / bangboo.json / equipment.json
 *   zh/character/{id}.json
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

const BASE = '/data'
export const LANG = 'zh' as const

interface Manifest {
  zzz?: {
    latest?: string
    [k: string]: unknown
  }
  generated?: string
  [k: string]: unknown
}

/* ---------- tiny cache ---------- */

const cache = new Map<string, Promise<unknown>>()

function getJson<T>(url: string): Promise<T> {
  const hit = cache.get(url)
  if (hit) return hit as Promise<T>
  const p = fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} · ${url}`)
      return r.json() as Promise<T>
    })
    .catch((e) => {
      cache.delete(url)
      throw e
    })
  cache.set(url, p)
  return p
}

/* ---------- version ---------- */

let versionPromise: Promise<string> | null = null

export function gameVersion(): Promise<string> {
  versionPromise ??= getJson<Manifest>(`${BASE}/manifest.json`).then((m) => {
    const v = m.zzz?.latest
    if (!v) throw new Error('manifest missing zzz.latest')
    return v
  })
  return versionPromise
}

async function listPath<T extends Record<string, unknown>>(file: string): Promise<T[]> {
  await gameVersion() // 存在性检查：本地 manifest 缺失时报错更早
  const data = await getJson<Record<string, T>>(`${BASE}/${file}.json`)
  return normalize<T>(data)
}

async function detailPath<T>(kind: string, id: number | string): Promise<T> {
  await gameVersion()
  return getJson<T>(`${BASE}/${LANG}/${kind}/${id}.json`)
}

/** list payloads are { [numericId]: item } — return array with Id attached */
function normalize<T extends Record<string, unknown>>(dict: Record<string, T>): T[] {
  return Object.entries(dict).map(([k, v]) => ({ ...v, Id: Number(k) }))
}

/* ---------- fetchers ---------- */

export const api = {
  async characters(): Promise<CharacterListItem[]> {
    return listPath<CharacterListItem>('character')
  },
  character(id: number | string): Promise<CharacterDetail> {
    return detailPath<CharacterDetail>('character', id)
  },
  async wengines(): Promise<WEngineListItem[]> {
    return listPath<WEngineListItem>('weapon')
  },
  wengine(id: number | string): Promise<WEngineDetail> {
    return detailPath<WEngineDetail>('weapon', id)
  },
  async bangboos(): Promise<BangbooListItem[]> {
    return listPath<BangbooListItem>('bangboo')
  },
  bangboo(id: number | string): Promise<BangbooDetail> {
    return detailPath<BangbooDetail>('bangboo', id)
  },
  async disks(): Promise<DiskDriveListItem[]> {
    return listPath<DiskDriveListItem>('equipment')
  },
  disk(id: number | string): Promise<DiskDriveDetail> {
    return detailPath<DiskDriveDetail>('equipment', id)
  },
}

/** Localised display name — 唯一实现在 utils/names.ts（DESIGN.md P0）。 */
export { locName } from '@/utils/names'
