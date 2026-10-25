/* ============================================================
 * sync-data.ts — 「同步」入口：JSON + 图标 原子更新（pnpm run sync）
 *
 * 设计（第一性原理）：
 *   - 需要的图标集 = 当前 live 数据的纯函数（icon-inventory.collectIcons，
 *     读 public/data/live/ 名录与详情推导），新内容自动进清单，永不漂移。
 *   - 已有美术资源几乎不变 → 按「本地存在性」差集只补缺失，零重下、零仓库膨胀。
 *   - 源站/图标缺口软失败，绝不阻断；JSON 与图标由同一份新 live 数据驱动。
 *
 * 行为（职责：产生「新 JSON + 新图标」的干净增量，供上层原子提交）：
 *   1. 探测源站版本（needUpdate）：探测失败默认**以非零退出码失败**——stderr 写明失败的是哪一步、
 *      错误类别（网络 / HTTP 状态 / 结构变化）与站点当前已提交版本，避免「job 绿 + 站点静默停旧版」。
 *      仅当显式传 --allow-probe-failure 时退回旧行为：跳过 JSON 重建（沿用既有快照），
 *      但图标补差照常执行（探测失败不连带放弃对上次瞬态失败图标的自愈）
 *   2. 有新版本 → 备份 public/data → 重建 JSON（失败回退既有产物）
 *   3. 无论是否新版本、是否成功探测，都跑图标 --soft 补差（按「本地存在性」幂等差集、
 *      只补缺失）——上次瞬态失败的图标会在下次运行自愈，无需等新版本
 *   4. verify:data + 本地必须项图标齐整性（仅告警）
 *   5. 打印 SYNC_DONE，供上层（GitHub Actions）按 git diff 决定是否提交
 *
 * 本脚本不执行 git 提交——提交由调用方（.github/workflows/data-sync.yml）按
 * git diff 决定，保持「同步」与「提交」解耦。
 *
 * 用法：pnpm run sync        （需外网；代理设 NODE_USE_ENV_PROXY=1）
 *       pnpm run sync -- --allow-probe-failure   探测失败时沿用旧快照（排障用，默认不用）
 * ============================================================ */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { main as buildAll, needUpdate } from './build'
import { OUT } from './build/io'
import { runDownloadIcons } from './build/download-icons.mjs'
import { runIconThumbs } from './build/icon-thumbs.mjs'
import { runHeroCards } from './build/hero-cards.mjs'
import { runHeroMobile } from './build/hero-mobile.mjs'
import { runProductArtCards } from './build/product-art-cards.mjs'
import { verifyDataMain } from './verify-data'
import { collectIcons, localPath } from './build/icon-inventory.mjs'

/** 同步前目录备份（临时），JSON 构建失败回退时沿用既有快照 */
const BACKUP = path.join(os.tmpdir(), `zzz-wiki-sync-${process.pid}`)

type Probe = 'outdated' | 'up-to-date' | 'unconfirmed' | 'abort'

const ALLOW_PROBE_FAILURE = process.argv.includes('--allow-probe-failure')

function readLocalLiveVersion(): string {
  try {
    const local = JSON.parse(
      fs.readFileSync(path.join(OUT, 'manifest.json'), 'utf8'),
    ) as { zzz?: { live?: string } }
    return local.zzz?.live ?? '未知（manifest.json 缺 zzz.live）'
  } catch {
    return '未知（public/data/manifest.json 不可读）'
  }
}

function describeProbeFailure(e: unknown): string[] {
  const err = e instanceof Error ? e : new Error(String(e))
  const cause = err.cause as { code?: unknown; message?: unknown } | undefined
  const netCode = typeof cause?.code === 'string' ? cause.code : (err as NodeJS.ErrnoException).code
  const status = /^HTTP (\d{3})\b/.exec(err.message)?.[1]
  const kind = status
    ? `源站响应 HTTP ${status}（鉴权 / 限流 / 端点变更）`
    : err instanceof SyntaxError
      ? '响应不是合法 JSON（源站结构变化，或本地 public/data/manifest.json 损坏）'
      : netCode
        ? `网络不可达（${netCode}）`
        : '未知错误'
  const lines = [`  类别：${kind}`, `  原始信息：${err.message}`]
  if (typeof cause?.message === 'string' && cause.message !== err.message) {
    lines.push(`  底层原因：${cause.message}`)
  }
  return lines
}

async function probeOutdated(): Promise<Probe> {
  try {
    return (await needUpdate()) ? 'outdated' : 'up-to-date'
  } catch (e) {
    console.error('[sync] ✖ 第 1 步「版本探测」失败：无法确认源站是否有新版本')
    console.error(
      '  探测对象：https://static.nanoka.cc/manifest.json（与本仓 public/data/manifest.json 的 zzz.live 比对）',
    )
    for (const line of describeProbeFailure(e)) console.error(line)
    console.error(`  站点当前已提交版本：${readLocalLiveVersion()}（本次不重建、不提交）`)
    if (ALLOW_PROBE_FAILURE) {
      console.error('[sync] ⚠ --allow-probe-failure 显式放行：沿用既有快照，继续补齐缺失图标')
      return 'unconfirmed'
    }
    console.error('[sync] ✖ 以非零退出码失败——「job 绿、站点静默停旧版」不可接受')
    console.error('[sync]   确认是源站临时故障、本次确要沿用旧快照时，加 --allow-probe-failure 显式放行')
    process.exitCode = 1
    return 'abort'
  }
}

function backupOut(): void {
  fs.rmSync(BACKUP, { recursive: true, force: true })
  if (fs.existsSync(OUT)) fs.cpSync(OUT, BACKUP, { recursive: true })
}

function restoreOut(): void {
  fs.rmSync(OUT, { recursive: true, force: true })
  fs.cpSync(BACKUP, OUT, { recursive: true })
}

