/* ============================================================
 * download-icons.mjs — 图标本地化（Q4b）
 *
 * 把前端运行时需要的图标从素材 CDN（nanoka.cc）下载到
 * public/data/img/{category}/{base}.webp，使站点「运行时零外部请求」。
 *
 * 覆盖：
 *   - character / weapon / bangboo / disc 名录 icon（对象 key = 名录 id）
 *   - skill 键位图标（Icon_Normal 等）+ 富文本 <IconMap:Icon_XXX>
 *   - hero 头图（Mindscape_{id}_2.webp，角色详情页 AgentHead 本地优先，
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

const DATA = path.resolve('public/data')
const IMG = path.join(DATA, 'img')
const N = 'https://static.nanoka.cc/assets/zzz'

/** 数据版本目录（仅 live = 正式服；名录/详情收集从此目录，图标落地 img/） */
const VERSIONS = ['live']

/** 皮肤缩略图是否本地化（默认否：多为大图，避免仓库膨胀） */
const SKIN_LOCAL = process.env.SKIN_LOCAL === '1'

/** 从 zh 数据中动态收集富文本 <IconMap:Icon_XXX> 资产名（描述内键位图标） */
function collectRichIconRefs() {
  const refs = new Set()
  for (const ver of VERSIONS) {
    for (const dir of ['character', 'bangboo', 'weapon']) {
      const base = path.join(DATA, ver, 'zh', dir)
      if (!fs.existsSync(base)) continue
      for (const f of fs.readdirSync(base)) {
        const raw = fs.readFileSync(path.join(base, f), 'utf8')
        for (const m of raw.matchAll(/IconMap:(Icon_\w+)/g)) refs.add(m[1])
      }
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
  // 1551 佩洛伊斯「支援突击：重睹天目」的源站标记 Icon_Pyroisl 为占位/拼写名（CDN 无此文件），
  // 语义上即通用招架键 Icon_Switch（同招式另两个槽位 快速支援/招架支援 亦用之）→ 按此映射兜底
  Icon_Pyroisl: 'Icon_Switch',
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

/**
 * 双形态角色 hero 头图：源站未提供裸名 Mindscape_{id}_2.webp，而是按性别后缀区分
 * （Mindscape_{id}_Female_2 / Mindscape_{id}_Male_2）。
 * 单一事实源在 src/data/hero-gender-variants.json：value = { variants, defaultFile }。
 * 本脚本按 variants 逐个下载；前端 src/data/heroGenderVariants.ts 的 heroVariantFile(id, form)
 * 经 useHeroForm 形态状态取当前版（女性=defaultFile，男性=variants 中非 defaultFile 项）；
 * CalibrateView 据此把这些 id 排除出「裸名可渲染列」。返回 { [id]: string[] }（下载顺序）。
 */
const HERO_GENDER_VARIANTS = (() => {
  const p = path.resolve('src/data/hero-gender-variants.json')
  if (!fs.existsSync(p)) return {}
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'))
  return Object.fromEntries(Object.entries(raw).map(([id, v]) => [id, v.variants]))
})()

/* ---------- 收集 {category: Set<base>} ---------- */

function listBasenames(file, cat) {
  const set = new Set()
  for (const ver of VERSIONS) {
    const p = path.join(DATA, ver, file)
    if (!fs.existsSync(p)) continue
    const obj = JSON.parse(fs.readFileSync(p, 'utf8'))
    for (const v of Object.values(obj)) if (v?.icon) set.add(String(v.icon).replace(/\.(png|webp)$/i, ''))
  }
  return set
}

/** 收集名录 id（hero 头图以 Mindscape_{id}_2 命名） */
function listIds(file) {
  const set = new Set()
  for (const ver of VERSIONS) {
    const p = path.join(DATA, ver, file)
    if (!fs.existsSync(p)) continue
    const obj = JSON.parse(fs.readFileSync(p, 'utf8'))
    for (const k of Object.keys(obj)) set.add(k)
  }
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
  hero: listIds('character.json'),
}

if (SKIN_LOCAL) {
  for (const ver of VERSIONS) {
    const base = path.join(DATA, ver, 'zh', 'character')
    if (!fs.existsSync(base)) continue
    for (const f of fs.readdirSync(base)) {
      const d = JSON.parse(fs.readFileSync(path.join(base, f), 'utf8'))
      for (const s of Object.values(d.skin || {})) {
        if (s?.image) byCat.skin.add(String(s.image).replace(/\.(png|webp)$/i, ''))
      }
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
    const { url, dest, cat } = queue.shift()
    try {
      await download(url, dest)
      ok(dest)
    } catch (e) {
      fail(url, e.message, cat)
    }
  }
}

const queue = []
let planned = 0 // 计划处理的资源文件数（hero 双形态角色按实际文件数计）
for (const [cat, bases] of Object.entries(byCat)) {
  if (!bases) continue // 皮肤默认跳过
  for (const base of bases) {
    // hero 头图落地名与前端引用一致：默认 Mindscape_{id}_2.webp；
    // 双形态角色（如 1551 佩洛伊斯）源站以性别后缀区分，按 HERO_GENDER_VARIANTS 列全量形态
    const files =
      cat === 'hero' ? (HERO_GENDER_VARIANTS[base] ?? [`Mindscape_${base}_2`])
      : [base]
    for (const file of files) {
      planned++
      const dest = path.join(IMG, cat, `${file}.webp`)
      if (fs.existsSync(dest)) continue // 幂等
      // skill 资产按别名映射取真实 CDN 文件名（asset 名与文件不同的场景）；
      // 其余类别落地名即 CDN 文件名；hero 头图按 Mindscape_{id}（[Gender]_）2 命名规则
      const remote = cat === 'skill' ? (SKILL_ASSET_ALIAS[base] ?? base) : file
      queue.push({ url: `${N}/${remote}.webp`, dest, cat })
    }
  }
}

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
