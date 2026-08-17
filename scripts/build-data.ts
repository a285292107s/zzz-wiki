/* ============================================================
 * build-data.ts — 数据管线入口（tsx 运行）。
 * 用法：npm run data [--force]（需外网；NODE_USE_ENV_PROXY=1 走代理）
 * ============================================================ */

import { main } from './build'

main().catch((e: unknown) => {
  console.error('✖ 构建失败：', e)
  process.exit(1)
})
