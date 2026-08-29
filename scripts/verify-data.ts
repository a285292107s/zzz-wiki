/* ============================================================
 * verify-data.ts — 对 public/data/ 全量做「契约 + 完整性」校验（DESIGN.md §5.1）。
 * 失败非零退出，可挂 CI。用法：npm run verify:data
 *
 * 契约：对 manifest + 各版本名录/详情跑 zod schema（src/domain/schema）；
 * 完整性：名录 id ↔ 详情文件一一对应（防「单详情拉取失败被静默带上 → 名录有、详情 404」）。
 * 兼容说明：契约失败视为错误（阻断）；详情孤儿（无名录对应）仅告警不阻断。
 *
 * 依赖方向：校验脚本 → src/domain/schema（单向，禁止反向）。
 * schema 是 build 管线与前端的唯一契约事实源，此处直接 import
 * 保证校验的不是一份"过时的副本"。经 tsx 运行，无 bundle 开销。
 * ============================================================ */

import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  BangbooDetailSchema,
  BangbooListItemSchema,
  CharacterDetailSchema,
  CharacterListItemSchema,
  DiskDriveDetailSchema,
  DiskDriveListItemSchema,
  ManifestSchema,
  WEngineDetailSchema,
  WEngineListItemSchema,
} from '../src/domain/schema'

const OUT = path.resolve(import.meta.dirname ?? process.cwd(), '..', 'public', 'data')

/** 数据版本目录（单版本：live = 正式服，manifest 在根） */
const VERSIONS = ['live']

interface ErrorReport {
  file: string
  issues: string[]
}

const errors: ErrorReport[] = []

/** 各名录/详情 schema 的最小结构面（具体 zod schema 形状各异，校验只依赖 safeParse） */
interface SchemaLike {
  safeParse: (v: unknown) => {
    success: boolean
    error?: { issues: Array<{ path: (string | number)[]; message: string }> }
  }
}

function check(file: string, data: unknown, schema: SchemaLike): void {
  const result = schema.safeParse(data)
  if (!result.success) {
    errors.push({
      file,
      issues: result.error?.issues.map((i) => `${(i.path as unknown[]).join('.')}: ${i.message}`) ?? ['parse failed'],
    })
  }
}

/** 语义校验：角色核心技强化（extra_level）累计值必须单调不减（回退 = 数据异常）。
 *  与前端 buildCoreEnhance（src/domain/sections.ts）的差值口径一致：
 *  同值（无新增）允许，回退会导致前端静默丢档，故前置为构建告警。 */
function checkEnhanceMonotonic(rel: string, detail: Record<string, unknown>): void {
  const ed = detail.extra_level
  if (!ed || typeof ed !== 'object') return
  const prev = new Map<number, number>() // 属性码 → 上一档累计值
  for (const [rank, raw] of Object.entries(ed as Record<string, unknown>)) {
    const o = (raw ?? {}) as Record<string, unknown>
    for (const e of Object.values((o.extra ?? {}) as Record<string, unknown>)) {
      const p = (e ?? {}) as { prop?: unknown; name?: unknown; value?: unknown }
      const prop = Number(p.prop)
      if (!Number.isFinite(prop)) continue // 缺属性码的条目不判级（由 zod 契约面把控）
      const value = Number(p.value) || 0
      const last = prev.get(prop)
      if (last != null && value < last) {
        errors.push({
          file: rel,
          issues: [`extra_level 回退：prop ${prop}（${String(p.name ?? '')}）第 ${rank} 档 ${value} < 上一档 ${last}（累计值必须单调不减）`],
        })
        return
      }
      prev.set(prop, value)
    }
  }
}

async function readJson(rel: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(path.join(OUT, rel), 'utf8'))
}

/** 名录文件名 → 详情目录（显式映射，单一事实源；不做隐式命名约定，避免「键错位 → 完整性校验被静默跳过」） */
const LIST_TO_DETAIL: Record<string, string> = {
  'character.json': 'zh/character',
  'weapon.json': 'zh/weapon',
  'bangboo.json': 'zh/bangboo',
  'equipment.json': 'zh/equipment',
}

/** 断言 listFiles / detailDirs 与 LIST_TO_DETAIL 完全一一对应；不一致即抛错（宁可失败也不静默漏校验）。 */
function assertCategoryPairs(
  listFiles: Array<[string, SchemaLike]>,
  detailDirs: Array<[string, SchemaLike]>,
): void {
  const files = new Set(listFiles.map(([f]) => f))
  const dirs = new Set(detailDirs.map(([d]) => d))
  const mappedFiles = new Set(Object.keys(LIST_TO_DETAIL))
  const mappedDirs = new Set(Object.values(LIST_TO_DETAIL))
  const mismatch =
    [...files].some((f) => !mappedFiles.has(f)) ||
    [...mappedFiles].some((f) => !files.has(f)) ||
    [...dirs].some((d) => !mappedDirs.has(d)) ||
    [...mappedDirs].some((d) => !dirs.has(d))
  if (mismatch) {
    throw new Error(
      `verify-data: LIST_TO_DETAIL 与 listFiles/detailDirs 不一致（files=${[...files].join(', ')}；dirs=${[...dirs].join(', ')}）`,
    )
  }
}

