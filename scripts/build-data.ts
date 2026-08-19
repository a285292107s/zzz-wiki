/* ============================================================
 * build-data.ts — 数据管线入口（tsx 运行）。
 * 用法：
 *   npm run data           全量构建（manifest 实时拉取，跨版本自动刷新）
 *   npm run data -- --check  仅版本探测：输出 UPDATE_AVAILABLE / UP_TO_DATE，不构建
 *   npm run data -- --force  忽略磁盘缓存全量重拉
 * （需外网；NODE_USE_ENV_PROXY=1 走代理）
 * ============================================================ */

import { main, needUpdate } from './build'

async function entry(): Promise<void> {
  // --check：CI/cron 哨兵模式——只对比版本，供外部决定是否触发构建
  if (process.argv.includes('--check')) {
    console.log((await needUpdate()) ? 'UPDATE_AVAILABLE' : 'UP_TO_DATE')
    return
  }
  await main()
}

entry().catch((e: unknown) => {
  console.error('✖ 构建失败：', e)
  process.exit(1)
})