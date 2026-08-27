/* ============================================================
 * icon-inventory.mjs — 图标资产清单收集（单一事实源）
 *
 * download-icons.mjs（下载）与 verify-icons.mjs（校验）共用同一份
 * 资产清单推导：名录 icon / 技能键位 / 筛选图标 / hero 头图 /
 * 皮肤缩略图。两脚本各自的收集逻辑曾各写一份并已发生漂移风险，
 * 现统一由本模块产出「待处理资产条目」，下载与校验只消费清单。
 *
 * 条目字段：
 *   cat     落地子目录 img/{cat}/，也是运行时候选链类别名
 *   file    本地落地文件名（不含扩展名），与前端引用一致
 *   remote  nanoka CDN 真实文件名（部分技能资产需别名映射）
 *   optionalLocal  本地缺失是否可容忍：
 *                  - skin 默认不本地化（SKIN_LOCAL=1 才下载）
 *                  - hero 头图源站缺口属已知（底色兜底不破图）
 */

import fs from 'node:fs'
import path from 'node:path'

export const DATA = path.resolve('public/data')
export const IMG = path.join(DATA, 'img')

/** 数据版本目录（仅 live = 正式服；名录/详情收集从此目录，图标落地 img/） */
export const VERSIONS = ['live']

/** 皮肤缩略图是否本地化（默认否：多为大图，避免仓库膨胀） */
export const SKIN_LOCAL = process.env.SKIN_LOCAL === '1'

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
  // 不含 Icon_Core：CDN 与本地均无此资产（曾致 verify 必失败 / 前端每次渲染多一发 404），前端候选链已同步移除
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
 * 单一事实源在 src/data/filter-assets.json（前端 filterIcons.ts 由同一份派生
 * code→资产名映射），此处取全部 value 作为待下载清单——手写第二份曾因双处
 * 维护存在漂移风险。注意含 IconLumen：纯本地资产，源站无此文件（校验按
 * 「本地已兜住」降级告警）。
 */
const FILTER_ASSETS = (() => {
  const p = path.resolve('src/data/filter-assets.json')
  if (!fs.existsSync(p)) return []
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'))
  return [
    ...Object.values(raw.elements ?? {}),
    ...Object.values(raw.professions ?? {}),
    ...Object.values(raw.camps ?? {}),
  ]
})()

/**
 * 双形态角色 hero 头图：源站未提供裸名 Mindscape_{id}_2.webp，而是按性别后缀区分
 * （Mindscape_{id}_Female_2 / Mindscape_{id}_Male_2）。
 * 单一事实源在 src/data/hero-gender-variants.json：value = { variants, defaultFile }。
 * 前端 src/data/heroGenderVariants.ts 的 heroVariantFile(id, form)
 * 经 useHeroForm 形态状态取当前版（女性=defaultFile，男性=variants 中非 defaultFile 项）；
 * CalibrateView 据此把这些 id 排除出「裸名可渲染列」。返回 { [id]: string[] }（下载顺序）。
 */
export const HERO_GENDER_VARIANTS = (() => {
  const p = path.resolve('src/data/hero-gender-variants.json')
  if (!fs.existsSync(p)) return {}
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'))
  return Object.fromEntries(Object.entries(raw).map(([id, v]) => [id, v.variants]))
})()

/* ---------- 名录读取 ---------- */

function readDict(file) {
  const merged = {}
  for (const ver of VERSIONS) {
    const p = path.join(DATA, ver, file)
    if (!fs.existsSync(p)) continue
    Object.assign(merged, JSON.parse(fs.readFileSync(p, 'utf8')))
  }
  return merged
}

function stripExt(name) {
  return String(name).replace(/\.(png|webp)$/i, '')
}

/**
 * 产出全部待处理资产条目（去重、按类别稳定顺序）。
 * 这是「站点运行时可能请求哪些图标」的唯一推导处：
 * 下载按它补缺，校验按它比对本地与远端。
 */
export function collectIcons() {
  /** @type {{cat:string,file:string,remote:string,optionalLocal:boolean}[]} */
  const out = []
  const seen = new Set()
  const push = (cat, file, remote = file, optionalLocal = false) => {
    const key = `${cat}/${file}`
    if (!file || seen.has(key)) return
    seen.add(key)
    out.push({ cat, file, remote, optionalLocal })
  }

  const charDict = readDict('character.json')
  // 名录 icon（四类）
  for (const v of Object.values(charDict)) if (v?.icon) push('character', stripExt(v.icon))
  for (const [file, cat] of [['weapon.json', 'weapon'], ['bangboo.json', 'bangboo'], ['equipment.json', 'disc']]) {
    for (const v of Object.values(readDict(file))) if (v?.icon) push(cat, stripExt(v.icon))
  }
  // 皮肤缩略图（默认不本地化，但远程可达性仍在审计范围）
  for (const ver of VERSIONS) {
    const base = path.join(DATA, ver, 'zh', 'character')
    if (!fs.existsSync(base)) continue
    for (const f of fs.readdirSync(base)) {
      const d = JSON.parse(fs.readFileSync(path.join(base, f), 'utf8'))
      for (const s of Object.values(d.skin || {})) {
        if (s?.image) push('skin', stripExt(s.image), stripExt(s.image), !SKIN_LOCAL)
      }
    }
  }
  // 技能键位（含富文本动态引用；别名换 CDN 真实名）
  for (const a of SKILL_ASSETS) push('skill', a, SKILL_ASSET_ALIAS[a] ?? a)
  // 筛选图标（属性/职业/阵营）
  for (const a of FILTER_ASSETS) push('filter', a)
  // hero 头图：默认 Mindscape_{id}_2，双形态角色按 variants 全量形态
  for (const id of Object.keys(charDict)) {
    const files = HERO_GENDER_VARIANTS[id] ?? [`Mindscape_${id}_2`]
    for (const f of files) push('hero', f, f, true)
  }
  return out
}

/** 条目 → nanoka CDN 地址 */
export function cdnUrl(entry) {
  return `https://static.nanoka.cc/assets/zzz/${entry.remote}.webp`
}

/** 条目 → 本地落地路径 */
export function localPath(entry) {
  return path.join(IMG, entry.cat, `${entry.file}.webp`)
}
