/* ============================================================
 * index.ts — 数据管线编排（原 build-data.mjs main 迁出）。
 * 生成后对名录做 schema 校验（DESIGN.md P3：契约单一事实源）；
 * 详情抽样校验由 verify-data.ts 全量执行。
 *
 * 合规约定（2026-08）：站点只发布**正式服（live）**数据，
 * 不产出 latest（源站最新/含前瞻·测试服内容）数据。
 * ============================================================ */

import fs from 'node:fs/promises'
import path from 'node:path'
import {
  OUT,
  dump,
  resetOut,
  writeDetails,
} from './io'
import { buildBangboos, buildCharacters, buildDiscs, buildWeapons, loadNoun, nounToTerms } from './domains'
import { resolveTerms } from './normalize'
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
  const ver = zzz.live

  // 单版本：live = 游戏在线版本（正式服内容）。输出目录名固定为 live（不随版本号变，前端路径稳定）。
  // 合规约束：绝不以 latest（含前瞻/测试服内容）补位或降级——live 不在源站可用列表时直接失败，
  // 由调用方（ci-data）回退仓库内既有合规模数据，保证测试服数据永不流入站点。
  if (!ver) throw new Error('manifest.json 缺 zzz.live（源站 schema 变更？），拒绝构建')
  if (!Array.isArray(zzz.available)) {
    throw new Error('manifest.json 缺 zzz.available 列表（源站 schema 变更？），拒绝构建')
  }
  if (!zzz.available.includes(ver)) {
    throw new Error(
      `live=${ver} 不在源站可用列表（available: ${zzz.available.join(', ')}）；` +
        '为合规不降级取 latest，请人工确认源站 live 版本后重试',
    )
  }
  console.log(`  zzz live（正式服）版本：${ver}（latest=${zzz.latest} 仅作源站参考，不产出）`)
  console.log(
    `  源站 new 内容（本次不消费）：角色 ${(zzz.new?.character ?? []).length} / 音擎 ${(zzz.new?.weapon ?? []).length} / 怪物 ${(zzz.new?.monster ?? []).length}`,
  )

  console.log('[2/4] 抓取名录（缓存命中跳过）')
  type Built = { char: Dict; weapon: Dict; bangboo: Dict; disc: Dict; noun: Record<string, Record<string, unknown>>; charDetails: Dict; weaponDetails: Dict; bangbooDetails: Dict; discDetails: Dict }
  const noun = await loadNoun(ver)
  const terms = nounToTerms(noun)
  const [char, weapon, bangboo, disc] = await Promise.all([
    buildCharacters(ver, terms),
    buildWeapons(ver, terms),
    buildBangboos(ver, terms),
    buildDiscs(ver, terms),
  ])
  const b: Built = {
    char: char.list, weapon: weapon.list, bangboo: bangboo.list, disc: disc.list,
    // 名词表 desc 同样解析 <Term:N>（保留 ID 外壳），浮层内引用的其他术语也显示名
    noun: resolveTerms(noun, terms) as Record<string, Record<string, unknown>>,
    charDetails: char.details, weaponDetails: weapon.details,
    bangbooDetails: bangboo.details, discDetails: disc.details,
  }

  console.log('[3/4] 写盘 → public/data/live/')
  await resetOut(['live'])

  // manifest 沿用 2 空格缩进（与历史输出一致，最小化 diff）
  await fs.writeFile(
    path.join(OUT, 'manifest.json'),
    JSON.stringify(
      {
        zzz: {
          live: ver,
          source: 'static.nanoka.cc (hakushin raw / zzz.nanoka.cc)',
        },
        generated: new Date().toISOString(),
      },
      null,
      2,
    ),
  )
  await dump('live', 'character.json', b.char)
  await dump('live', 'weapon.json', b.weapon)
  await dump('live', 'bangboo.json', b.bangboo)
  await dump('live', 'equipment.json', b.disc)
  await dump('live', 'noun.json', b.noun)
  await writeDetails('live', 'zh/character', b.charDetails)
  await writeDetails('live', 'zh/weapon', b.weaponDetails)
  await writeDetails('live', 'zh/bangboo', b.bangbooDetails)
  await writeDetails('live', 'zh/equipment', b.discDetails)

  const count = (d: Dict) => Object.keys(d).length
  console.log(
    `  live（${ver}）：名录 角色 ${count(b.char)} / 音擎 ${count(b.weapon)} / 邦布 ${count(b.bangboo)} / 驱动盘 ${count(b.disc)}；`,
  )
  console.log(
    `       详情 角色 ${count(b.charDetails)} / 音擎 ${count(b.weaponDetails)} / 邦布 ${count(b.bangbooDetails)} / 驱动盘 ${count(b.discDetails)}`,
  )

  console.log('[4/4] 完成 →', OUT)
}

/**
 * 版本探测（--check / ci-data 用）：实时拉取源站 manifest，
 * 对比本地产物 manifest.json 的 live；本地缺失或版本不同 → true。
 * 源站不可达时抛错（由调用方决定回退策略）。
 */
export async function needUpdate(): Promise<boolean> {
  const remote = (await fetchJson(
    'https://static.nanoka.cc/manifest.json',
    'manifest.json',
  )) as { zzz?: { live?: string } }
  let localLive: string | undefined
  try {
    const local = JSON.parse(
      await fs.readFile(path.join(OUT, 'manifest.json'), 'utf8'),
    ) as { zzz?: { live?: string } }
    localLive = local.zzz?.live
  } catch (e) {
    // 仅本地产物缺失（ENOENT）视为需要更新；其余错误（含编程错误）如实上抛，
    // 避免被静默吞掉导致误判（曾因 fsp 未定义被 catch 吞掉而恒判有更新）
    if ((e as NodeJS.ErrnoException)?.code !== 'ENOENT') throw e
    localLive = undefined
  }
  return localLive !== remote.zzz?.live
}