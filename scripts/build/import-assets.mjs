import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'
import { collectIcons, localPath } from './icon-inventory.mjs'
import { toWebp } from './to-webp.mjs'

const DUMP_SPRITE = 'ui/Sprite'
const DUMP_ASSETS = 'ui/Assets/NapResources'
const MANIFEST = path.resolve('scripts/build/dump-import-manifest.json')

const RULES = {
  character: { quality: 90, maxLongEdge: 0 },
  skin: { quality: 82, maxLongEdge: 1600 },
  weapon: { quality: 90, maxLongEdge: 0 },
  'weapon-art': { quality: 85, maxLongEdge: 0 },
  'bangboo-art': { quality: 85, maxLongEdge: 0 },
  bangboo: { quality: 90, maxLongEdge: 0 },
  disc: { quality: 90, maxLongEdge: 0 },
  filter: { quality: 92, maxLongEdge: 0 },
  skill: { quality: 92, maxLongEdge: 0 },
  hero: { quality: 90, maxLongEdge: 0 },
  awaken: { quality: 88, maxLongEdge: 1600 },
}

const SKILL_ALIAS = {
  Icon_Normal: 'IconRoleSkillKeyNormal',
  Icon_Evade: 'IconRoleSkillKeyEvade',
  Icon_Special: 'IconRoleSkillKeySpecial',
  Icon_QTE: 'IconRoleSkillKeyQTE',
  Icon_Switch: 'IconRoleSkillKeySwitch',
  Icon_JoyStick: 'IconRoleSkillKeyJoyStick',
  Icon_UltimateReady: 'IconRoleSkillKeyUltimateV2',
  Icon_SpecialReady: 'IconRoleSkillKeySpecialV2',
  Icon_SpecialReady_Rp: 'IconRoleSkillKeySpecialV3_02',
}

const ALIAS = { skill: SKILL_ALIAS }

const SOURCE_OVERRIDES = {
  filter: {
    IconPhysical: 'ui/Sprite/IconBuff_Chaos.png',
    IconFire: 'ui/Assets/NapResources/UI/Sprite/A1DynamicLoad/IconGeneralBuff/Packer/IconFire.png',
    IconIce: 'ui/Assets/NapResources/UI/Sprite/A1DynamicLoad/IconRamenType/UnPacker/IconIce.png',
    IconElectric: 'ui/Sprite/IconBuff_Electric.png',
    IconWind: 'ui/Assets/NapResources/UI/Sprite/A1DynamicLoad/IconGeneralBuff/Packer/IconWind.png',
    IconEther: 'ui/Sprite/IconBuff_Erosion.png',
    IconLumen: 'ui/Sprite/IconBuff_Lumiflux.png',
    IconStun: 'ui/Assets/NapResources/UI/Sprite/A1DynamicLoad/Role/IconClass/Packer/IconStun.png',
    IconAnomaly: 'ui/Assets/NapResources/UI/Sprite/A1DynamicLoad/Role/IconClass/Packer/IconAnomaly.png',
    IconSupport: 'ui/Assets/NapResources/UI/Sprite/A1DynamicLoad/Role/IconClass/Packer/IconSupport.png',
    IconDefense: 'ui/Assets/NapResources/UI/Sprite/A1DynamicLoad/Role/IconClass/Packer/IconDefense.png',
    IconRupture: 'ui/Assets/NapResources/UI/Sprite/A1DynamicLoad/Role/IconClass/Packer/IconRupture.png',
    IconAttack: 'ui/Assets/NapResources/UI/Sprite/A1DynamicLoad/Role/IconClass/Packer/IconAttack.png',
    IconArmorer: 'ui/Assets/NapResources/UI/Sprite/A1DynamicLoad/Role/IconClass/Packer/IconArmorer.png',
  },
  weapon: {
    Weapon_S_1581: 'ui/Assets/NapResources/UI/Sprite/A1DynamicLoad/IconWeapon/UnPacker/Weapon_S_1581.png',
    Weapon_S_1591: 'ui/Assets/NapResources/UI/Sprite/A1DynamicLoad/IconWeapon/UnPacker/Weapon_S_1591.png',
  },
}

const VERIFY_CATS = new Set(['filter', 'skill'])

