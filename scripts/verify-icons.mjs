/* ============================================================
 * verify-icons.mjs — 图标资源可用性校验
 *
 * 校准目标 = 前端运行时的真实消费（icons.ts 本地优先候选链）：
 *
 *   1) 本地差集（核心）：遍历 icon-inventory 产出的全部资产条目，
 *      逐一比对 public/data/img/{cat}/{file}.webp 是否存在。
 *      名录/技能/筛选图标本地缺失 → 失败退出（这类缺失不会报错，
 *      只会让前端静默落到 CDN 兜底、违反「运行时零外部请求」铁律）；
 *      hero / 皮肤(默认不本地化)属可容忍缺口 → 仅告警。
 *
 *   2) 远程审计（默认开启）：逐个 HEAD 探测 nanoka 素材 CDN，
 *      输出统计与失败清单。--local 可跳过（离线/纯本地校验）；
 *      网络异常按「无法确认」处理，以非零码 2 退出——
 *      绝不静默放行（旧行为把 -1 当通过，断网时谎报全部可达）。
 *
 * 任一失败存在时以非零码退出（可挂在 CI）：
 *   0 全部通过 · 1 存在缺失（本地必须项缺或两端皆缺）· 2 源站不可达无法确认
 * 「源站缺口但本地已兜住」仅告警——运行时零请求不受影响。
 *
 * 用法：node scripts/verify-icons.mjs            # 本地 + 远程
 *       node scripts/verify-icons.mjs --local    # 仅本地差集（离线可用）
 * 远程审计环境：需外网；有代理时设 NODE_USE_ENV_PROXY=1。
 * ============================================================ */

import fs from 'node:fs'
import { collectIcons, cdnUrl, localPath } from './build/icon-inventory.mjs'

const LOCAL_ONLY = process.argv.includes('--local')

/* ---------- 1) 本地差集 ---------- */

const entries = collectIcons()
const localMissing = [] // 必须本地存在却缺失（破坏零外部请求）
const localTolerated = [] // 可容忍缺口（hero 源站未上传 / 皮肤默认不落地）
for (const e of entries) {
  if (fs.existsSync(localPath(e))) continue
  if (e.optionalLocal) localTolerated.push(e)
  else localMissing.push(e)
}

const byCat = {}
for (const e of entries) byCat[e.cat] = (byCat[e.cat] ?? 0) + 1
console.log(`== 清单规模 ==`)
for (const [cat, n] of Object.entries(byCat)) console.log(`  ${cat}: ${n}`)

console.log(`\n== 本地 img 差集：${entries.length} 个资源，必须项缺失 ${localMissing.length}，可容忍缺口 ${localTolerated.length} ==`)
for (const m of localMissing) console.log(`  ✖ [${m.cat}] ${m.file}.webp 缺失 → 运行时会静默请求 CDN`)
for (const t of localTolerated) console.log(`  ⚠ [${t.cat}] ${t.file}.webp 缺失（可容忍：源站缺口/默认不本地化）`)

/* ---------- 2) 远程审计 ---------- */

let remoteMiss = []
let remoteDead = []
let remoteUnreachable = false

if (!LOCAL_ONLY) {
  const head = async (u) => {
    try {
      const r = await fetch(u, { method: 'HEAD', redirect: 'follow' })
      return r.status
    } catch {
      return -1 // 网络异常单独标记，绝不当作通过
    }
  }

  // 同一 CDN 地址只探测一次（别名映射可能使不同条目指向同一文件）；
  // 与 download-icons 同规格 8 并发，串行探测数百地址会超时
  const urls = [...new Set(entries.map(cdnUrl))]
  const statusCache = new Map()
  let next = 0
  async function headWorker() {
    while (next < urls.length) {
      const u = urls[next++]
      statusCache.set(u, await head(u))
    }
  }
  await Promise.all(Array.from({ length: Math.min(8, urls.length) }, headWorker))

  // 远端缺口按「本地是否已兜住」分级：
  //   本地存在 → 仅告警（运行时由本地文件兜住，零请求不受影响；但下次重建/换机下载会缺）
  //   本地缺失 → 已计入 localMissing，是真正的硬失败
  remoteMiss = entries.filter((e) => {
    const s = statusCache.get(cdnUrl(e))
    return s !== -1 && s !== 200
  })
  const missLocalAlive = remoteMiss.filter((e) => fs.existsSync(localPath(e)))
  remoteDead = remoteMiss.filter((e) => !fs.existsSync(localPath(e)))
  remoteUnreachable = entries.some((e) => statusCache.get(cdnUrl(e)) === -1)

  console.log(`\n== nanoka.cc /assets/zzz 远程审计：${urls.length} 个地址，源站缺口 ${remoteMiss.length}（本地已兜住 ${missLocalAlive.length} / 两端皆缺 ${remoteDead.length}）${remoteUnreachable ? '，另有个别地址网络不可达' : ''} ==`)
  for (const m of missLocalAlive) console.log(`  ⚠ [${m.cat}] ${m.remote} → 源站已缺失（本地现存可兜底；重建时将无法补下）`)
  for (const m of remoteDead) console.log(`  ✖ [${m.cat}] ${m.remote} → 源站缺失且本地无文件`)
}

/* ---------- 判定与退出 ---------- */

console.log('\n判定：本地必须项缺失 =', localMissing.length,
  '· 源站缺口 =', LOCAL_ONLY ? '(跳过)' : `${remoteMiss.length}（其中两端皆缺 ${remoteDead.length}）`,
  '· 源站不可达 =', LOCAL_ONLY ? '(跳过)' : remoteUnreachable)
if (remoteUnreachable) {
  console.error('源站不可达：远程审计无法确认，请检查网络或改用 --local 仅做本地校验')
  process.exit(2)
}
process.exit(localMissing.length || (!LOCAL_ONLY && remoteDead.length) ? 1 : 0)
