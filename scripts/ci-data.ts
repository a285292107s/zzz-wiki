/* ============================================================
 * ci-data.ts — 部署环境数据同步（Vercel buildCommand 前置，build:ci 调用）。
 *
 * 行为（职责：尽力同步，失败绝不阻塞站点部署）：
 *   1. 探测源站版本（manifest 实时）；本地已最新 → 跳过构建（幂等，秒级）
 *   2. 有更新 → 全量构建；构建失败 → 回退仓库内既有 public/data（站点不因源站故障而挂）
 *   3. 构建后跑 verify:data 全量契约校验；未通过仅告警，不阻断
 *
 * 源站不可达（探测抛错）→ 告警并沿用旧数据，exit 0。
 * ============================================================ */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { main as buildAll, needUpdate } from './build'
import { OUT } from './build/io'
import { verifyDataMain } from './verify-data'

/** 构建前备份目录（临时），失败时回退 */
const BACKUP = path.join(os.tmpdir(), `zzz-wiki-data-${process.pid}`)

/** 探测：源站不可达视为「无法确认」，沿用旧数据不阻塞部署 */
async function probeOutdated(): Promise<boolean | null> {
  try {
    return await needUpdate()
  } catch (e) {
    console.error('[ci-data] 版本探测失败（源站不可达？），沿用仓库内既有数据继续部署')
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

async function main(): Promise<void> {
  const outdated = await probeOutdated()
  if (outdated === false) {
    console.log('[ci-data] 数据已是最新，跳过构建（UP_TO_DATE）')
    return
  }
  if (outdated === null) return

  console.log('[ci-data] 检测到数据新版本，开始构建…')
  backupOut()
  try {
    await buildAll()
  } catch (e) {
    console.error('[ci-data] 数据构建失败，回退到既有产物：')
    console.error('  ', e instanceof Error ? e.message : e)
    try {
      restoreOut()
      console.warn('[ci-data] 已回退，站点将以旧数据部署（请人工检查，勿重复触发）')
    } catch (restoreErr) {
      // 回退也失败是灾难性场景：退出非零让构建失败，避免发布半残数据
      console.error('[ci-data] 回退失败（public/data 可能不完整）：', restoreErr)
      process.exit(1)
    }
    return
  }
  fs.rmSync(BACKUP, { recursive: true, force: true })

  // 契约校验（进程内执行，不经 npx 子进程）：失败仅告警（数据已入库，由后续人工/提交流程跟进）
  try {
    const code = await verifyDataMain()
    if (code === 0) {
      console.log('[ci-data] verify:data 契约校验通过')
    } else {
      console.warn('[ci-data] ⚠ verify:data 未通过（请人工检查 public/data 后提交）')
    }
  } catch (e) {
    console.warn('[ci-data] ⚠ verify:data 执行异常（请人工检查 public/data 后提交）：', e)
  }
}

main().catch((e: unknown) => {
  // 能走到这里的都是预期路径之外的程序错误：显式失败让部署红灯，
  // 绝不静默 exit 0 把意外当"源站不可达沿用旧数据"
  console.error('[ci-data] 意外异常：', e)
  process.exit(1)
})