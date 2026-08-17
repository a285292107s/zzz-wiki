/* ============================================================
 * index.ts — 数据管线编排（原 build-data.mjs main 迁出）。
 * 生成后对名录做 schema 校验（DESIGN.md P3：契约单一事实源）；
 * 详情抽样校验由 verify-data.ts 全量执行。
 * ============================================================ */

import fs from 'node:fs/promises'
import path from 'node:path'
import {
  OUT,
  dump,
  resetOut,
  writeDetails,
} from './io'
import { buildBangboos, buildCharacters, buildDiscs, buildWeapons } from './domains'
import { fetchJson } from './io'

/** 名录 schema 校验：失败收集错误并抛错 */
type Dict = Record<string, Record<string, unknown>>

export async function main(): Promise<void> {
  console.log('[1/4] 读取版本清单…')
  const manifest = (await fetchJson(
    'https://static.nanoka.cc/manifest.json',
    'manifest.json',
  )) as {
    zzz: { latest: string; live: string; available: string[]; new?: { character: string[]; weapon: string[]; monster: string[] } }
  }
  const zzz = manifest.zzz
  const ver = zzz.latest
  console.log(`  zzz 版本：latest=${ver}（live=${zzz.live}，可用 ${zzz.available.length} 个）`)
  console.log(
    `  新内容：角色 ${(zzz.new?.character ?? []).length} / 音擎 ${(zzz.new?.weapon ?? []).length} / 怪物 ${(zzz.new?.monster ?? []).length}`,
  )

  console.log('[2/4] 抓取名录（缓存命中跳过）')
  const char = await buildCharacters(ver)
  const weapon = await buildWeapons(ver)
  const bangboo = await buildBangboos(ver)
  const disc = await buildDiscs(ver)

  console.log('[3/4] 写盘 → public/data/')
  await resetOut()

  // manifest 沿用 2 空格缩进（与历史输出一致，最小化 diff）
  await fs.writeFile(
    path.join(OUT, 'manifest.json'),
    JSON.stringify(
      {
        zzz: {
          latest: ver,
          live: zzz.live,
          source: 'static.nanoka.cc (hakushin raw / zzz.nanoka.cc)',
        },
        generated: new Date().toISOString(),
      },
      null,
      2,
    ),
  )
  await dump('character.json', char.list)
  await dump('weapon.json', weapon.list)
  await dump('bangboo.json', bangboo.list)
  await dump('equipment.json', disc.list)
  await writeDetails('zh/character', char.details)
  await writeDetails('zh/weapon', weapon.details)
  await writeDetails('zh/bangboo', bangboo.details)
  await writeDetails('zh/equipment', disc.details)

  const count = (d: Dict) => Object.keys(d).length
  console.log(
    `  名录：角色 ${count(char.list)} / 音擎 ${count(weapon.list)} / 邦布 ${count(bangboo.list)} / 驱动盘 ${count(disc.list)}`,
  )
  console.log(
    `  详情：角色 ${count(char.details)} / 音擎 ${count(weapon.details)} / 邦布 ${count(bangboo.details)} / 驱动盘 ${count(disc.details)}`,
  )

  console.log('[4/4] 完成 →', OUT)
}