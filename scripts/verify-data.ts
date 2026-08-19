/* ============================================================
 * verify-data.ts — 对 public/data/ 全量跑 zod 契约校验（DESIGN.md §5.1）。
 * 失败非零退出，可挂 CI。用法：npm run verify:data
 *
 * 依赖方向：校验脚本 → src/domain/schema（单向，禁止反向）。
 * schema 是 build 管线与前端的唯一契约事实源，此处直接 import
 * 保证校验的不是一份"过时的副本"。经 tsx 运行，无 bundle 开销。
 * ============================================================ */

import fs from 'node:fs/promises'
import path from 'node:path'
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

/** 数据版本目录（双版本：live 与 latest，manifest 在根） */
const VERSIONS = ['live', 'latest']

interface ErrorReport {
  file: string
  issues: string[]
}

const errors: ErrorReport[] = []

function check(file: string, data: unknown, schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: Array<{ path: (string | number)[]; message: string }> } } }): void {
  const result = schema.safeParse(data)
  if (!result.success) {
    errors.push({
      file,
      issues: result.error?.issues.map((i) => `${(i.path as unknown[]).join('.')}: ${i.message}`) ?? ['parse failed'],
    })
  }
}

async function readJson(rel: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(path.join(OUT, rel), 'utf8'))
}

async function main(): Promise<void> {
  // manifest（根） + 双版本名录/详情
  check('manifest.json', await readJson('manifest.json'), ManifestSchema)

  const listFiles: Array<[string, typeof CharacterListItemSchema]> = [
    ['character.json', CharacterListItemSchema],
    ['weapon.json', WEngineListItemSchema],
    ['bangboo.json', BangbooListItemSchema],
    ['equipment.json', DiskDriveListItemSchema],
  ]
  const detailDirs: Array<[string, typeof CharacterDetailSchema]> = [
    ['zh/character', CharacterDetailSchema],
    ['zh/weapon', WEngineDetailSchema],
    ['zh/bangboo', BangbooDetailSchema],
    ['zh/equipment', DiskDriveDetailSchema],
  ]
  let detailCount = 0
  for (const ver of VERSIONS) {
    for (const [file, schema] of listFiles) {
      const dict = (await readJson(path.join(ver, file))) as Record<string, unknown>
      const values = Object.values(dict)
      if (!values.length) {
        errors.push({ file: `${ver}/${file}`, issues: ['名单为空'] })
        continue
      }
      for (const v of values) check(path.join(ver, file), v, schema)
    }
    for (const [dir, schema] of detailDirs) {
      const files = await fs.readdir(path.join(OUT, ver, dir))
      for (const f of files) {
        if (!f.endsWith('.json')) continue
        detailCount++
        check(path.join(ver, dir, f), await readJson(path.join(ver, dir, f)), schema)
      }
    }
  }

  if (errors.length) {
    console.error(`✖ verify-data 失败：${errors.length} 个文件未通过契约校验`)
    for (const e of errors.slice(0, 20)) {
      console.error(`  - ${e.file}`)
      for (const i of e.issues.slice(0, 5)) console.error(`      · ${i}`)
    }
    process.exit(1)
  }
  console.log(`✓ verify-data 通过：manifest + ${VERSIONS.length} 版本名录 + ${detailCount} 详情 全部符合契约`)
}

main().catch((e: unknown) => {
  console.error('✖ verify-data 异常：', e)
  process.exit(1)
})