/* ============================================================
 * build-data.mjs — 数据管线 v2（hakushin raw / static.nanoka.cc）
 *
 * 数据源：https://static.nanoka.cc（zzz.nanoka.cc / hakush.in 站底层 CDN）
 *   - manifest.json                版本清单（zzz.latest 即当前数据版本）
 *   - zzz/{ver}/character.json     角色名录（无语言，含四语名）
 *   - zzz/{ver}/weapon.json        音擎名录
 *   - zzz/{ver}/bangboo.json       邦布名录
 *   - zzz/{ver}/equipment.json     驱动盘套装名录
 *   - zzz/{ver}/zh/character/{id}.json   角色详情（中文）
 *   - zzz/{ver}/zh/weapon/{id}.json      音擎详情（中文）
 *   - zzz/{ver}/zh/bangboo/{id}.json     邦布详情（中文）
 *   - zzz/{ver}/zh/equipment/{id}.json   驱动盘详情（中文）
 *
 * 解析层：直取 + 规整（不做键名反混淆；hakushin raw 字段名已是可读英文）。
 *   规整点：icon 路径 → 裸文件名；名录补 Id 大写字键；
 *   详情 weapon_type/element_type/hit_type 的值统一为英文（与旧契约一致）；
 *   special_element_type / strategy / fairy_recommend / skill_list 等新字段原样透传。
 *
 * 输出（契约与旧 Dimbreath 管线一致，前端 src/data/* 零改动）：
 *   public/data/manifest.json / character.json / weapon.json
 *   public/data/bangboo.json / equipment.json
 *   public/data/zh/character/{id}.json / zh/weapon/{id}.json
 *   public/data/zh/bangboo/{id}.json / zh/equipment/{id}.json   （新增详情）
 *
 * 用法：node scripts/build-data.mjs [--force]
 * 环境：Node 20+（内置 fetch）；有 HTTP(S) 代理时设 NODE_USE_ENV_PROXY=1。
 * ============================================================ */

import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const CACHE = path.join(ROOT, '.cache', 'hakushin-raw')
const OUT = path.join(ROOT, 'public', 'data')

const BASE = 'https://static.nanoka.cc'
const FORCE = process.argv.includes('--force')
const CONCURRENCY = 8 // 详情并发抓取上限

/* ---------------- 下载（磁盘缓存） ---------------- */

async function fetchJson(url, rel) {
  const dest = path.join(CACHE, rel)
  if (!FORCE && fs.existsSync(dest)) {
    return JSON.parse(await fsp.readFile(dest, 'utf8'))
  }
  const res = await fetch(url, { headers: { 'User-Agent': 'zzz-wiki/build-data.mjs' } })
  if (!res.ok) throw new Error(`HTTP ${res.status} · ${url}`)
  const json = await res.json()
  await fsp.mkdir(path.dirname(dest), { recursive: true })
  await fsp.writeFile(dest, JSON.stringify(json))
  process.stdout.write(`  ↓ ${rel}\n`)
  return json
}

