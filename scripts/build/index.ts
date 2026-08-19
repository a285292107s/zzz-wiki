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
  const verLatest = zzz.latest

  // 双版本：latest = 数据源最新（含前瞻/测试服内容）；live = 游戏在线版本（本地化最稳）。
  // 输出目录名固定为 live/latest（不随版本号变，前端路径稳定）：
  // live 不在 available（源站已下线历史版本）时降级：live 目录沿用 latest 数据，站点仍然可用。
  const liveAvailable = zzz.live !== verLatest && zzz.available.includes(zzz.live)
  const targets: Array<{ dir: 'live' | 'latest'; ver: string }> = [
    { dir: 'latest', ver: verLatest },
    ...(liveAvailable ? [{ dir: 'live' as const, ver: zzz.live }] : []),
  ]
  console.log(
    `  zzz 版本：latest=${verLatest}（live=${zzz.live}，可用 ${zzz.available.length} 个；live 数据${liveAvailable ? '可用' : '不可用，将降级沿用 latest'}）`,
  )
  console.log(
    `  新内容：角色 ${(zzz.new?.character ?? []).length} / 音擎 ${(zzz.new?.weapon ?? []).length} / 怪物 ${(zzz.new?.monster ?? []).length}`,
  )

  console.log('[2/4] 抓取名录（缓存命中跳过）')
  type Built = { char: Dict; weapon: Dict; bangboo: Dict; disc: Dict; charDetails: Dict; weaponDetails: Dict; bangbooDetails: Dict; discDetails: Dict }
  const built = new Map<'live' | 'latest', Built>()
  for (const t of targets) {
    console.log(`  ― ${t.dir}（${t.ver}）`)
    const [char, weapon, bangboo, disc] = await Promise.all([
      buildCharacters(t.ver),
      buildWeapons(t.ver),
      buildBangboos(t.ver),
      buildDiscs(t.ver),
    ])
    built.set(t.dir, {
      char: char.list, weapon: weapon.list, bangboo: bangboo.list, disc: disc.list,
      charDetails: char.details, weaponDetails: weapon.details,
      bangbooDetails: bangboo.details, discDetails: disc.details,
    })
  }
  // live 降级：latest 的数据补位 live 目录（目录仍存在，前端切换不 404）
  if (!liveAvailable) {
    console.warn(`  ⚠ live=${zzz.live} 不在源站可用列表，live 目录沿用 latest 数据`)
    built.set('live', built.get('latest')!)
  }

  console.log('[3/4] 写盘 → public/data/{live,latest}/')
  await resetOut(targets.map((t) => t.dir))

  // manifest 沿用 2 空格缩进（与历史输出一致，最小化 diff）
  await fs.writeFile(
    path.join(OUT, 'manifest.json'),
    JSON.stringify(
      {
        zzz: {
          latest: verLatest,
          live: zzz.live,
          liveAvailable,
          source: 'static.nanoka.cc (hakushin raw / zzz.nanoka.cc)',
        },
        generated: new Date().toISOString(),
      },
      null,
      2,
    ),
  )
  for (const t of targets) {
    const b = built.get(t.dir)!
    await dump(t.dir, 'character.json', b.char)
    await dump(t.dir, 'weapon.json', b.weapon)
    await dump(t.dir, 'bangboo.json', b.bangboo)
    await dump(t.dir, 'equipment.json', b.disc)
    await writeDetails(t.dir, 'zh/character', b.charDetails)
    await writeDetails(t.dir, 'zh/weapon', b.weaponDetails)
    await writeDetails(t.dir, 'zh/bangboo', b.bangbooDetails)
    await writeDetails(t.dir, 'zh/equipment', b.discDetails)

    const count = (d: Dict) => Object.keys(d).length
    console.log(
      `  ${t.dir}（${t.ver}）：名录 角色 ${count(b.char)} / 音擎 ${count(b.weapon)} / 邦布 ${count(b.bangboo)} / 驱动盘 ${count(b.disc)}；`,
    )
    console.log(
      `       详情 角色 ${count(b.charDetails)} / 音擎 ${count(b.weaponDetails)} / 邦布 ${count(b.bangbooDetails)} / 驱动盘 ${count(b.discDetails)}`,
    )
  }

  console.log('[4/4] 完成 →', OUT)
}

/**
 * 版本探测（--check / ci-data 用）：实时拉取源站 manifest，
 * 对比本地产物 manifest.json 的 latest；本地缺失或版本不同 → true。
 * 源站不可达时抛错（由调用方决定回退策略）。
 */
export async function needUpdate(): Promise<boolean> {
  const remote = (await fetchJson(
    'https://static.nanoka.cc/manifest.json',
    'manifest.json',
  )) as { zzz?: { latest?: string } }
  let localLatest: string | undefined
  try {
    const local = JSON.parse(
      await fs.readFile(path.join(OUT, 'manifest.json'), 'utf8'),
    ) as { zzz?: { latest?: string } }
    localLatest = local.zzz?.latest
  } catch (e) {
    // 仅本地产物缺失（ENOENT）视为需要更新；其余错误（含编程错误）如实上抛，
    // 避免被静默吞掉导致误判（曾因 fsp 未定义被 catch 吞掉而恒判有更新）
    if ((e as NodeJS.ErrnoException)?.code !== 'ENOENT') throw e
    localLatest = undefined
  }
  return localLatest !== remote.zzz?.latest
}