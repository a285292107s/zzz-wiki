/* ============================================================
 * io.ts — 下载（磁盘缓存）/ 并发 / 写盘（原 build-data.mjs 迁出）。
 * ============================================================ */

import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'

export const ROOT = path.resolve(import.meta.dirname ?? process.cwd(), '..', '..')
export const CACHE = path.join(ROOT, '.cache', 'hakushin-raw')
export const OUT = path.join(ROOT, 'public', 'data')

/** 版本输出目录：public/data/{ver}/（当前唯一产出 live = 正式服版本目录） */
export function outDir(ver: string): string {
  return path.join(OUT, ver)
}

export const BASE = 'https://static.nanoka.cc'
export const CONCURRENCY = 8 // 详情并发抓取上限

const FORCE = process.argv.includes('--force')

/** 单次下载的最多尝试次数（瞬时网络抖动自愈） */
const FETCH_ATTEMPTS = 2

export async function fetchJson(url: string, rel: string): Promise<unknown> {
  const dest = path.join(CACHE, rel)
  // manifest.json 是版本探测的实时信号：永不读缓存（每次构建都感知源站最新版本）；
  // 其余 URL（名录/详情）缓存路径含版本号，同版本重复构建秒级跳过、跨版本自动失效。
  const isManifest = rel === 'manifest.json'
  if (!isManifest && !FORCE && fs.existsSync(dest)) {
    try {
      return JSON.parse(await fsp.readFile(dest, 'utf8'))
    } catch {
      // 历史截断/半写导致的坏缓存：视为未命中重新下载（写盘前 JSON 已 parse 过，
      // 落盘即完整；此分支只为消化存量损坏与极端掉电场景），否则每次构建都重复报错
      process.stderr.write(`  ⚠ 缓存损坏，重新下载：${rel}\n`)
    }
  }
  let lastErr: unknown
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'zzz-wiki/build-data' } })
      if (!res.ok) throw new Error(`HTTP ${res.status} · ${url}`)
      const json = await res.json()
      await fsp.mkdir(path.dirname(dest), { recursive: true })
      await fsp.writeFile(dest, JSON.stringify(json))
      process.stdout.write(`  ↓ ${rel}\n`)
      return json
    } catch (e) {
      lastErr = e
      if (attempt < FETCH_ATTEMPTS) continue
    }
  }
  throw lastErr
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

export async function resetOut(vers: readonly string[]): Promise<void> {
  // 精确清理本管线产物：根 manifest + 根目录旧版名录/zh（历史单版本布局遗留，当前只产出 live 版本目录）
  // + 各版本名录/zh 详情；保留 img/（download:icons 的本地化图标，曾因整体 rm OUT
  // 被连带删除导致 272 个已跟踪图标消失）
  await fsp.rm(path.join(OUT, 'manifest.json'), { force: true })
  for (const f of ['character.json', 'weapon.json', 'bangboo.json', 'equipment.json']) {
    await fsp.rm(path.join(OUT, f), { force: true })
  }
  await fsp.rm(path.join(OUT, 'zh'), { recursive: true, force: true })
  for (const ver of vers) {
    await fsp.rm(outDir(ver), { recursive: true, force: true })
    await fsp.mkdir(outDir(ver), { recursive: true })
  }
}

export function dump(ver: string, name: string, dict: unknown): Promise<void> {
  return fsp.writeFile(path.join(outDir(ver), name), JSON.stringify(dict, null, 1))
}

export async function writeDetails(
  ver: string,
  dir: string,
  details: Record<string, unknown>,
): Promise<void> {
  const target = path.join(outDir(ver), dir)
  await fsp.mkdir(target, { recursive: true })
  await Promise.all(
    Object.entries(details).map(([id, d]) =>
      fsp.writeFile(path.join(target, `${id}.json`), JSON.stringify(d, null, 1)),
    ),
  )
}