async function mapConcurrent(items, concurrency, fn) {
  const results = new Array(items.length)
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

/* ---------------- 规整工具 ---------------- */

/** 资源路径 → 裸文件名（去目录、去扩展名），图标 CDN 命名规则 */
const basename = (p) => (p || '').split('/').pop().replace(/\.(png|webp)$/i, '')

/* 与 src/data/types.ts 对齐的英文名（详情 weapon_type/element_type/hit_type 的值） */
const ELEMENT_EN = { 200: 'Physical', 201: 'Fire', 202: 'Ice', 203: 'Electric', 204: 'Wind', 205: 'Ether', 300: 'Lumiflux' }
const SPECIALTY_EN = { 1: 'Attack', 2: 'Stun', 3: 'Anomaly', 4: 'Support', 5: 'Defense', 6: 'Rupture' }
const HIT_EN = { 101: 'Slash', 102: 'Strike', 103: 'Pierce' }

/** nanoka 素材 CDN 已知缺口：这些皮肤的美术图未上传到 assets（实测 404），
 *  回退到默认立绘避免死链。（口径与 zzz.nanoka.cc / hb-data 一致） */
const SKIN_IMAGE_FALLBACK = {
  'IconRole34_03': 'IconRole34', // 哲 第 3 套皮肤
  'IconRole33_03': 'IconRole33', // 铃 第 3 套皮肤
}

/**
 * 详情规整：键名与旧的 Dimbreath 管线输出契约一致（前端 src/data/types.ts 零改动）。
 * hakushin raw 的键长名与契约几乎完全同构，此处只做值规整 + 透传。
 */
function normalizeCharacterDetail(d) {
  const enVal = (m) => { const k = Object.keys(m)[0]; return k ? { [k]: (ELEMENT_EN[k] ?? SPECIALTY_EN[k] ?? HIT_EN[k] ?? String(m[k])) } : m }
  const out = {
    id: d.id,
    icon: d.icon,
    name: d.name,
    code_name: d.code_name,
    rarity: d.rarity,
    weapon_type: enVal(d.weapon_type ?? {}),
    element_type: enVal(d.element_type ?? {}),
    hit_type: enVal(d.hit_type ?? {}),
    camp: d.camp ?? {},
    gender: d.gender,
    partner_info: d.partner_info ?? {},
    stats: d.stats ?? {},
    skill: d.skill ?? {},
    talent: d.talent ?? {},
    passive: d.passive ?? {},
    skin: skinImages(d.skin ?? {}),
    // 新字段（v2 增值）：原样透传，前端 index signature 兼容
    special_element_type: d.special_element_type ?? {},
    skill_list: d.skill_list ?? {},
    skill_priority: d.skill_priority ?? [],
    fairy_recommend: d.fairy_recommend ?? {},
    strategy: d.strategy ?? [],
    potential: d.potential ?? [],
    potential_detail: d.potential_detail ?? {},
    level: d.level ?? {},
    extra_level: d.extra_level ?? {},
    level_exp: d.level_exp ?? [],
    live2_d: d.live2_d ?? '',
  }
  return out
}

/** 皮肤 image 回退（沿用旧管线 SKIN_IMAGE_FALLBACK） */
function skinImages(skin) {
  const out = {}
  for (const [k, v] of Object.entries(skin)) {
    out[k] = { ...v, image: SKIN_IMAGE_FALLBACK[v.image] ?? v.image }
  }
  return out
}

/* ---------------- 各域构建 ---------------- */

/** 名录：hakushin 列表条目的 ID 是对象 key（条目内部无 id 字段）；
 *  这里先注入 id，再补 Id 大写键 + icon 裸名。 */
function toListDict(listRaw) {
  const dict = {}
  for (const [k, v] of Object.entries(listRaw)) {
    const id = Number(k)
    if (!Number.isFinite(id)) continue
    dict[k] = { ...v, Id: id, icon: basename(v.icon ?? '') }
  }
  return dict
}

async function buildCharacters(ver) {
  const listRaw = await fetchJson(`${BASE}/zzz/${ver}/character.json`, `${ver}/character.json`)
  const ids = Object.keys(listRaw)
  const detailsRaw = await mapConcurrent(ids, CONCURRENCY, (id) =>
    fetchJson(`${BASE}/zzz/${ver}/zh/character/${id}.json`, `${ver}/zh/character/${id}.json`))

  const list = toListDict(listRaw)
  const details = {}
  for (let i = 0; i < ids.length; i++) {
    details[ids[i]] = normalizeCharacterDetail(detailsRaw[i])
  }
  return { list, details }
}

async function buildWeapons(ver) {
  const listRaw = await fetchJson(`${BASE}/zzz/${ver}/weapon.json`, `${ver}/weapon.json`)
  const ids = Object.keys(listRaw)
  const detailsRaw = await mapConcurrent(ids, CONCURRENCY, (id) =>
    fetchJson(`${BASE}/zzz/${ver}/zh/weapon/${id}.json`, `${ver}/zh/weapon/${id}.json`))

  const list = toListDict(listRaw)
  const details = {}
  for (let i = 0; i < ids.length; i++) {
    const d = detailsRaw[i]
    // 与旧契约一致：weapon_type 值英文；其余字段（含 level/stars/materials）透传
    const k = Object.keys(d.weapon_type ?? {})[0]
    details[ids[i]] = {
      ...d,
      weapon_type: k ? { [k]: SPECIALTY_EN[k] ?? String(d.weapon_type[k]) } : d.weapon_type,
    }
  }
  return { list, details }
}

async function buildBangboos(ver) {
  const listRaw = await fetchJson(`${BASE}/zzz/${ver}/bangboo.json`, `${ver}/bangboo.json`)
  const ids = Object.keys(listRaw)
  const detailsRaw = await mapConcurrent(ids, CONCURRENCY, (id) =>
    fetchJson(`${BASE}/zzz/${ver}/zh/bangboo/${id}.json`, `${ver}/zh/bangboo/${id}.json`))

  const list = toListDict(listRaw)
  const details = {}
  for (let i = 0; i < ids.length; i++) {
    details[ids[i]] = { ...detailsRaw[i] }
  }
  return { list, details }
}

async function buildDiscs(ver) {
  const listRaw = await fetchJson(`${BASE}/zzz/${ver}/equipment.json`, `${ver}/equipment.json`)
  const ids = Object.keys(listRaw)
  const detailsRaw = await mapConcurrent(ids, CONCURRENCY, (id) =>
    fetchJson(`${BASE}/zzz/${ver}/zh/equipment/${id}.json`, `${ver}/zh/equipment/${id}.json`))

  const list = toListDict(listRaw)
  const details = {}
  for (let i = 0; i < ids.length; i++) {
    details[ids[i]] = { ...detailsRaw[i] }
  }
  return { list, details }
}

/* ---------------- 主流程 ---------------- */

async function main() {
  console.log('[1/4] 读取版本清单…')
  const manifest = await fetchJson(`${BASE}/manifest.json`, 'manifest.json')
  const zzz = manifest.zzz
  const ver = zzz.latest
  console.log(`  zzz 版本：latest=${ver}（live=${zzz.live}，可用 ${zzz.available.length} 个）`)
  console.log(`  新内容：角色 ${(zzz.new?.character ?? []).length} / 音擎 ${(zzz.new?.weapon ?? []).length} / 怪物 ${(zzz.new?.monster ?? []).length}`)

  console.log(`[2/4] 抓取名录（缓存：${CACHE}，--force 强制刷新）`)
  const char = await buildCharacters(ver)
  const weapon = await buildWeapons(ver)
  const bangboo = await buildBangboos(ver)
  const disc = await buildDiscs(ver)

  console.log('[3/4] 写盘 → public/data/')
  await fsp.rm(OUT, { recursive: true, force: true })
  const dirs = ['zh/character', 'zh/weapon', 'zh/bangboo', 'zh/equipment']
  await Promise.all(dirs.map((d) => fsp.mkdir(path.join(OUT, d), { recursive: true })))

  await fsp.writeFile(path.join(OUT, 'manifest.json'), JSON.stringify({
    zzz: {
      latest: ver,
      live: zzz.live,
      source: 'static.nanoka.cc (hakushin raw / zzz.nanoka.cc)',
    },
    generated: new Date().toISOString(),
  }, null, 2))

  const dump = (name, dict) => fsp.writeFile(path.join(OUT, name), JSON.stringify(dict, null, 1))
  await dump('character.json', char.list)
  await dump('weapon.json', weapon.list)
  await dump('bangboo.json', bangboo.list)
  await dump('equipment.json', disc.list)

  const writeDetails = async (dir, details) => {
    await Promise.all(Object.entries(details).map(([id, d]) =>
      fsp.writeFile(path.join(OUT, dir, `${id}.json`), JSON.stringify(d, null, 1))))
  }
  await writeDetails('zh/character', char.details)
  await writeDetails('zh/weapon', weapon.details)
  await writeDetails('zh/bangboo', bangboo.details)
  await writeDetails('zh/equipment', disc.details)

  const countDetails = (d) => Object.keys(d).length
  console.log(`  名录：角色 ${Object.keys(char.list).length} / 音擎 ${Object.keys(weapon.list).length} / 邦布 ${Object.keys(bangboo.list).length} / 驱动盘 ${Object.keys(disc.list).length}`)
  console.log(`  详情：角色 ${countDetails(char.details)} / 音擎 ${countDetails(weapon.details)} / 邦布 ${countDetails(bangboo.details)} / 驱动盘 ${countDetails(disc.details)}`)

  console.log('[4/4] 完成 →', OUT)
}

main().catch((e) => {
  console.error('✖ 构建失败：', e)
  process.exit(1)
})