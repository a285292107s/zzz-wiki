/* ============================================================
 * sync-data.ts — 「同步」入口：JSON + 图标 原子更新（npm run sync）
 *
 * 设计（第一性原理）：
 *   - 需要的图标集 = 当前 live 数据的纯函数（icon-inventory.collectIcons，
 *     读 public/data/live/ 名录与详情推导），新内容自动进清单，永不漂移。
 *   - 已有美术资源几乎不变 → 按「本地存在性」差集只补缺失，零重下、零仓库膨胀。
 *   - 源站/图标缺口软失败，绝不阻断；JSON 与图标由同一份新 live 数据驱动。
 *
 * 行为（职责：产生「新 JSON + 新图标」的干净增量，供上层原子提交）：
 *   1. 探测源站版本（needUpdate）：源站不可达 → 跳过 JSON 重建（沿用既有快照），但
 *      仍执行图标补差（版本探测失败不连带放弃对上次瞬态失败图标的自愈）
 *   2. 有新版本 → 备份 public/data → 重建 JSON（失败回退既有产物）
 *   3. 无论是否新版本、是否成功探测，都跑图标 --soft 补差（按「本地存在性」幂等差集、
 *      只补缺失）——上次瞬态失败的图标会在下次运行自愈，无需等新版本
 *   4. verify:data + 本地必须项图标齐整性（仅告警）
 *   5. 打印 SYNC_DONE，供上层（GitHub Actions）按 git diff 决定是否提交
 *
 * 本脚本不执行 git 提交——提交由调用方（.github/workflows/data-sync.yml）按
 * git diff 决定，保持「同步」与「提交」解耦。
 *
 * 用法：npm run sync        （需外网；代理设 NODE_USE_ENV_PROXY=1）
 * ============================================================ */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { main as buildAll, needUpdate } from './build'
import { OUT } from './build/io'
import { runDownloadIcons } from './build/download-icons.mjs'
import { verifyDataMain } from './verify-data'
import { collectIcons, localPath } from './build/icon-inventory.mjs'

/** 同步前目录备份（临时），JSON 构建失败回退时沿用既有快照 */
const BACKUP = path.join(os.tmpdir(), `zzz-wiki-sync-${process.pid}`)

/** 探测：源站不可达视为「无法确认」，沿用仓库既有快照不提交 */
async function probeOutdated(): Promise<boolean | null> {
  try {
    return await needUpdate()
  } catch (e) {
    console.error('[sync] 版本探测失败（源站不可达？），沿用仓库内既有快照，不产生变更')
    console.error('  ', e instanceof Error ? e.message : e)
    return null
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
  const outdated = await probeOutdated()
  let changed = false
  if (outdated === true) {
    console.log('[sync] 检测到数据新版本，开始同步 JSON…')
    backupOut()
    try {
      await buildAll()
      changed = true
    } catch (e) {
      console.error('[sync] 数据构建失败，回退到既有产物：')
      console.error('  ', e instanceof Error ? e.message : e)
      try {
        restoreOut()
        console.warn('[sync] 已回退，仓库快照保持不变（本次不产生变更）')
      } catch (restoreErr) {
        // 回退也失败是灾难性场景：显式失败，避免提交半残数据
        console.error('[sync] 回退失败（public/data 可能不完整）：', restoreErr)
        process.exit(1)
      }
      return
    }
    fs.rmSync(BACKUP, { recursive: true, force: true })
  } else if (outdated === false) {
    console.log('[sync] 数据已是最新（UP_TO_DATE），仍补齐缺失图标（幂等，自愈上次瞬态失败）')
  } else {
    // 源站不可达：无法确认版本 → 跳过 JSON 重建（沿用既有快照）。但图标补差仍执行（独立、幂等、软失败），
    // 以免「版探测失败」连带放弃对上次瞬态失败图标的自愈——若源站只是对 manifest 端点瞬时抖动、图标资产可达，
    // 仍能补下，且不会提交（无文件写入时 changed=false）。
    console.log('[sync] 版本探测失败（源站不可达？）——跳过 JSON 重建，仍尝试补齐缺失图标')
  }

  // 图标补差（幂等、缺口软失败）——无论版本是否变化、无论是否成功探测源站都跑：
  // 按「本地存在性」差集只补缺失；上次瞬态失败的图标在此重试，已存在的跳过（不触网）。
  const icons = await runDownloadIcons({ soft: true })
  if (icons.added > 0) changed = true
  console.log(`[sync] 图标同步：新增 ${icons.added}，缺口 ${icons.failed + icons.heroMissing}（软失败，不阻断）`)

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