/** 校验入口，返回退出码（0 通过）：CI 调用方（sync-data）可进程内 await，
 *  不再经 npx tsx 子进程（npx 本身故障会被误报成"契约未通过"）。 */
export async function verifyDataMain(): Promise<number> {
  // manifest（根） + live（正式服）名录/详情
  check('manifest.json', await readJson('manifest.json'), ManifestSchema)

  const listFiles: Array<[string, SchemaLike]> = [
    ['character.json', CharacterListItemSchema],
    ['weapon.json', WEngineListItemSchema],
    ['bangboo.json', BangbooListItemSchema],
    ['equipment.json', DiskDriveListItemSchema],
  ]
  const detailDirs: Array<[string, SchemaLike]> = [
    ['zh/character', CharacterDetailSchema],
    ['zh/weapon', WEngineDetailSchema],
    ['zh/bangboo', BangbooDetailSchema],
    ['zh/equipment', DiskDriveDetailSchema],
  ]
  assertCategoryPairs(listFiles, detailDirs) // 映射一致性即抛错，防静默漏校验
  let detailCount = 0
  /** 类别 → 名录 id 集合 / 详情文件 id 集合（完整性交叉校验用） */
  const rosterIds: Record<string, Set<string>> = {}
  const detailIds: Record<string, Set<string>> = {}
  for (const ver of VERSIONS) {
    for (const [file, schema] of listFiles) {
      const dir = LIST_TO_DETAIL[file]
      const dict = (await readJson(path.join(ver, file))) as Record<string, unknown>
      const values = Object.values(dict)
      if (!values.length) {
        errors.push({ file: `${ver}/${file}`, issues: ['名单为空'] })
        continue
      }
      for (const v of values) check(path.join(ver, file), v, schema)
      rosterIds[dir] = new Set(Object.keys(dict))
    }
    for (const [dir, schema] of detailDirs) {
      const files = await fs.readdir(path.join(OUT, ver, dir))
      detailIds[dir] = new Set(files.filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')))
      for (const f of files) {
        if (!f.endsWith('.json')) continue
        detailCount++
        const rel = path.join(ver, dir, f)
        const detail = (await readJson(rel)) as Record<string, unknown>
        check(rel, detail, schema)
        if (dir.endsWith('character')) {
          checkEnhanceMonotonic(rel, detail)
        }
      }
    }
    // 完整性：名录 id ↔ 详情文件 一一对应。防「单详情拉取失败被静默带上 → 名录有、详情 404」的破快照；
    // 名录有 id 却缺详情 = 阻塞（门禁拒绝，不提交）；详情孤儿（无名录对应）仅告警不阻断。
    for (const [file] of listFiles) {
      const dir = LIST_TO_DETAIL[file]
      const r = rosterIds[dir]
      const d = detailIds[dir]
      if (!r || !d) continue // 名录/详情为空已由「名单为空」等分支报告
      const missing = [...r].filter((id) => !d.has(id))
      const orphan = [...d].filter((id) => !r.has(id))
      if (missing.length) {
        errors.push({
          file: `${ver}/${file}↔${dir}`,
          issues: [
            `名录含 ${missing.length} 个 id 缺对应详情文件：${missing.slice(0, 10).join(', ')}${missing.length > 10 ? '…' : ''}`,
          ],
        })
      }
      if (orphan.length) {
        console.warn(
          `⚠ [${ver}/${file}↔${dir}] ${orphan.length} 个详情文件无名录对应（孤儿，不阻断）：${orphan.slice(0, 10).join(', ')}`,
        )
      }
    }
  }

  if (errors.length) {
    console.error(`✖ verify-data 失败：${errors.length} 个文件未通过契约校验`)
    for (const e of errors.slice(0, 20)) {
      console.error(`  - ${e.file}`)
      for (const i of e.issues.slice(0, 5)) console.error(`      · ${i}`)
    }
    return 1
  }
  console.log(`✓ verify-data 通过：manifest + ${VERSIONS.length} 版本名录 + ${detailCount} 详情（契约 + 完整性）全部通过`)
  return 0
}

/** 直接以 CLI 运行时才自动执行并设退出码；被 sync-data import 时由调用方决定流程。 */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyDataMain()
    .then((code) => {
      if (code) process.exit(code)
    })
    .catch((e: unknown) => {
      console.error('✖ verify-data 异常：', e)
      process.exit(1)
    })
}