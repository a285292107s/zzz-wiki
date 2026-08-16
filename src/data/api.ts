/* ============================================================
   hakush.in data client.
   All upstream endpoints are table-driven so the exact URL
   scheme can be reviewed/adjusted in one place.
   ============================================================ */

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

/** Same-origin path the site itself is served from.
 *  In dev, Vite proxies /api → https://api.hakush.in
 *  In prod, vercel.json rewrites /api → https://api.hakush.in
 */
const BASE = '/api/zzz'

export const IMG_BASE = 'https://api.hakush.in/zzz/UI'

const ENDPOINTS = {
  characters: `${BASE}/data/character.json`,
  charDetail: (id: number | string) => `${BASE}/data/char/${id}.json`,
  wengines: `${BASE}/data/weapon.json`,
  wengineDetail: (id: number | string) => `${BASE}/data/weapon/${id}.json`,
  bangboos: `${BASE}/data/bangboo.json`,
  bangbooDetail: (id: number | string) => `${BASE}/data/bangboo/${id}.json`,
  disks: `${BASE}/data/diskdrive.json`,
  diskDetail: (id: number | string) => `${BASE}/data/diskdrive/${id}.json`,
} as const

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

/* ---------- list fetchers ----------
   hakush.in list payloads are dicts keyed by numeric id;
   we normalise to arrays, oldest-first per upstream order. */

function toArray<T>(payload: unknown): T[] {
  if (!payload || typeof payload !== 'object') return []
  return Object.values(payload) as T[]
}

export const api = {
  async characters(): Promise<CharacterListItem[]> {
    return toArray(await getJson<Record<string, CharacterListItem>>(ENDPOINTS.characters))
  },
  async character(id: number | string): Promise<CharacterDetail> {
    return getJson<CharacterDetail>(ENDPOINTS.charDetail(id))
  },
  async wengines(): Promise<WEngineListItem[]> {
    return toArray(await getJson<Record<string, WEngineListItem>>(ENDPOINTS.wengines))
  },
  async wengine(id: number | string): Promise<WEngineDetail> {
    return getJson<WEngineDetail>(ENDPOINTS.wengineDetail(id))
  },
  async bangboos(): Promise<BangbooListItem[]> {
    return toArray(await getJson<Record<string, BangbooListItem>>(ENDPOINTS.bangboos))
  },
  async bangboo(id: number | string): Promise<BangbooDetail> {
    return getJson<BangbooDetail>(ENDPOINTS.bangbooDetail(id))
  },
  async disks(): Promise<DiskDriveListItem[]> {
    return toArray(await getJson<Record<string, DiskDriveListItem>>(ENDPOINTS.disks))
  },
  async disk(id: number | string): Promise<DiskDriveDetail> {
    return getJson<DiskDriveDetail>(ENDPOINTS.diskDetail(id))
  },
}

/** Build an icon URL from an upstream raw path (e.g. "SpriteOutput/..."). */
export function iconUrl(path?: string): string | null {
  if (!path) return null
  if (/^https?:/.test(path)) return path
  return `${IMG_BASE}/${path}`
}