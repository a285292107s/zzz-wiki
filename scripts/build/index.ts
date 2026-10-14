/* ============================================================
 * index.ts — 数据管线编排（原 build-data.mjs main 迁出）。
 * 生成后对名录做 schema 校验（DESIGN.md P3：契约单一事实源）；
 * 详情抽样校验由 verify-data.ts 全量执行。
 *
 * 合规约定（2026-08）：站点只发布**正式服（live）**数据，
 * 不产出 latest（源站最新/含前瞻·测试服内容）数据。
 *
 * 多语言（2026-10，ADR-004 落地）：`live/` 下按语言各一套完整数据面
 *   live/{lang}/character.json …（名录）  live/{lang}/noun.json（术语词典）
 *   live/{lang}/{dir}/{id}.json（详情）
 * 根下只留 manifest.json（版本元信息，与语言无关）。
 * ============================================================ */

import fs from 'node:fs/promises'
import path from 'node:path'
import { OUT, dump, resetOut, writeDetails, pruneStaleCache, fetchJson } from './io'
import {
  buildBangboos,
  buildCharacters,
  buildDiscs,
  buildWeapons,
  loadNouns,
  nounToTerms,
  type ByLang,
} from './domains'
import { resolveTerms, type TermNames } from './normalize'
import { resolveLiveTarget } from './live-target'
import { LANGS } from '../../src/domain/lang'

type Dict = Record<string, Record<string, unknown>>

/** 四类目：名录文件名 → 详情目录（两处命名不同，故显式成对；verify-data 用同一份口径） */
const CATEGORIES = [
  { list: 'character.json', dir: 'character' },
  { list: 'weapon.json', dir: 'weapon' },
  { list: 'bangboo.json', dir: 'bangboo' },
  { list: 'equipment.json', dir: 'equipment' },
] as const

type Category = (typeof CATEGORIES)[number]['dir']

export async function main(): Promise<void> {
  console.log('[1/4] 读取版本清单…')
  const manifest = (await fetchJson(
    'https://static.nanoka.cc/manifest.json',
    'manifest.json',
  )) as {
    zzz: { latest: string; live: string; available: string[]; new?: { character: string[]; weapon: string[]; monster: string[] } }
  }
  const zzz = manifest.zzz
  // 单版本：live = 游戏在线版本（正式服内容）。输出目录名固定为 live（不随版本号变，前端路径稳定）。
  // 合规约束（resolveLiveTarget，见 live-target.ts 单测）：绝不以 latest（含前瞻/测试服内容）补位或
  // 降级——live 缺失/不在源站可用列表时直接失败，由调用方（sync-data）判定失败则不提交、沿用仓库内既有合规模数据。
  const ver = resolveLiveTarget(zzz)
  console.log(`  zzz live（正式服）版本：${ver}（latest=${zzz.latest} 仅作源站参考，不产出）`)
  console.log(
    `  源站 new 内容（本次不消费）：角色 ${(zzz.new?.character ?? []).length} / 音擎 ${(zzz.new?.weapon ?? []).length} / 怪物 ${(zzz.new?.monster ?? []).length}`,
  )
  console.log(`  语言：${LANGS.join(' / ')}（各语言一套名录 + 详情 + 术语词典）`)

  console.log(`[2/4] 抓取名录与 ${LANGS.length} 语详情（缓存命中跳过）`)
  const nounByLang = await loadNouns(ver)
  const termsByLang = Object.fromEntries(
    LANGS.map((lang) => [lang, nounToTerms(nounByLang[lang])]),
  ) as ByLang<TermNames>

  const [char, weapon, bangboo, disc] = await Promise.all([
    buildCharacters(ver, termsByLang),
    buildWeapons(ver, termsByLang),
    buildBangboos(ver, termsByLang),
    buildDiscs(ver, termsByLang),
  ])
  const built: Record<Category, ByLang<{ list: Dict; details: Dict }>> = {
    character: char,
    weapon,
    bangboo,
    equipment: disc,
  }

  console.log(`[3/4] 写盘 → public/data/live/{${LANGS.join(',')}}/`)
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

  for (const lang of LANGS) {
    // 名词表 desc 同样解析 <Term:N>（保留 ID 外壳），浮层内引用的其他术语也显示名
    await dump(
      'live',
      `${lang}/noun.json`,
      resolveTerms(nounByLang[lang], termsByLang[lang]) as Record<string, Record<string, unknown>>,
    )
    for (const cat of CATEGORIES) {
      const part = built[cat.dir]
      await dump('live', `${lang}/${cat.list}`, part[lang].list)
      await writeDetails('live', `${lang}/${cat.dir}`, part[lang].details)
    }
  }

  const count = (d: Dict) => Object.keys(d).length
  console.log(`  live（${ver}）四语产物：`)
  for (const lang of LANGS) {
    const parts = CATEGORIES.map(
      (c) => `${count(built[c.dir][lang].details)}`,
    ).join(' / ')
    const lists = CATEGORIES.map((c) => `${count(built[c.dir][lang].list)}`).join(' / ')
    console.log(`    ${lang}：名录 ${lists}；详情 ${parts}`)
  }

  console.log('[4/4] 完成 →', OUT)
  await pruneStaleCache(ver)
}

/**
 * 版本探测（--check / sync-data 用）：实时拉取源站 manifest，
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
