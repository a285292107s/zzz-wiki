/* ============================================================
 * download-icons.mjs — 图标本地化（Q4b）
 *
 * 把前端运行时需要的图标从素材 CDN（nanoka.cc）下载到
 * public/data/img/{category}/{base}.webp，使站点「运行时零外部请求」。
 *
 * 覆盖：
 *   - character / weapon / bangboo / disc 名录 icon（对象 key = 名录 id）
 *   - skill 键位图标（Icon_Normal 等）+ 富文本 <IconMap:Icon_XXX>
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

const DATA = path.resolve('public/data')
const IMG = path.join(DATA, 'img')
const N = 'https://static.nanoka.cc/assets/zzz'

/** 皮肤缩略图是否本地化（默认否：多为大图，避免仓库膨胀） */
const SKIN_LOCAL = process.env.SKIN_LOCAL === '1'

const SKILL_ASSETS = [
  'Icon_Normal',
  'Icon_Evade',
  'Icon_Special',
  'Icon_SpecialReady',
  'Icon_UltimateReady',
  'Icon_QTE',
  'Icon_Switch',
  'Icon_Core',
]

/* ---------- 收集 {category: Set<base>} ---------- */

function listBasenames(file, cat) {
  const set = new Set()
  const obj = JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8'))
  for (const v of Object.values(obj)) if (v?.icon) set.add(String(v.icon).replace(/\.(png|webp)$/i, ''))
  return set
}

const byCat = {
  character: listBasenames('character.json', 'character'),
  weapon: listBasenames('weapon.json', 'weapon'),
  bangboo: listBasenames('bangboo.json', 'bangboo'),
  disc: listBasenames('equipment.json', 'disc'),
  skin: SKIN_LOCAL ? new Set() : null,
  skill: new Set(SKILL_ASSETS),
}

if (SKIN_LOCAL) {
  for (const f of fs.readdirSync(path.join(DATA, 'zh', 'character'))) {
    const d = JSON.parse(fs.readFileSync(path.join(DATA, 'zh', 'character', f), 'utf8'))
    for (const s of Object.values(d.skin || {})) {
      if (s?.image) byCat.skin.add(String(s.image).replace(/\.(png|webp)$/i, ''))
    }
  }
}

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
    const { url, dest } = queue.shift()
    try {
      await download(url, dest)
      ok(dest)
    } catch (e) {
      fail(url, e.message)
    }
  }
}

const queue = []
for (const [cat, bases] of Object.entries(byCat)) {
  if (!bases) continue // 皮肤默认跳过
  for (const base of bases) {
    const dest = path.join(IMG, cat, `${base}.webp`)
    if (fs.existsSync(dest)) continue // 幂等
    queue.push({ url: `${N}/${base}.webp`, dest })
  }
}

let ok = 0
const failed = []
const report = () => {
  ok++
  if (ok % 25 === 0) console.log(`  ✓ ${ok}/${queue.length + ok}…`)
}

const workers = Array.from({ length: Math.min(CONCURRENCY, Math.max(1, queue.length)) }, () =>
  worker(queue, report, (url, msg) => failed.push({ url, msg })),
)
await Promise.all(workers)

const total = Object.values(byCat).reduce((n, s) => n + s.size, 0)
console.log(`\n== 图标本地化 ==`)
console.log(`目标资源：${total}，本次下载：${ok}，本地已存在跳过：${total - ok - failed.length}，失败：${failed.length}`)
for (const f of failed) console.log(`  ✖ ${f.url} → ${f.msg}`)
if (failed.length) process.exitCode = 1