/** 本地「必须项」图标齐整性检查（hero/皮肤等 optionalLocal 缺口属可容忍） */
function checkLocalRequiredIcons(): Array<{ cat: string; file: string }> {
  const missing: Array<{ cat: string; file: string }> = []
  for (const e of collectIcons()) {
    if (e.optionalLocal) continue
    if (!fs.existsSync(localPath(e))) missing.push({ cat: e.cat, file: e.file })
  }
  return missing
}

async function main(): Promise<void> {
  const probe = await probeOutdated()
  if (probe === 'abort') return
  let changed = false
  if (probe === 'outdated') {
    console.log('[sync] 检测到数据新版本，开始同步 JSON…')
    backupOut()
    try {
      await buildAll()
      changed = true
    } catch (e) {
      console.error('[sync] ✖ 第 2 步「重建 JSON」失败：')
      console.error('  ', e instanceof Error ? e.message : e)
      try {
        restoreOut()
        console.error(`[sync] 已回退到既有产物；本次未提交，站点仍停留在 ${readLocalLiveVersion()}`)
      } catch (restoreErr) {
        // 回退也失败是灾难性场景：显式失败，避免提交半残数据
        console.error('[sync] ✖ 回退失败（public/data 可能不完整）：', restoreErr)
        process.exit(1)
      }
      process.exitCode = 1
      return
    }
    fs.rmSync(BACKUP, { recursive: true, force: true })
  } else if (probe === 'up-to-date') {
    console.log('[sync] 数据已是最新（UP_TO_DATE），仍补齐缺失图标（幂等，自愈上次瞬态失败）')
  } else {
    console.log('[sync] 版本探测失败（已显式放行）——跳过 JSON 重建，仍尝试补齐缺失图标')
  }

  // 图标补差（幂等、缺口软失败）——无论版本是否变化、无论是否成功探测源站都跑：
  // 按「本地存在性」差集只补缺失；上次瞬态失败的图标在此重试，已存在的跳过（不触网）。
  const icons = await runDownloadIcons({ soft: true })
  if (icons.added > 0) changed = true
  console.log(`[sync] 图标同步：新增 ${icons.added}，缺口 ${icons.failed + icons.heroMissing}（软失败，不阻断）`)

  // hero 头图派生（幂等补差，随图标下载后执行）：两档规格由首页展示格反推 ——
  // card ≤800px/q68（窄屏横幅 + og:image）、wide ≤1600px/q72（桌面整栏横幅，srcset 自选档），
  // 原图留给详情页满栏底图。失败软失败（前端候选链回退原图，不破图）。
  const heroCards = await runHeroCards()
  if (heroCards.generated > 0) changed = true
  console.log(
    `[sync] hero 头图派生：生成 ${heroCards.generated}，沿用 ${heroCards.skipped}，失败 ${heroCards.failed.length}（软失败，不阻断）`,
  )
  for (const f of heroCards.failed) console.warn(`  ⚠ ${f}`)

  // hero 窄屏派生（幂等补差）：手机视口只用到原图中心一条，1400w/45-71KB 替代 221-310KB 原图。
  // 失败软失败（AgentHead 候选链回退原图，不破图）。
  const heroMobile = await runHeroMobile()
  if (heroMobile.generated > 0) changed = true
  console.log(
    `[sync] hero mobile 派生：生成 ${heroMobile.generated}，沿用 ${heroMobile.skipped}，失败 ${heroMobile.failed.length}（软失败，不阻断）`,
  )
  for (const f of heroMobile.failed) console.warn(`  ⚠ ${f}`)

  const productArtCards = await runProductArtCards()
  if (productArtCards.generated > 0) changed = true
  console.log(
    `[sync] 产品图列表档派生（音擎/邦布）：生成 ${productArtCards.generated}，沿用 ${productArtCards.skipped}，失败 ${productArtCards.failed.length}（软失败，不阻断）`,
  )
  for (const f of productArtCards.failed) console.warn(`  ⚠ ${f}`)

  // 名录图标小图派生（幂等补差）：名录行 38×38 展示格用 128px 小图（~4KB）替代
  // 400-512px 原图（31-50KB）；详情页仍用原图。失败软失败（候选链回退原图）。
  const thumbs = await runIconThumbs()
  if (thumbs.generated > 0) changed = true
  console.log(
    `[sync] 名录图标小图：生成 ${thumbs.generated}，沿用 ${thumbs.skipped}，失败 ${thumbs.failed.length}（软失败，不阻断）`,
  )
  for (const f of thumbs.failed) console.warn(`  ⚠ ${f}`)

  // 契约校验（进程内执行，失败仅告警）
  try {
    const code = await verifyDataMain()
    if (code === 0) console.log('[sync] verify:data 契约校验通过')
    else console.warn('[sync] ⚠ verify:data 未通过（请人工检查 public/data 后提交）')
  } catch (e) {
    console.warn('[sync] ⚠ verify:data 执行异常（请人工检查 public/data 后提交）：', e)
  }

  // 本地必须项图标齐整性（仅告警）
  const missing = checkLocalRequiredIcons()
  if (missing.length) {
    console.warn(
      `[sync] ⚠ 必须项图标本地缺失 ${missing.length}：${missing.map((m) => `${m.cat}/${m.file}`).join(', ')}`,
    )
  } else {
    console.log('[sync] 本地必须项图标齐整')
  }

  console.log(`[sync] SYNC_DONE changes=${changed ? 'yes' : 'no'}`)
}

main().catch((e: unknown) => {
  // 预期路径之外的错误：显式失败，绝不静默 exit 0 把意外当"沿用旧数据"
  console.error('[sync] 意外异常：', e)
  process.exit(1)
})