const TRIM_LEFT = { 'awaken/EF_BG': 0.0575 }

const EXTRA = [{ cat: 'character', file: 'IconRoleCircle01', skin: false }]

const DEFAULT_SKIP = []
const DEFAULT_MAX_DIFF = 14
const CONCURRENCY = 4

function ruleSignature(rule, trimLeft) {
  return `q${rule.quality}|e${rule.maxLongEdge}|t${trimLeft}`
}

export function isFresh(done, { srcRel, srcSize, sig }) {
  if (!done) return false
  if (done.src !== srcRel || done.bytes !== srcSize) return false
  return done.rule === undefined || done.rule === sig
}

function walk(dir, depth, index) {
  if (depth > 7) return
  let list
  try {
    list = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const d of list) {
    const p = path.join(dir, d.name)
    if (d.isDirectory()) walk(p, depth + 1, index)
    else if (d.name.toLowerCase().endsWith('.png')) {
      const base = d.name.slice(0, -4)
      if (!index.has(base)) index.set(base, p)
    }
  }
}

export function buildDumpIndex(dumpDir) {
  const index = new Map()
  walk(path.join(dumpDir, DUMP_SPRITE), 0, index)
  walk(path.join(dumpDir, DUMP_ASSETS), 0, index)
  return index
}

export async function similarity(localFile, sourceFile) {
  const box = { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }
  const [a, b] = await Promise.all(
    [localFile, sourceFile].map(async (p) =>
      sharp(p).trim().resize(96, 96, box).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    ),
  )
  let sum = 0
  let n = 0
  for (let i = 0; i < a.data.length; i += 4) {
    if (a.data[i + 3] < 16 && b.data[i + 3] < 16) continue
    sum +=
      (Math.abs(a.data[i] - b.data[i]) +
        Math.abs(a.data[i + 1] - b.data[i + 1]) +
        Math.abs(a.data[i + 2] - b.data[i + 2])) /
      3
    n++
  }
  return n ? sum / n : 0
}

export function parseArgs(argv = process.argv.slice(2)) {
  const norm = []
  for (const a of argv) {
    if (a.startsWith('--') && a.includes('=')) {
      const i = a.indexOf('=')
      norm.push(a.slice(0, i), a.slice(i + 1))
    } else norm.push(a)
  }
  const args = {
    dump: process.env.ZZZ_TEXTURES_DIR ?? '',
    dry: false,
    force: false,
    verify: true,
    maxDiff: DEFAULT_MAX_DIFF,
    only: [],
    quality: null,
    maxLongEdge: null,
  }
  for (let i = 0; i < norm.length; i++) {
    const a = norm[i]
    if (a === '--dump') args.dump = argv[++i] ?? ''
    else if (a === '--dry') args.dry = true
    else if (a === '--force') args.force = true
    else if (a === '--no-verify') args.verify = false
    else if (a === '--max-diff') args.maxDiff = Number(argv[++i]) || DEFAULT_MAX_DIFF
    else if (a === '--only') args.only = String(argv[++i] ?? '').split(',').filter(Boolean)
    else if (a === '--quality') args.quality = Number(argv[++i]) || null
    else if (a === '--max-edge') args.maxLongEdge = Number(argv[++i]) || 0
  }
  return args
}

function ruleFor(cat) {
  return RULES[cat] ?? RULES.character
}

function srcKey(entry) {
  const alias = ALIAS[entry.cat]?.[entry.file]
  return alias ?? entry.file
}

function catOf(entry) {
  return entry.skin ? 'skin' : entry.cat
}

