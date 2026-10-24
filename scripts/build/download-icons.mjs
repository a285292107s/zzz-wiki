/* ============================================================
 * download-icons.mjs — 图标本地化（Q4b）
 *
 * 把前端运行时需要的图标从素材 CDN（nanoka.cc）下载到
 * public/data/img/{category}/{base}.webp，使站点「运行时零外部请求」。
 *
 * 资产清单推导统一由 icon-inventory.mjs 产出（与 verify-icons.mjs 共用，
 * 曾两处各写一份收集逻辑存在漂移风险），覆盖：
 *   - character / weapon / bangboo / disc 名录 icon（对象 key = 名录 id）
 *   - skill 键位图标（Icon_Normal 等）+ 富文本 <IconMap:Icon_XXX>
 *   - filter 筛选图标（属性/职业/阵营）
 *   - hero 头图（Mindscape_{id}_2.webp 及双形态角色性别变体；
 *     源站缺口仅告警——前端底色兜底不破图）
 *   - 角色皮肤立绘（skin）——与名录头像同落 img/character/；默认本地化（skins 已在库时跳过），
 *     SKIN_LOCAL=0 可关闭
 *   - 潜能影像觉醒立绘（awaken）——解包独有（源站无此资产），不在下载队列，见 import-assets.mjs
 *
 * 幂等：已存在的本地文件跳过；可重复运行增补缺失项。
 *
 * 导出 runDownloadIcons()：被 sync-data.ts 进程内调用（不经 pnpm exec/子进程，
 * 避免管道与漂移，同 verify-data.ts 的处理）；返回统计摘要供上层判定。
 *
 * 用法（CLI）：
 *   node scripts/build/download-icons.mjs               # 严格：缺口非零退出
 *   node scripts/build/download-icons.mjs --soft          # 缺口仅告警不阻断
 *   node scripts/build/download-icons.mjs --dry           # 只打印差集不下载
 * 环境：需外网；有代理时设 NODE_USE_ENV_PROXY=1。
 * ============================================================ */

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { SKIN_LOCAL, collectIcons, cdnUrl, localPath } from './icon-inventory.mjs'

const CONCURRENCY = 8

async function download(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, buf)
}

async function worker(queue, onOk, onFail) {
  while (queue.length) {
    const { url, dest, cat } = queue.shift()
    try {
      await download(url, dest)
      onOk(dest)
    } catch (e) {
      onFail(url, e.message, cat)
    }
  }
}

/**
 * 执行图标同步（幂等补差）。皮肤默认也补（SKIN_LOCAL=0 才跳过）。
 * @param {{soft?:boolean, dry?:boolean}} [opts]
 *   soft 缺口仅告警不阻断（CI / 部署用）；dry 只计算差集打印、不下载不写盘。
 * @returns {Promise<{added:number, failed:number, heroMissing:number, dry:boolean}>}
 */
export async function runDownloadIcons({ soft = false, dry = false } = {}) {
  // dumpOnly（潜能影像觉醒立绘）源站没有，只能从解包导入，故不进下载队列
  const entries = collectIcons().filter((e) => !e.dumpOnly && (!e.skin || SKIN_LOCAL))

  // 差集：已存在的本地文件跳过（幂等），只补缺失
  const queue = []
  for (const e of entries) {
    const dest = localPath(e)
    if (fs.existsSync(dest)) continue
    queue.push({ url: cdnUrl(e), dest, cat: e.cat })
  }

  if (dry) {
    console.log('== 图标差集（--dry，不下载）==')
    for (const q of queue) console.log(`  + ${q.cat}/${path.basename(q.dest)}`)
    console.log(`SYNC_ICONS added=${queue.length} missing=0`)
    return { added: queue.length, failed: 0, heroMissing: 0, dry: true }
  }

  let ok = 0
  const failed = []
  const heroMissing = [] // hero 头图源站缺口（如 1611/1621 未上传）：仅告警，不置失败码
  const report = () => {
    ok++
    if (ok % 25 === 0) console.log(`  ✓ ${ok}/${queue.length + ok}…`)
  }

  const workers = Array.from(
    { length: Math.min(CONCURRENCY, Math.max(1, queue.length)) },
    () =>
      worker(queue, report, (url, msg, cat) =>
        cat === 'hero' ? heroMissing.push({ url, msg }) : failed.push({ url, msg }),
      ),
  )
  await Promise.all(workers)

  // queue 已被 worker 消费（shift 清空），改用已处理计数推断跳过数
  const skipped = entries.length - ok - failed.length - heroMissing.length
  console.log(`\n== 图标本地化 ==`)
  console.log(
    `目标资源：${entries.length}，本次下载：${ok}，本地已存在跳过：${skipped}，失败：${failed.length + heroMissing.length}`,
  )
  for (const f of failed) console.log(`  ${soft ? '⚠' : '✖'} ${f.url} → ${f.msg}`)
  for (const f of heroMissing) console.log(`  ⚠ ${f.url} → ${f.msg}（源站未上传；本地/前端底色兜底不破图）`)

  console.log(`SYNC_ICONS added=${ok} missing=${failed.length + heroMissing.length}`)
  return { added: ok, failed: failed.length, heroMissing: heroMissing.length, dry: false }
}

/** 直接以 CLI 运行时才执行并设退出码；被 sync-data import 时由调用方决定流程。 */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const soft = process.argv.includes('--soft')
  const dry = process.argv.includes('--dry')
  const r = await runDownloadIcons({ soft, dry })
  if (!dry && !soft && r.failed) process.exitCode = 1
}
