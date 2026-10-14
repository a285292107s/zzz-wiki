/* ============================================================
 * generate-featured-birthdays.mjs — 生成 src/data/featured-birthdays.json
 *
 * 用途：首页「今日角色」要在**选片时**就知道每个候选的生日，才能把当天生日的角色排到牌堆最前。
 * 生日只存在于**详情**数据（public/data/live/{lang}/character/{id}.json 的 partner_info.birthday），
 * 名录里没有；运行时逐张去取等于把首屏挂在 N 个请求上（且选片无法同步发生）。
 * 故把「池内 id → 生日」这张小表在**构建期之外**派生好并提交，运行时直接 import（零请求、零等待）。
 *
 * 为什么不做成构建期生成：仓库约定「只构建已提交快照，不在构建期重建数据」——
 * 生成器按需运行、产物入库；`--check` 模式校验产物与详情数据是否一致，由 build:ci 调用
 * （漂移即失败，不静默）。
 *
 * 格式：`{"1011":"02-20"}` —— 键为角色号，值统一补零成 `MM-DD`（源数据混用 `3/21` 与 `02/20`，
 * 不归一化就没法与当天的 `MM-DD` 直接比字符串）。**生日缺失的角色不入表**（如 1551），
 * 语义是「该角色不享生日优先」，不是错误：源数据本身就没有这项。
 * 例外是**特殊形态**：同一角色的另一形态在源数据里同样没有生日，但生日必然与本体相同
 * （星徽·比利 1531 → 比利 1081），故这类走人工补充表 `src/data/birthday-supplement.json`
 * 的 `inheritFrom`，本体生日仍取自详情（单一来源，不在两处各存一份）。
 *
 * 用法：node scripts/generate-featured-birthdays.mjs          # 写入
 *       node scripts/generate-featured-birthdays.mjs --check  # 只校验（CI 用）
 * ============================================================ */

import fs from 'node:fs'
import path from 'node:path'
import { DEFAULT_LANG } from './build/langs.mjs'

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'src/data/featured-birthdays.json')
const POOL = path.join(ROOT, 'src/data/featured-pool.json')
/** 生日与语言无关（`partner_info.birthday` 是个 `MM-DD` 量），故取**默认语言**那份详情即可；
 *  但路径里的语言码必须来自 langs.json 的单一事实源，不写死（改语言集时不致静默读错目录）。 */
const DETAIL_DIR = path.join(ROOT, 'public/data/live', DEFAULT_LANG, 'character')
const SUPPLEMENT = path.join(ROOT, 'src/data/birthday-supplement.json')

const pool = JSON.parse(fs.readFileSync(POOL, 'utf8')).pool
/** 特殊形态 → 本体（人工补充；语义与来源见 src/data/birthday-supplement.json 的 _comment） */
const inheritFrom = JSON.parse(fs.readFileSync(SUPPLEMENT, 'utf8')).inheritFrom ?? {}

const table = {}
const noFile = []
const noBirthday = []
const inherited = []
const malformed = []

for (const p of pool) {
  const file = path.join(DETAIL_DIR, `${p.id}.json`)
  if (!fs.existsSync(file)) {
    noFile.push(p.id)
    continue
  }
  const detail = JSON.parse(fs.readFileSync(file, 'utf8'))
  let raw = detail?.partner_info?.birthday
  // 详情缺生日 → 看补充表里有没有「本体」可继承（同一角色的另一形态，自然同一天生日）
  if (raw === undefined || raw === null || raw === '') {
    const base = inheritFrom[String(p.id)]
    if (base === undefined) {
      noBirthday.push(p.id)
      continue
    }
    // 本体的生日同样必须来自详情：查无文件或本体也缺生日 → 响亮失败，不静默少一条
    const baseFile = path.join(DETAIL_DIR, `${base}.json`)
    if (!fs.existsSync(baseFile)) {
      console.error(`✖ ${p.id} 的生日要继承自 ${base}，但 ${base} 没有详情文件（补充表见 src/data/birthday-supplement.json）`)
      process.exit(1)
    }
    raw = JSON.parse(fs.readFileSync(baseFile, 'utf8'))?.partner_info?.birthday
    if (raw === undefined || raw === null || raw === '') {
      // 也不支持多级继承（形态→形态→本体）：那样表里会出现一处追不到源头的值
      console.error(`✖ ${p.id} 的生日要继承自 ${base}，但 ${base} 的详情也没有生日（补充表见 src/data/birthday-supplement.json）`)
      process.exit(1)
    }
    inherited.push(`${p.id}←${base}`)
  }
  // 源数据格式不统一（'02/20' 与 '3/21' 并存）→ 一律补零成 MM-DD
  const m = /^(\d{1,2})\/(\d{1,2})$/.exec(String(raw).trim())
  if (!m) {
    malformed.push(`${p.id}="${raw}"`)
    continue
  }
  const [, mm, dd] = m
  table[String(p.id)] = `${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
}

// 池内 id 在详情里查无此文件 = 策展池与数据脱节（与名录同一条判据），必须响亮失败
if (noFile.length) {
  console.error(`✖ 池内 ${noFile.length} 个 id 没有详情文件：${noFile.join(', ')}（策展池与数据脱节）`)
  process.exit(1)
}
// 生日串非 M/D：格式变了就会静默选不出生日，故同样失败而不是跳过
if (malformed.length) {
  console.error(`✖ ${malformed.length} 条生日格式无法解析：${malformed.join(', ')}（期望 M/D 或 MM/DD）`)
  process.exit(1)
}

const json = JSON.stringify(table) + '\n'
const check = process.argv.includes('--check')

// 补充表里指向「当前不在池内」的形态：产物里不会出现它，条目暂时空转。
// 只提醒不失败——池是人工策展、随时增减，条目留着等该角色回池仍然生效。
const poolIds = new Set(pool.map((p) => p.id))
const stale = Object.keys(inheritFrom).filter((k) => !poolIds.has(Number(k)))
if (stale.length) console.log(`   ℹ 补充表 ${stale.length} 条指向池外角色（当前空转）：${stale.join(', ')}`)

if (check) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : ''
  if (cur !== json) {
    console.error('✖ featured-birthdays.json 与详情数据 / 补充表不一致（跑 pnpm run gen:featured-birthdays 重新生成）')
    process.exit(1)
  }
  console.log(`== featured-birthdays == 校验通过（${Object.keys(table).length} 条，与详情数据 + 补充表一致）`)
} else {
  fs.writeFileSync(OUT, json)
  console.log(`== featured-birthdays == 写入 ${Object.keys(table).length} 条`)
  console.log(`   按形态继承本体生日：${inherited.length} 条 ${inherited.join(', ') || '—'}`)
  console.log(`   源数据无生日（不享生日优先）：${noBirthday.length} 条 ${noBirthday.join(', ') || '—'}`)
}
