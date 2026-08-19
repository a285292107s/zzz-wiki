/* ============================================================
 * io.ts — 下载（磁盘缓存）/ 并发 / 写盘（原 build-data.mjs 迁出）。
 * ============================================================ */

import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'

export const ROOT = path.resolve(import.meta.dirname ?? process.cwd(), '..', '..')
export const CACHE = path.join(ROOT, '.cache', 'hakushin-raw')
export const OUT = path.join(ROOT, 'public', 'data')

export const BASE = 'https://static.nanoka.cc'
export const CONCURRENCY = 8 // 详情并发抓取上限

const FORCE = process.argv.includes('--force')

export async function fetchJson(url: string, rel: string): Promise<unknown> {
  const dest = path.join(CACHE, rel)
  // manifest.json 是版本探测的实时信号：永不读缓存（每次构建都感知源站最新版本）；
  // 其余 URL（名录/详情）缓存路径含版本号，同版本重复构建秒级跳过、跨版本自动失效。
  const isManifest = rel === 'manifest.json'
  if (!isManifest && !FORCE && fs.existsSync(dest)) {
    return JSON.parse(await fsp.readFile(dest, 'utf8'))
  }
  const res = await fetch(url, { headers: { 'User-Agent': 'zzz-wiki/build-data' } })
  if (!res.ok) throw new Error(`HTTP ${res.status} · ${url}`)
  const json = await res.json()
  await fsp.mkdir(path.dirname(dest), { recursive: true })
  await fsp.writeFile(dest, JSON.stringify(json))
  process.stdout.write(`  ↓ ${rel}\n`)
  return json
}

export async function mapConcurrent<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return results
}

export async function resetOut(): Promise<void> {
  // 精确清理本管线产物（manifest/名录/zh 详情），保留 img/（download:icons 的本地化图标，
  // 曾因整体 rm OUT 被连带删除导致 272 个已跟踪图标消失）
  for (const f of ['manifest.json', 'character.json', 'weapon.json', 'bangboo.json', 'equipment.json']) {
    await fsp.rm(path.join(OUT, f), { force: true })
  }
  await fsp.rm(path.join(OUT, 'zh'), { recursive: true, force: true })
  const dirs = ['zh/character', 'zh/weapon', 'zh/bangboo', 'zh/equipment']
  await Promise.all(dirs.map((d) => fsp.mkdir(path.join(OUT, d), { recursive: true })))
}

export function dump(name: string, dict: unknown): Promise<void> {
  return fsp.writeFile(path.join(OUT, name), JSON.stringify(dict, null, 1))
}

export async function writeDetails(dir: string, details: Record<string, unknown>): Promise<void> {
  await Promise.all(
    Object.entries(details).map(([id, d]) =>
      fsp.writeFile(path.join(OUT, dir, `${id}.json`), JSON.stringify(d, null, 1)),
    ),
  )
}
