/* ============================================================
 * verify-data.ts — 对 public/data/ 全量跑 zod 契约校验（DESIGN.md §5.1）。
 * 失败非零退出，可挂 CI。用法：npm run verify:data
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
  // manifest + 名录
  check('manifest.json', await readJson('manifest.json'), ManifestSchema)

  const listFiles: Array<[string, typeof CharacterListItemSchema]> = [
    ['character.json', CharacterListItemSchema],
    ['weapon.json', WEngineListItemSchema],
    ['bangboo.json', BangbooListItemSchema],
    ['equipment.json', DiskDriveListItemSchema],
  ]
  for (const [file, schema] of listFiles) {
    const dict = (await readJson(file)) as Record<string, unknown>
    const values = Object.values(dict)
    if (!values.length) {
      errors.push({ file, issues: ['名单为空'] })
      continue
    }
    for (const v of values) check(file, v, schema)
  }

  // 详情（全量）
  const detailDirs: Array<[string, typeof CharacterDetailSchema]> = [
    ['zh/character', CharacterDetailSchema],
    ['zh/weapon', WEngineDetailSchema],
    ['zh/bangboo', BangbooDetailSchema],
    ['zh/equipment', DiskDriveDetailSchema],
  ]
  let detailCount = 0
  for (const [dir, schema] of detailDirs) {
    const files = await fs.readdir(path.join(OUT, dir))
    for (const f of files) {
      if (!f.endsWith('.json')) continue
      detailCount++
      check(path.join(dir, f), await readJson(path.join(dir, f)), schema)
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
  console.log(`✓ verify-data 通过：manifest + 4 名录 + ${detailCount} 详情 全部符合契约`)
}

main().catch((e: unknown) => {
  console.error('✖ verify-data 异常：', e)
  process.exit(1)
})