export async function importAssets({
  dump,
  dry = false,
  force = false,
  verify = true,
  maxDiff = DEFAULT_MAX_DIFF,
  only = [],
  quality = null,
  maxLongEdge = null,
} = {}) {
  if (!dump || !fs.existsSync(dump)) {
    throw new Error(`解包目录不可用：${dump || '(未指定)'}；用 --dump 或 ZZZ_TEXTURES_DIR 指定`)
  }
  const index = buildDumpIndex(dump)
  const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {}

  const selected = (cat) => !only.length || only.includes(cat)
  const all = [...collectIcons(), ...EXTRA]
  const entries = all.filter((e) => {
    const c = catOf(e)
    return selected(c) && !DEFAULT_SKIP.includes(c)
  })

  const jobs = []
  const missing = []
  const mismatched = []
  let fresh = 0

  for (const e of entries) {
    const cat = catOf(e)
    const override = SOURCE_OVERRIDES[e.cat]?.[e.file]
    const src = override ? path.join(dump, override) : index.get(srcKey(e))
    if (!src) {
      missing.push(`${cat}/${e.file}`)
      continue
    }
    const dest = localPath(e)
    const srcSize = fs.statSync(src).size
    const srcRel = path.relative(dump, src).split(path.sep).join('/')
    const rule = ruleFor(cat)
    const sig = ruleSignature(
      {
        quality: quality ?? rule.quality,
        maxLongEdge: maxLongEdge ?? rule.maxLongEdge,
      },
      TRIM_LEFT[`${cat}/${e.file}`] ?? 0,
    )
    if (!force && fs.existsSync(dest) && isFresh(manifest[e.file], { srcRel, srcSize, sig })) {
      fresh++
      continue
    }
    jobs.push({ entry: e, cat, src, dest, srcSize, srcRel, sig, trusted: Boolean(override) })
  }

  if (dry) {
    console.log(`== 解包资产导入差集（--dry）==  已同步 ${fresh} · 待处理 ${jobs.length}`)
    for (const j of jobs) console.log(`  + ${j.cat}/${j.entry.file}`)
    for (const m of missing) console.log(`  ⚠ 解包无源：${m}`)
    return { dry: true, fresh, pending: jobs.length, done: 0, mismatch: 0, missing, bytes: 0 }
  }

  let done = 0
  let bytes = 0
  const failed = []
  const queue = [...jobs]

  async function worker() {
    while (queue.length) {
      const job = queue.shift()
      try {
        if (verify && !job.trusted && (VERIFY_CATS.has(job.cat) || process.argv.includes('--verify-all')) && fs.existsSync(job.dest)) {
          const diff = await similarity(job.dest, job.src)
          if (diff > maxDiff) {
            mismatched.push(`${job.cat}/${job.entry.file}（差异 ${diff.toFixed(0)}）`)
            continue
          }
        }
        const rule = ruleFor(job.cat)
        const buffer = await toWebp(job.src, {
          quality: quality ?? rule.quality,
          maxLongEdge: maxLongEdge ?? rule.maxLongEdge,
          trimLeft: TRIM_LEFT[`${job.cat}/${job.entry.file}`] ?? 0,
        })
        fs.mkdirSync(path.dirname(job.dest), { recursive: true })
        fs.writeFileSync(job.dest, buffer)
        manifest[job.entry.file] = {
          cat: job.cat,
          src: job.srcRel,
          bytes: job.srcSize,
          rule: job.sig,
        }
        done++
        bytes += buffer.length
        if (done % 50 === 0) console.log(`  ✓ ${done}/${jobs.length}…`)
      } catch (e) {
        failed.push(`${job.entry.file}: ${e.message}`)
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, Math.max(1, jobs.length)) }, worker))

  if (done) {
    const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)))
    fs.writeFileSync(MANIFEST, JSON.stringify(sorted, null, 1) + '\n')
  }

  console.log(`\n== 解包资产导入 ==`)
  console.log(
    `清单 ${entries.length}，已同步 ${fresh}，本次导入 ${done}，解包无源 ${missing.length}，同名异物跳过 ${mismatched.length}，失败 ${failed.length}`,
  )
  for (const m of missing) console.log(`  ⚠ 解包无源：${m}`)
  for (const m of mismatched) console.log(`  ⚠ 同名异物（未替换）：${m}`)
  for (const f of failed) console.log(`  ✖ ${f}`)
  console.log(`ASSETS_IMPORTED done=${done} fresh=${fresh} missing=${missing.length} mismatch=${mismatched.length} bytes=${bytes}`)
  return { dry: false, fresh, pending: 0, done, mismatch: mismatched.length, missing, failed, bytes }
}

async function main() {
  const args = parseArgs()
  const r = await importAssets(args)
  if (r.missing?.length || r.mismatch) process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error('[import-assets]', e.message)
    process.exit(1)
  })
}
