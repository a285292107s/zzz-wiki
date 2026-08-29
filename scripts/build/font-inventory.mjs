/* ============================================================
 * font-inventory.mjs — 自托管西文字体清单（download/verify 共用，杜绝两处漂移）。
 *
 * family = Google Fonts css2 请求字族名；file = 本地文件名
 * （public/fonts/{file}-{weight}.woff2，经由 @font-face url(/fonts/...) 引用）。
 * 只取拉丁字体（latin 子集）：本站正文为 CJK 优先，西文字体只服务拉丁 glyph/数字。
 *
 * 若日后新增字体（如拉丁衬线），只改这里即可，download/verify 自动跟随。
 * ============================================================ */

export const FONTS = [
  { family: 'JetBrains Mono', file: 'JetBrainsMono', weights: [400, 500] },
  { family: 'Public Sans', file: 'PublicSans', weights: [400, 500] },
]

export const FONT_DIR = 'public/fonts'

/** 某字族某字重的本地文件相对路径 */
export function fontFile(f, weight) {
  return `${FONT_DIR}/${f.file}-${weight}.woff2`
}
