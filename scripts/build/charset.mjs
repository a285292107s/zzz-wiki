/* ============================================================
 * charset.mjs — 站点可渲染字符集收集（CJK 分片裁剪的唯一事实源）
 *
 * 目标：产出「站点可能渲染出的所有字符」的超集，供两处使用——
 *   1) subset-cjk-fonts.mjs 按此裁剪字体分片体积
 *   2) verify-cjk-fonts.mjs 校验覆盖：任一字符必须落在某个 @font-face 的
 *      unicode-range 内，否则该字会退回系统宋体（字形混排，比整段回退更刺眼）
 *
 * 采集来源（超集策略，宁多勿漏）：
 *   - public/data/**.json 全部字符串值（名录/详情/术语等动态内容）
 *   - public/data/manifest.json
 *   - index.html（骨架期的静态文本）
 *   - src/**.{ts,vue} 的**去注释后原文**（注释不是渲染内容，必须先剔除，
 *     否则中文注释会让字符集虚胖数倍）
 *   - scripts/build 与 views 之外的仓库文档不采集（不渲染）
 *
 * 不做「按 --serif 元素精确采集」的原因：字体栈的回退是全局的（衬线元素里的
 * 西文/标点也走 Noto Serif SC 的字形），漏采会退化成字形混排。
 * ============================================================ */

import fs from 'node:fs'
import path from 'node:path'

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.cache', 'temp'])

/** 递归收集文件 */
function walk(dir, filter, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, filter, out)
    else if (filter(p)) out.push(p)
  }
  return out
}

/** 去掉代码注释：块注释 / 行注释 / Vue 模板注释（注释里的中文不渲染） */
function stripComments(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1') // 保留 http:// 之类的协议头
}

/** 从 JSON 文本中取出所有字符串字面量与键 */
function collectFromJson(text, set) {
  for (const m of text.matchAll(/"((?:[^"\\]|\\.)*)"/g)) {
    for (const ch of m[1]) set.add(ch.codePointAt(0))
  }
}

/**
 * 采集全站可渲染字符的码点集合。
 * @returns {Set<number>} code points
 */
export function collectCharset({ root = process.cwd(), verbose = false } = {}) {
  const set = new Set()
  const stats = {}

  const dataFiles = walk(path.join(root, 'public/data'), (p) => p.endsWith('.json'))
  for (const f of dataFiles) collectFromJson(fs.readFileSync(f, 'utf8'), set)
  stats.data = set.size

  const html = path.join(root, 'index.html')
  if (fs.existsSync(html)) for (const ch of fs.readFileSync(html, 'utf8')) set.add(ch.codePointAt(0))
  stats.afterHtml = set.size

  const srcFiles = walk(path.join(root, 'src'), (p) => /\.(ts|vue)$/.test(p))
  for (const f of srcFiles) {
    for (const ch of stripComments(fs.readFileSync(f, 'utf8'))) set.add(ch.codePointAt(0))
  }
  stats.afterSrc = set.size
  stats.dataFiles = dataFiles.length
  stats.srcFiles = srcFiles.length

  if (verbose) console.log('  字符集采集：', JSON.stringify(stats))
  return set
}

/** 码点集合 → 字符数组（升序） */
export function codepoints(set) {
  return [...set].sort((a, b) => a - b)
}

/** 码点数组 → CSS unicode-range 字符串（连续段压缩为 U+XXXX-YYYY） */
export function toUnicodeRange(points) {
  const parts = []
  let start = points[0]
  let prev = points[0]
  for (const p of points.slice(1)) {
    if (p === prev + 1) {
      prev = p
      continue
    }
    parts.push(start === prev ? `U+${hex(start)}` : `U+${hex(start)}-${hex(prev)}`)
    start = prev = p
  }
  if (start !== undefined) parts.push(start === prev ? `U+${hex(start)}` : `U+${hex(start)}-${hex(prev)}`)
  return parts.join(',')
}

/** 解析 CSS unicode-range 中的 "U+XXXX" / "U+XXXX-YYYY" 列表 → 码点集合 */
export function parseUnicodeRange(range) {
  const set = new Set()
  for (const part of range.split(',')) {
    const m = part.trim().match(/^U\+([0-9A-Fa-f]+)(?:-([0-9A-Fa-f]+))?$/)
    if (!m) continue
    const lo = parseInt(m[1], 16)
    const hi = m[2] ? parseInt(m[2], 16) : lo
    for (let c = lo; c <= hi; c++) set.add(c)
  }
  return set
}

const hex = (n) => n.toString(16).toUpperCase().padStart(4, '0')
