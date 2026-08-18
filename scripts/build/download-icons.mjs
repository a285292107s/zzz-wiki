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

/** 从 zh 数据中动态收集富文本 <IconMap:Icon_XXX> 资产名（描述内键位图标） */
function collectRichIconRefs() {
  const refs = new Set()
  for (const dir of ['character', 'bangboo', 'weapon']) {
    const base = path.join(DATA, 'zh', dir)
    if (!fs.existsSync(base)) continue
    for (const f of fs.readdirSync(base)) {
      const raw = fs.readFileSync(path.join(base, f), 'utf8')
      for (const m of raw.matchAll(/IconMap:(Icon_\w+)/g)) refs.add(m[1])
    }
  }
  return refs
}

const SKILL_ASSETS = [
  'Icon_Normal',
  'Icon_Evade',
  'Icon_Special',
  'Icon_SpecialReady',
  'Icon_UltimateReady',
  'Icon_QTE',
  'Icon_Switch',
  'Icon_Core',
  // 动态补齐富文本引用的键位资产（如 Icon_GeneralBuff_*、Icon_JoyStick 等），
  // 避免手写清单漏项导致描述内图标本地缺失（Q: 1041 特殊技 Icon_Special 丢失）
  ...collectRichIconRefs(),
]

/**
 * 资产名 → nanoka CDN 真实文件名 的别名映射。
 * nanoka 资产集中部分图标文件名与游戏标记名不同（skillAssetSources 直接按资产名
 * 请求会 404），下载时按此表换用真实文件名；本地落盘仍用资产名，前端无需感知。
 * 来源：nanoka 站点 chunk 的 IconMap 映射表 + 角色数据 IconGeneralBuff/*.png 交叉验证。
 */
const SKILL_ASSET_ALIAS = {
  Icon_Special: 'IconRoleSkillKeySpecial',
  Icon_SpecialReady_Rp: 'IconRoleSkillKeySpecialV3_02',
  Icon_GeneralBuff_Fire: 'IconFire',
  Icon_GeneralBuff_Frost: 'IconFrost',
  Icon_GeneralBuff_Ice: 'IconIce',
  Icon_GeneralBuff_Thunder: 'IconThunder',
  Icon_GeneralBuff_PhysDmg: 'IconPhysDmg',
  Icon_GeneralBuff_HonedEdge: 'IconHonedEdge',
  Icon_GeneralBuff_AuricInk: 'IconAuricInk',
  Icon_GeneralBuff_DungeonBuffEther: 'IconDungeonBuffEther',
}

/**
 * 筛选图标（属性/职业/阵营）资产清单 → 落地 /data/img/filter/。
 * 与 src/domain/filterIcons.ts 的 ELEMENT_ICONS / PROFESSION_ICONS / CAMP_ICONS
 * 保持一致（该文件在基线中即直连 nanoka CDN，Q: GeneralBuff 属性图标核对时发现
 * 未本地化，违反"运行时零外部请求"铁律，故纳入构建期本地化清单）。
 */
const FILTER_ASSETS = [
  // 属性
  'IconPhysical', 'IconFire', 'IconIce', 'IconElectric', 'IconWind', 'IconEther', 'IconLumen',
  // 职业
  'IconAttack', 'IconStun', 'IconAnomaly', 'IconSupport', 'IconDefense', 'IconRupture',
  // 阵营
  'IconCampGentleHouse', 'IconCampVictoriaHousekeepingCo.', 'IconCampBelobogIndustries',
  'IconCampSonsOfCalydon', 'IconCampObols', 'IconCampH.S.O-S6', 'IconCampN.E.P.S.',
  'IconCampStarsOfLyra', 'IconCampMockingBird', 'IconCampSuibian', 'IconCampSpookShack',
  'IconCampBlackRoot', 'IconCampAngelsOfDelusion',
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
  filter: new Set(FILTER_ASSETS),
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
    // skill 资产按别名映射取真实 CDN 文件名（asset 名与文件不同的场景）
    const remote = cat === 'skill' ? (SKILL_ASSET_ALIAS[base] ?? base) : base
    queue.push({ url: `${N}/${remote}.webp`, dest })
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
