/* ============================================================
 * langs.mjs — 语言集读取（纯 .mjs 工具链用）。
 *
 * TS 工具链（build/index.ts、verify-data.ts）直接 import src/domain/lang.ts；
 * 本文件让 .mjs 脚本（generate-sitemap / generate-route-html / icon-inventory）
 * 读**同一份** langs.json，避免语言清单出现第二处定义。
 * ============================================================ */

import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname ?? process.cwd(), '..', '..')

/** 有序语言集（= 数据面 live/ 下的语言目录名）。 */
export const LANGS = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src', 'domain', 'langs.json'), 'utf8'),
)

/**
 * 枚举用语言：名录 id 与图标清单与语言无关，构建期派生物（sitemap / 逐路由 HTML /
 * 图标清单）固定读首位语言，产物可复现且不随语言顺序漂移。
 */
export const DEFAULT_LANG = LANGS[0]
