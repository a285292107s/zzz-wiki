/* ============================================================
 * 富文本渲染 — 技能/影画描述中的游戏标记：
 *   <IconMap:Icon_Normal>  →  内联小按钮图标（nanoka 素材 CDN）
 *   <color=#FFFFFF>…</color> →  保留颜色的 <span>
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

  // <color=#RRGGBB>…</color> → <span style="color:#…">…</span>
  out = out.replace(
    /&lt;color=#([0-9a-fA-F]{6,8})&gt;(.*?)&lt;\/color&gt;/gs,
    (_, c: string, inner: string) => `<span style="color:#${c}">${inner}</span>`,
  )

  // <IconMap:Icon_XXX> → 内联键位图标
  out = out.replace(/&lt;IconMap:Icon_(\w+)&gt;/g, (_m, name: string) => {
    const src = skillAssetSources(name)[0]
    return src ? `<img class="rich-key" src="${src}" alt="" loading="lazy" decoding="async">` : ''
  })

  return out
}