/* ============================================================
 * 术语词典 — 运行时零外部请求，读本地 /data/{version}/noun.json。
 * 构建期把源站名词表全量下沉到 public/data/{version}/noun.json，
 * 前端浮层据此展示术语 title / desc（desc 仍含 <Term:N> 时经 richDesc 递归渲染）。
 * 按 dataVersion 取值做 URL，缓存按 URL 键控；切版本自然命中新词典。
 * ============================================================ */

import { dataVersion } from './api'

export interface NounEntry {
  name?: string
  title?: string
  desc?: string
  skill?: string
}

const cache = new Map<string, Promise<Record<string, NounEntry>>>()

/** 当前数据版本的术语词典 URL（尊重 BASE_URL 子路径部署） */
function toUrl(): string {
  const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')
  return `${base}/data/${dataVersion.value}/noun.json`
}

/** 拉取（带缓存）当前版本术语词典。词典缺失/加载失败返回空表，浮层安静地不显示。 */
export function nounDict(): Promise<Record<string, NounEntry>> {
  const url = toUrl()
  let p = cache.get(url)
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({})) as Promise<Record<string, NounEntry>>
    cache.set(url, p)
  }
  return p
}