/* ============================================================
 * 富文本渲染 — 技能/影画/描述中的游戏标记 → 可控 HTML。
 *
 * 语法分析统一在 ./gameMarkup（tokenizeGameText 单一事实源）；
 * 本文件只承载「渲染策略」：
 *   COLOR(hex)→彩色 span · ICONMAP→内联键位图标 · TERM→术语锚点
 *   CAL(level)→按等级代入求值；未识别标记与占位一律清除，绝不裸露。
 *   另：图标紧邻的「点按/长按…<键位序列>[发动]」操作指令短语打包为 .rich-keyop 高亮框。
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

/** 操作指令动词词表（图标紧邻前缀）：「点按或长按」「保持/快速 + 动词」式组合同样成短语，
 *  尾部空格随动词入框。只作用于图标直接相邻的 text 段——数据实测动词从不被
 *  color/Term 等标记隔断，出现隔断形态时宁可不亮，不猜 */
const KEYOP_VERB =
  /(?:保持|连续|快速)?(?:点按|长按|连点|点击|按住|松开|短按|轻点|键入指令|键入)(?:或(?:点按|长按|连点|点击|按住|松开|短按))*[ \t]*$/
/** 指令短语收尾：图标紧随的「发动」（含其间空格）并入同一框 */
const KEYOP_LAUNCH = /^[ \t]*发动/
/** 图标序列连接段：图标之间的纯空白或「或/、」（如「<键位> 或 <键位>」的连按序列），
 *  整段随框。带其他文字（含动词，如「或长按」）不算连接段——那是下一图标自己的动词前缀 */
const KEYOP_CONN = /^[ \t]*(?:或|、)?[ \t]*$/

/**
 * 将带游戏标记的描述文本渲染为可控 HTML 字符串。
 * @param level 可选技能等级：提供时把 {CAL:…} 内嵌公式占位（如 伤害提升18%）按该级
 *  求值；缺省时此类调用方（术语浮层等）不含 CAL，token 同样被清除不外泄。
 */
export function richDesc(desc?: string, level?: number): string {
  if (!desc) return ''
  const lexemes = tokenizeGameText(desc)

  /* 指令短语标注（keyop）：对每个 iconmap，回看直接相邻前一 text 段是否以操作动词
   * 收尾，命中则（动词+图标）成组；随后沿「空白/或/、」连接段吸收后续图标成序列；
   * 末图标后的 text 段以「发动」开头时并入组尾。无动词前缀的图标永不触发。 */
  const verbAt = new Map<number, number>() // text 段序号 → 动词起点（value 内偏移）
  const launchAt = new Map<number, number>() // 末图标后一 text 段序号 → 并入的「发动」长度
  const connAt = new Set<number>() // 序列连接段（纯空白/或/、）text 段序号
  for (let i = 1; i < lexemes.length; i++) {
    if (lexemes[i].tok.kind !== 'iconmap') continue
    const prev = lexemes[i - 1]
    if (prev?.tok.kind !== 'text') continue
    const vm = KEYOP_VERB.exec(prev.tok.value)
    if (!vm) continue
    verbAt.set(i - 1, vm.index)
    // 沿连接段扩展序列：紧随的「空白/或/、」+ 另一图标则一并入框
    let last = i
    for (;;) {
      const conn = lexemes[last + 1]
      if (conn?.tok.kind !== 'text' || !KEYOP_CONN.test(conn.tok.value)) break
      if (lexemes[last + 2]?.tok.kind !== 'iconmap') break
      connAt.add(last + 1)
      last += 2
    }
    const next = lexemes[last + 1]
    // 该段兼作下个图标的动词前缀时（如「…发动长按 <Icon>」）让位：动词决定图标归属
    if (next?.tok.kind === 'text' && !KEYOP_VERB.test(next.tok.value)) {
      const lm = KEYOP_LAUNCH.exec(next.tok.value)
      if (lm) launchAt.set(last + 1, lm[0].length)
    }
  }

  let out = ''
  let spanDepth = 0 // 已打开且待闭合的彩色 span 数
  let anchorDepth = 0 // 已打开且待闭合的术语锚点数
  let keyopOpen = false // 已开启待闭合的指令短语框（动词→图标→发动，跨三个 case 协作）

  /** text 段消费：先剥未识别 <…>/{…} 占位再转义——与既有兜底一致，绝不裸露 */
  const plain = (s: string) => esc(s.replace(/<[^>]*>/g, '').replace(/\{[^{}]*\}/g, ''))

  for (let i = 0; i < lexemes.length; i++) {
    const { tok } = lexemes[i] ?? {}
    switch (tok?.kind) {
      case 'text': {
        const vs = verbAt.get(i)
        const ll = launchAt.get(i)
        if (vs != null) {
          // 指令短语开头：前文照旧，动词入框（框跨到图标乃至「发动」）
          out += plain(tok.value.slice(0, vs))
          out += '<span class="rich-keyop">'
          out += plain(tok.value.slice(vs))
          keyopOpen = true
        } else if (connAt.has(i)) {
          // 序列连接段（纯空白/或/、）：整段留在框内
          out += plain(tok.value)
        } else if (ll != null && keyopOpen) {
          // 短语收尾：「发动」入框闭合，其余照旧
          out += plain(tok.value.slice(0, ll))
          out += '</span>'
          out += plain(tok.value.slice(ll))
          keyopOpen = false
        } else {
          out += plain(tok.value)
        }
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
        if (src) {
          const data = local && cdn ? ` data-cdn="${cdn}"` : ''
          out += `<img class="rich-key" src="${src}" alt="" loading="lazy" decoding="async"${data}>`
        }
        // 短语在此收束（后续既非「发动」也非序列连接段）时：框在图标后即闭合
        if (keyopOpen && !launchAt.has(i + 1) && !connAt.has(i + 1)) {
          out += '</span>'
          keyopOpen = false
        }
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
  if (keyopOpen) out += '</span>'
  return out
}
