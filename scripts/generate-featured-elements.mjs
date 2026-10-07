/* ============================================================
 * generate-featured-elements.mjs — 生成 src/data/featured-elements.json
 *
 * 用途：首页「今日角色」要在**选片时**就知道每张卡的属性，才能挑出「属性不重复」的一批。
 * 但属性来自名录（异步），而选片必须同步发生（头图 src 只依赖 id，才能与清单请求并行、
 * 不让 LCP 排在 JSON 后面）。故把「池内 id → 属性」这张小表在**构建期之外**派生好并提交，
 * 运行时直接 import（零请求、零等待）。
 *
 * 为什么不做成构建期生成：仓库约定「只构建已提交快照，不在构建期重建数据」——
 * 生成器按需运行、产物入库；`--check` 模式校验产物与 character.json 是否一致，
 * 由 build:ci 调用（漂移即失败，不静默）。
 *
 * 用法：node scripts/generate-featured-elements.mjs          # 写入
 *       node scripts/generate-featured-elements.mjs --check  # 只校验（CI 用）
 * ============================================================ */

import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'src/data/featured-elements.json')
const pool = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/featured-pool.json'), 'utf8')).pool
const chars = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/live/character.json'), 'utf8'))

const table = {}
const missing = []
for (const p of pool) {
  const c = chars[String(p.id)]
  if (!c) {
    missing.push(p.id)
    continue
  }
  // **紧凑格式 `[属性码, 阵营, 特殊属性?]`**：这张表要进主包，逐条 {element:…,camp:…,special:null}
  // 的写法把 gzip 顶过预算（实测 62.5KB / 预算 62KB）。数组形式省掉重复键名。
  // camp 用于「设计语言」维度的去重——不同阵营（机车帮 / 家政 / 治安局 / 防卫军…）的角色
  // 设计语言差异明显，而属性不同的角色仍可能外观雷同（实测出现过「4 张里 3 张白发红眼」）。
  table[String(p.id)] = c.special_element ? [c.element, c.camp_name ?? null, c.special_element] : [c.element, c.camp_name ?? null]
}

if (missing.length) {
  console.error(`✖ 池内 ${missing.length} 个 id 不在名录里：${missing.join(', ')}（策展池与数据脱节）`)
  process.exit(1)
}

const json = JSON.stringify(table) + '\n'
const check = process.argv.includes('--check')

if (check) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : ''
  if (cur !== json) {
    console.error('✖ featured-elements.json 与 character.json 不一致（跑 npm run gen:featured-elements 重新生成）')
    process.exit(1)
  }
  console.log(`== featured-elements == 校验通过（${Object.keys(table).length} 条，与名录一致）`)
} else {
  fs.writeFileSync(OUT, json)
  const byEl = {}
  for (const v of Object.values(table)) byEl[v[0]] = (byEl[v[0]] ?? 0) + 1
  console.log(`== featured-elements == 写入 ${Object.keys(table).length} 条；属性分布 ${JSON.stringify(byEl)}`)
}
