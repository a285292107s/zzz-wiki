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
 *   - 角色皮肤缩略图（skin）——默认关闭（多为大图，会显著增大仓库，
 *     仅当 SKIN_LOCAL 环境变量为 1 时开启）
 *
 * 幂等：已存在的本地文件跳过；可重复运行增补缺失项。
 *
 * 用法：node scripts/build/download-icons.mjs           # 不含皮肤
 *       SKIN_LOCAL=1 node scripts/build/download-icons.mjs  # 含皮肤缩略图
 * 环境：需外网；有代理时设 NODE_USE_ENV_PROXY=1。
 * ============================================================ */

import fs from 'node:fs'
import path from 'node:path'
import { SKIN_LOCAL, collectIcons, cdnUrl, localPath } from './icon-inventory.mjs'

/* ---------- 下载（并发受限、幂等） ---------- */

const CONCURRENCY = 8

async function download(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, buf)
}

async function worker(queue, ok, fail) {
  while (queue.length) {
    const { url, dest, cat } = queue.shift()
    try {
      await download(url, dest)
      ok(dest)
    } catch (e) {
      fail(url, e.message, cat)
    }
  }
}

// 皮肤默认不下载（清单仍会产出 skin 条目供 verify 远程审计用）
const entries = collectIcons().filter((e) => e.cat !== 'skin' || SKIN_LOCAL)

const queue = []
for (const e of entries) {
  const dest = localPath(e)
  if (fs.existsSync(dest)) continue // 幂等
  queue.push({ url: cdnUrl(e), dest, cat: e.cat })
}

let planned = entries.length // 计划处理的资源文件数（hero 双形态角色按实际文件数计）
let ok = 0
const failed = []
const heroMissing = [] // hero 头图源站缺口（如 1611/1621 未上传）：仅告警，不置失败码
const report = () => {
  ok++
  if (ok % 25 === 0) console.log(`  ✓ ${ok}/${queue.length + ok}…`)
}

const workers = Array.from({ length: Math.min(CONCURRENCY, Math.max(1, queue.length)) }, () =>
  worker(queue, report, (url, msg, cat) =>
    cat === 'hero' ? heroMissing.push({ url, msg }) : failed.push({ url, msg }),
  ),
)
await Promise.all(workers)

console.log(`\n== 图标本地化 ==`)
console.log(`目标资源：${planned}，本次下载：${ok}，本地已存在跳过：${planned - ok - failed.length - heroMissing.length}，失败：${failed.length + heroMissing.length}`)
for (const f of failed) console.log(`  ✖ ${f.url} → ${f.msg}`)
for (const f of heroMissing) console.log(`  ⚠ ${f.url} → ${f.msg}（源站未上传；本地/前端底色兜底不破图）`)
if (failed.length) process.exitCode = 1
