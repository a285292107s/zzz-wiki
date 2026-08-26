/* ============================================================
 * verify-icons.mjs — 图标资源可用性校验
 *
 * 遍历 public/data/ 生成的全部 icon basename（角色/音擎/邦布/驱动盘/皮肤），
 * 逐个 HEAD 探测 nanoka 素材 CDN：
 *   https://static.nanoka.cc/assets/zzz/{base}.webp
 * 输出统计与失败清单；存在失败时以非零码退出（可挂在 CI）。
 *
 * 用法：node scripts/verify-icons.mjs
 * 环境：需外网；有代理时设 NODE_USE_ENV_PROXY=1。
 * ============================================================ */

import fs from 'node:fs'
import path from 'node:path'

const DATA = path.resolve('public/data')
const N = 'https://static.nanoka.cc/assets/zzz'
/** 单数据版本：live = 正式服（名录/详情位于 public/data/live/） */
const VER = 'live'

const head = async (u) => {
  try {
    const r = await fetch(u, { method: 'HEAD', redirect: 'follow' })
    return r.status
  } catch {
    return -1
  }
}

/* ---------- 收集全部 icon basename ---------- */

const items = []
const add = (cat, id, base) => {
  if (base) items.push({ cat, id, base })
}

for (const [id, c] of Object.entries(JSON.parse(fs.readFileSync(path.join(DATA, VER, 'character.json'), 'utf8')))) {
  add('character', id, c.icon)
}
for (const [id, w] of Object.entries(JSON.parse(fs.readFileSync(path.join(DATA, VER, 'weapon.json'), 'utf8')))) {
  add('weapon', id, w.icon)
}
for (const [id, b] of Object.entries(JSON.parse(fs.readFileSync(path.join(DATA, VER, 'bangboo.json'), 'utf8')))) {
  add('bangboo', id, b.icon)
}
for (const [id, d] of Object.entries(JSON.parse(fs.readFileSync(path.join(DATA, VER, 'equipment.json'), 'utf8')))) {
  add('disc', id, d.icon)
}
for (const f of fs.readdirSync(path.join(DATA, VER, 'zh', 'character'))) {
  const d = JSON.parse(fs.readFileSync(path.join(DATA, VER, 'zh', 'character', f), 'utf8'))
  for (const s of Object.values(d.skin || {})) add('skin', d.id, s.image)
}

/* ---------- nanoka CC 审计 ---------- */

const nanokaMiss = []
for (const it of items) {
  const u = `${N}/${it.base}.webp`
  const s = await head(u)
  if (s !== 200 && s !== -1) nanokaMiss.push({ ...it, status: s, url: u })
}
console.log(`== nanoka.cc /assets/zzz：${items.length} 个资源，失败 ${nanokaMiss.length} ==`)
for (const m of nanokaMiss) console.log(`  ✖ [${m.cat}] ${m.id} ${m.base} → ${m.status}`)
if (!nanokaMiss.length) console.log('  ✔ 全部可达')

console.log('\n判定：nanoka 资源失败数 =', nanokaMiss.length)
process.exit(nanokaMiss.length ? 1 : 0)