/* ============================================================
   static.nanoka.cc data client — the hakush.in successor API.
   Endpoints confirmed from hakushin-py source:

     GET /manifest.json                       → { zzz: { latest, ... } }
     GET /zzz/{ver}/character.json            → { [id]: {...} }   (list, no lang)
     GET /zzz/{ver}/{lang}/character/{id}.json→ detail (lang: zh|en|ja|ko)
     … same for weapon / bangboo / equipment

   CORS is fully open (access-control-allow-origin: *).
   Icons: https://static.nanoka.cc/zzz/UI/{basename}.webp
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

const BASE = 'https://static.nanoka.cc'
export const UI_BASE = `${BASE}/zzz/UI`
export const LANG = 'zh' as const

interface Manifest {
  zzz?: {
    latest?: string
    live?: string
    available?: string[]
  }
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
  const ver = await gameVersion()
  const data = await getJson<Record<string, T>>(`${BASE}/zzz/${ver}/${file}.json`)
  return normalize<T>(data)
}

async function detailPath<T>(kind: string, id: number | string): Promise<T> {
  const ver = await gameVersion()
  return getJson<T>(`${BASE}/zzz/${ver}/${LANG}/${kind}/${id}.json`)
}

/** list payloads are { [numericId]: item } — return array with Id attached */
function normalize<T extends Record<string, unknown>>(dict: Record<string, T>): T[] {
  return Object.entries(dict).map(([k, v]) => ({ ...v, Id: Number(k) }))
}

/* ---------- icon url ---------- */

/** Icons arrive as bare names ("IconRole01") or full asset paths;
 *  only the basename (minus extension) is used. */
export function iconUrl(path?: string | null): string | null {
  if (!path) return null
  if (/^https?:/.test(path)) return path
  const basename = path.split('/').pop() ?? path
  const stem = basename.replace(/\.[^.]+$/, '')
  return `${UI_BASE}/${stem}.webp`
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

/** Localised display name helper — list items carry en/zh/ja/ko. */
export function locName(item: {
  en?: string
  zh?: string
  ja?: string
  ko?: string
  code?: string
  codename?: string
}): string {
  return item.zh || item.en || item.ja || item.ko || item.code || item.codename || '—'
}