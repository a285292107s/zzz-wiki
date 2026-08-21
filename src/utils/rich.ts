/* ============================================================
 * 富文本渲染 — 技能/影画描述中的游戏标记：
 *   <IconMap:Icon_XXX>  →  内联小按钮图标（nanoka 素材 CDN）
 *   <color=#FFFFFF>…</color> →  保留颜色的 <span>
 *   <Term:N>…</Term>     →  术语锚点（data-term-id，供 TermTip 浮层），保留内嵌色
 * 其余全部 HTML 转义（数据源为游戏文本表，防注入）。
 * 纯展示渲染，配合 v-html 使用。
 * ============================================================ */

import { skillAssetSources } from '@/data/icons'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * 将带游戏标记的描述文本渲染为可控 HTML 字符串。
 * 标记在文本表中以原始 `<…>` 出现，先整体转义，再定向还原两类标记。
 */
export function richDesc(desc?: string): string {
  if (!desc) return ''
  let out = esc(desc)

  // <color=#RRGGBB>…</color> → <span style="color:#…">…</span>（仅十六进制）
  out = out.replace(
    /&lt;color=#([0-9a-fA-F]{6,8})&gt;(.*?)&lt;\/color&gt;/gs,
    (_, c: string, inner: string) => `<span style="color:#${c}">${inner}</span>`,
  )

  // <color=#KEYWORD>…</color>（非十六进制，如 #POSITIVE_WITH_GREYITE）→ 保留内文、丢弃颜色标记
  out = out.replace(
    /&lt;color=#[0-9a-zA-Z_]+&gt;(.*?)&lt;\/color&gt;/gs,
    (_m, inner: string) => inner,
  )

  // 防护：剥离任何残留的残缺 color 标签（避免裸标签外泄）
  out = out.replace(/&lt;\/?color[^&]*&gt;/gi, '')

  // <IconMap:Icon_XXX> → 内联键位图标（nanoka 素材 CDN）
  // 捕获完整资产名（含 Icon_ 前缀），避免请求丢前缀的 URL（DESIGN.md §12 发现1）。
  // 本地候选优先；本地缺失时由 main.ts 的全局 error 捕获降级到 data-cdn，
  // 全部失败后替换为 .rich-key-broken 占位方框（与 HollowImage 文字兜底同语言）。
  out = out.replace(/&lt;IconMap:(Icon_\w+)&gt;/g, (_m, name: string) => {
    const [local, cdn] = skillAssetSources(name)
    const src = local ?? cdn
    if (!src) return ''
    const data = local && cdn ? ` data-cdn="${cdn}"` : ''
    return `<img class="rich-key" src="${src}" alt="" loading="lazy" decoding="async"${data}>`
  })

  // {LAYOUT_CONSOLECONTROLLER#手柄文案}{LAYOUT_FALLBACK#默认文案} → 只取 fallback（网页端默认输入）
  out = out.replace(
    /\{LAYOUT_CONSOLECONTROLLER#([^}]*)\}\{LAYOUT_FALLBACK#([^}]*)\}/g,
    (_m, _consoleLabel: string, fallbackLabel: string) => fallbackLabel,
  )
  // 其余单出现 LAYOUT 变体：同样取 # 后文案
  out = out.replace(/\{LAYOUT_[A-Z]+#([^}]*)\}/g, (_m, label: string) => label)

  // <Term:N>…</Term>（构建期已保留术语 ID、内嵌 <color> 名已还原成上方 <span>）→
  // 术语锚点：光标/焦点悬停时 TermTip 浮层读取 data-term-id 展示名词表 desc。
  // 内嵌 span 保留原名，未接浮层也不丢信息；不带 href，点击不产生无目标跳转/URL 噪音。
  out = out.replace(
    /&lt;Term:(\d+)&gt;(.*?)&lt;\/Term&gt;/gs,
    (_m, id: string, inner: string) =>
      `<a class="rich-term" data-term-id="${id}" tabindex="0">${inner}</a>`,
  )

  // 兜底：始终不向 DOM 泄露任何游戏标记
  // - {Skill:N, Prop:N} 详细倍率占位（倍率表渲染前先隐藏）
  out = out.replace(/\{Skill:\d+,\s*Prop:\d+\}/g, '')
  // - 残留的孤零 LAYOUT 标记
  out = out.replace(/\{LAYOUT_[^}]*\}/g, '')
  // - 其余任意 {…} 占位符
  out = out.replace(/\{[^{}]*\}/g, '')
  // - 其余未识别的孤零标签（我们生成的 <span>/<img>/<a> 均为字面 <，不在此列）
  out = out.replace(/&lt;[^&]*&gt;/gi, '')

  return out
}