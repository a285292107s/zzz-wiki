/* ============================================================
 * 富文本渲染 — 技能/影画/描述中的游戏标记 → 可控 HTML。
 *
 * 语法分析统一在 ./gameMarkup（tokenizeGameText 单一事实源）；
 * 本文件只承载「渲染策略」：
 *   COLOR(hex)→彩色 span · ICONMAP→内联键位图标 · TERM→术语锚点
 *   CAL(level)→按等级代入求值；未识别标记与占位一律清除，绝不裸露。
 * 纯展示渲染，配合 v-html 使用；数据源为游戏文本表，防注入靠
 * 「白名单 token 定向还原 + 普通文本段 HTML 转义」双保险。
 * ============================================================ */

import { skillAssetSources } from '@/data/icons'
import { calTokenValue, parseCalToken } from '@/domain/skillFormula'
import { tokenizeGameText } from './gameMarkup'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const HEX_COLOR = /^[0-9a-fA-F]{6,8}$/

/**
 * 将带游戏标记的描述文本渲染为可控 HTML 字符串。
 * @param level 可选技能等级：提供时把 {CAL:…} 内嵌公式占位（如 伤害提升18%）按该级
 *  求值；缺省时此类调用方（出招表/术语浮层等）不含 CAL，token 同样被清除不外泄。
 */
export function richDesc(desc?: string, level?: number): string {
  if (!desc) return ''
  const lexemes = tokenizeGameText(desc)
  let out = ''
  let spanDepth = 0 // 已打开且待闭合的彩色 span 数
  let anchorDepth = 0 // 已打开且待闭合的术语锚点数

  for (let i = 0; i < lexemes.length; i++) {
    const { tok } = lexemes[i] ?? {}
    switch (tok?.kind) {
      case 'text': {
        // 未识别的 <…> 标签与 {…} 占位：先剥离再转义——与既有兜底一致，绝不裸露
        out += esc(tok.value.replace(/<[^>]*>/g, '').replace(/\{[^{}]*\}/g, ''))
        break
      }
      case 'color-open': {
        if (HEX_COLOR.test(tok.code)) {
          out += `<span style="color:#${tok.code}">`
          spanDepth++
        }
        break
      }
      case 'color-close': {
        if (spanDepth > 0) {
          out += '</span>'
          spanDepth--
        }
        break
      }
      case 'iconmap': {
        // 内联键位图标：本地候选优先；本地缺失时由 main.ts 的全局 error 捕获降级到
        // data-cdn；全部失败后替换为 .rich-key-broken 占位方框（HollowImage 同语言）
        const [local, cdn] = skillAssetSources(tok.name)
        const src = local ?? cdn
        if (!src) break
        const data = local && cdn ? ` data-cdn="${cdn}"` : ''
        out += `<img class="rich-key" src="${src}" alt="" loading="lazy" decoding="async"${data}>`
        break
      }
      case 'term-open': {
        // 术语锚点：TermTip 悬停/聚焦读 data-term-id；不带 href，点击无跳转噪音
        out += `<a class="rich-term" data-term-id="${tok.id}" tabindex="0">`
        anchorDepth++
        break
      }
      case 'term-close': {
        if (anchorDepth > 0) {
          out += '</a>'
          anchorDepth--
        }
        break
      }
      case 'br':
        break // 渲染层维持既有行为：换行交给容器布局，不作 <br>
      case 'cal': {
        // 需等级上下文：SkillGroup 传当前滑条等级；token 后的 %/点/秒 为普通文案留在原地
        const cal = parseCalToken(`{CAL:${tok.body}}`)
        out += cal && level != null ? esc(calTokenValue(cal, level)) : ''
        break
      }
      case 'skill-ref':
        break // 详细倍率引用由倍率表渲染，此处永不外泄
      case 'layout': {
        // 控制器+回退成对出现 → 只留回退文案；孤立变体 → 保留其 # 后文案
        const next = lexemes[i + 1]?.tok
        if (tok.key === 'CONSOLECONTROLLER' && next?.kind === 'layout' && next.key === 'FALLBACK') {
          out += esc(next.label)
          i++
        } else {
          out += esc(tok.label)
        }
        break
      }
      default:
        break
    }
  }

  // 防残缺数据破坏文档结构：未闭合的锚点/span 补齐闭合
  while (anchorDepth-- > 0) out += '</a>'
  while (spanDepth-- > 0) out += '</span>'
  return out
}
