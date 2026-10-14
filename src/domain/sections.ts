/* ============================================================
 * 详情页区块通用类型与纯函数 — 单一定义（DESIGN.md P2）。
 * AgentDetailView / WEngineDetailView 共用的行结构、网格项、
 * 技能槽位常量与字典→行转换。无 Vue 依赖，可单测。
 *
 * 区块/槽位/数值标签是**四语**（决策记录 0011）：文案存在 `domain/uiText`，
 * 这里用 `uiLoc('…')` 取整条 `Loc`，再由调用方传入 `lang` 解析成具体字符串
 * （与名录/详情取数同一个「语言显式传入」的口径，不做隐式全局读）。
 * ============================================================ */

import { pickText, type Lang, type Loc } from './lang'
import { fmt, uiLoc } from './uiText'
import { evaluateSkillFormula, formatSkillScalar, replaceCalTokens, type SkillParamEntry } from './skillFormula'

// 公式求值引擎已拆至 ./skillFormula（单一职责，独立单测）；此处原样再导出保持 API 兼容
export type { CalToken, SkillParamEntry } from './skillFormula'
export {
  calTokenValue,
  evaluateSkillFormula,
  formatSkillScalar,
  parseCalToken,
  replaceCalTokens,
  skillParamValue,
} from './skillFormula'

/** 序号行（影画/精炼/技能描述共用）；desc2 为影画附带的剧情札记（lore）文本 */
export interface DetailRow {
  no: number
  name?: string
  desc?: string
  desc2?: string
}

/** 技能详细倍率的单个数值条目（param 数组中的一项）：公式模板 + 所需数值表 */
export interface SkillDetail {
  name: string
  formula: string
  /** 数值表：单层 {skillId: entry}（角色）或双层 {skillId: {propId: entry}}（邦布），与 evaluateSkillFormula 兼容 */
  props: Record<string, SkillParamEntry | Record<string, SkillParamEntry>>
  /** 由公式首个引用技能解析出的展示格式（如 '%'） */
  format?: string
  /** 静态文本条目（邦布：token 无 {Skill:} 引用），各级原文按序；存在时优先于公式求值 */
  values?: string[]
}

/**
 * 技能展示组：对应一个招式（如「普通攻击：狡兔连打」）。
 * 组 = 招式标题 + 说明文字(富文本) + 可选数值条目。
 * 说明文字与数值在 JSON 中分处「简单描述块」与「详细倍率块」，按 name 合并、按出现顺序排列。
 */
export interface SkillGroup {
  /** 招式名 */
  name: string
  /** 招式说明文字（富文本）；或是随所选等级变化的文本函数（邦布技能描述按级取）；纯数值组无文字时为 undefined */
  desc?: string | ((level: number) => string)
  /** 该招式下的数值条目；纯文本招式无数值时为 undefined */
  entries?: SkillDetail[]
  /** 该招式为潜能影像门控时携带的档位 id（如 119100…）；[0] 表示基础版，不含此字段 */
  potential?: number[]
  /** 门控类型：'new' 为潜能新增招式，'enhance' 为对既有招式（同名基础版）的强化 */
  potentialType?: 'new' | 'enhance'
  /** 派生技能子块（纯数值、吸附在父招式之下，如「涡流集束手雷基础倍率」）：
   *  门控语义保留（基础模式随潜能隐藏），但不悬挂「潜能×·新增」徽标 */
  derived?: boolean
  /** 同名「基础 + 强化」双形态时，强化版文案（desc 保留基础版）；供基础/潜能切换使用 */
  strongDesc?: string
}

/** 技能行（键位、槽位名（当前语言）、有序展示组） */
export interface SkillRow {
  key: string
  /** 槽位展示名（按调用方传入的 lang 解析） */
  label: string
  keyEn: string
  groups?: SkillGroup[]
  /** 该技能是否存在数值条目（决定是否显示等级滑块） */
  hasNumbers: boolean
}

/* ---------- 技能等级范围（成长公式 main + growth*(lv-1)） ----------
 * 两段口径**必须分开**，混用会把「默认 12 级」直接顶成 16 级：
 *   基础上限 SKILL_LEVEL_MAX（12）= 技能本身能升到的等级，也是站内默认展示等级；
 *   实际上限 SKILL_LEVEL_CAP（16）= 再计入影画「技能等级+2」后的满影画口径。
 * 影画加成（数据实测，见 MINDSCAPE_SKILL_LEVEL_BONUS）作用在**除核心技外**的全部
 * 技能槽位上——含终结技：它虽未被影画文案列出，但与连携技同处一个升级节点
 * （`skill.chain` 槽、同一份 material），共享同一等级。核心技是独立系统（1-7 级，见
 * buildCoreSkill），不受本条影响。 */

/** 技能等级下限 */
export const SKILL_LEVEL_MIN = 1

/** 技能等级基础上限（未计影画加成）：技能本身可升到的最高等级 */
export const SKILL_LEVEL_MAX = 12

/** 默认展示等级：停在基础上限，即「默认 12 级」 */
export const SKILL_LEVEL_DEFAULT = SKILL_LEVEL_MAX

/** 影画带来的技能等级加成总量：影画 3 与影画 5 各 +2（live 60 名角色无一例外，
 *  文案恒为「[普通攻击]、[闪避]、[支援技]、[特殊技]、[连携技] 技能等级+2」）。
 *  后续若出现「+3」类档位，此处改为按档位求和即可，上限随之自动抬升。 */
export const MINDSCAPE_SKILL_LEVEL_BONUS = 4

/** 技能等级实际上限（满影画口径）：基础上限 + 影画加成 = 16 级。
 *  滑条**可达**到这里，但默认等级仍是 SKILL_LEVEL_DEFAULT（12）。 */
export const SKILL_LEVEL_CAP = SKILL_LEVEL_MAX + MINDSCAPE_SKILL_LEVEL_BONUS

/** KeyValueGrid 数值项 */
export interface StatItem {
  /** 标签（生命值/攻击力…） */
  label: string
  /** 显示值（已格式化） */
  value: string
  /** 可选角标（主属性/副属性） */
  tag?: string
}

/** 皮肤行（含缩略图资源名） */
export interface SkinRow {
  id: string
  name: string
  desc: string
  img: string
}

/** 将按键排序的字典（影画/精炼）转为 DetailRow[] */
export function dictToRows(
  dict: Record<string, unknown> | undefined | null,
): DetailRow[] {
  if (!dict) return []
  return Object.entries(dict)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([k, v]) => {
      const o = (v ?? {}) as { name?: string; desc?: string; desc2?: string }
      return { no: Number(k), name: o.name, desc: o.desc, desc2: o.desc2 }
    })
}

/* ---------- 技能槽位（角色详情） ---------- */

/** 展示顺序（站内约定，非游戏 UI 原序）：闪避挪到支援技之后，招式区以攻击系技能连贯呈现 */
export const SKILL_ORDER = ['basic', 'special', 'chain', 'ultimate', 'assist', 'dodge', 'core'] as const
export type SkillSlotKey = (typeof SKILL_ORDER)[number]


/** 技能槽位标签（四语；文案表在 domain/uiText，此处只做槽位→文案的映射） */
export const SKILL_LABELS: Record<SkillSlotKey, Loc> = {
  basic: uiLoc('detail.skillBasic'),
  dodge: uiLoc('detail.skillDodge'),
  special: uiLoc('detail.skillSpecial'),
  chain: uiLoc('detail.skillChain'),
  ultimate: uiLoc('detail.skillUltimate'),
  assist: uiLoc('detail.skillAssist'),
  core: uiLoc('detail.skillCore'),
}

/** 技能键位纹章：排印几何符号 + 等宽键名（无图片依赖，与档案风格同构） */
export const SKILL_KEYS: Record<SkillSlotKey, { glyph: string; en: string }> = {
  basic: { glyph: '□', en: 'NORMAL' },
  dodge: { glyph: '◇', en: 'DODGE' },
  special: { glyph: '△', en: 'SPECIAL' },
  chain: { glyph: '✕', en: 'CHAIN' },
  ultimate: { glyph: '◈', en: 'ULTIMATE' },
  assist: { glyph: '○', en: 'ASSIST' },
  core: { glyph: '◒', en: 'CORE' },
}

const SKILL_REF_RE = /\{Skill:(\d+),\s*Prop:\d+\}/

/** 纯数值子块的机制名：去「基础倍率/倍率」后缀（如「涡流集束手雷基础倍率」→「涡流集束手雷」）；
 *  既用于按机制名关联父招式，也用于潜能概述中代指派生技能子块。
 *  ⚠ 后缀是**数据里的游戏用词**（随语言落盘）：zh「基础倍率/倍率」、en「Base Multiplier/Multiplier」、
 *  ja「(の)基礎倍率/倍率」、ko「기본 배율/배율」。写死中文会在 en/ja/ko 数据上失配——
 *  派生名会连着后缀一起显示（潜能概述里读成「…Base Multiplier」），吸附也会退到 ID 兜底那条路。 */
const MULTIPLIER_SUFFIX: Loc = {
  zh: '(?:基础)?倍率',
  en: '(?:Base )?Multiplier',
  ja: '(?:の)?(?:基礎)?倍率',
  ko: '(?:기본 )?배율',
}

function mechanismName(name: string, lang: Lang): string {
  return name.replace(new RegExp(`${pickText(MULTIPLIER_SUFFIX, lang)}$`), '').trim()
}

/** 吸附退化匹配的文本归一化：剥富文本标记与装饰标点（term 与父文本同归一，保证 includes 一致） */
function normalizeDerivedText(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/\{[^}]*\}/g, '')
    .replace(/[「」『』“”‘’[\]]/g, '')
    .replace(/[：:\s·・]+/g, '')
}

/** 尾 token 段次后缀（如「第一段」）：吸附退化时整体剔除，避免阻断尾词命中（仅「段」字结尾，
 *  不认「式」——「恶虎七式」等系列名中的期数不是段次） */
const DERIVED_SEG_SUFFIX = /^(?:第?[一二三四五六七八九十百\d]+段)$/

/** 转置分组用：同时捕获 Skill ID 与 Prop（Prop 为指标维度键） */
const SKILL_REF_FULL_RE = /\{Skill:(\d+),\s*Prop:(\d+)\}/

/** 详细倍率块内单个条目（含公式与数值表） */
type DetailParam = {
  name?: string
  desc?: string
  param?: Record<string, SkillParamEntry | undefined>
}

/** 潜能档位 id 的下界（如 119100、118100）；低于此值视为基础标记 [0] */
export const POTENTIAL_ID_MIN = 100000

/** 招式是否由潜能影像门控（potential 含真实档位 id，如 119100…；[0] 表示基础版） */
export function isPotentialGated(potential: unknown): boolean {
  return (
    Array.isArray(potential) &&
    potential.some((id) => typeof id === 'number' && id >= POTENTIAL_ID_MIN)
  )
}

const POTENTIAL_ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'] as const

/** 由潜能 id 得到起始档案位（I-VI，取最早档，id 末两位 00-08 映射）；未门控返回 undefined */
export function potentialStartLevel(potential: unknown): string | undefined {
  if (!isPotentialGated(potential)) return undefined
  const min = Math.min(...(potential as number[]).filter((id) => id >= POTENTIAL_ID_MIN))
  const idx = min % 100
  return idx < POTENTIAL_ROMAN.length ? POTENTIAL_ROMAN[idx] : undefined
}

/**
 * description 数组里技能以「成对」出现：简单描述块（含真实 desc 文本）与详细/倍率块
 * （同名，含 param 数据、desc 为 {Skill:…} 占位符）。此函数把二者按 name 合并为有序
 * SkillGroup[]：说明文字取自同名简单块，数值取自详细块；纯文本招式只保留说明。
 * 潜能影像（potential）门控的招式会带上 potential/potentialType；
 * 同名下同时存在「基础版 + 强化版」时：基础版保留在 desc，强化版存入 strongDesc，供基础/潜能切换。
 */
function buildSkillGroups(
  descriptions: Array<{ name?: string; desc?: string; param?: unknown; potential?: unknown }> | undefined,
  lang: Lang,
): SkillGroup[] | undefined {
  if (!descriptions) return undefined
  /** 简单描述块的 name→desc 映射（说明文字源） */
  const descBy = new Map<string, string>()
  /** 出现过非门控（基础）描述的招式名：用于判定同名门控变体为「强化」而非「新增」 */
  const baseNames = new Set<string>()
  for (const block of descriptions) {
    if (block.param == null && typeof block.name === 'string' && typeof block.desc === 'string') {
      if (!isPotentialGated(block.potential)) baseNames.add(block.name)
      descBy.set(block.name, block.desc)
    }
  }
  /** 合并：创建/吸收组时记录门控信息 */
  const markGated = (g: SkillGroup, potential?: unknown) => {
    if (!isPotentialGated(potential) || g.potential) return
    g.potential = [...((potential as number[]) ?? [])]
    g.potentialType = baseNames.has(g.name) ? 'enhance' : 'new'
  }
  /** 按 name 合并、保持首次出现顺序 */
  const groups: SkillGroup[] = []
  const indexBy = new Map<string, number>()
  /** 派生技能子块的吸附关系：{子组下标, 父招式下标}，循环后统一重排让子组紧跟父级 */
  const attach: Array<{ parent: number; child: number }> = []
  for (const block of descriptions) {
    if (typeof block?.name !== 'string') continue
    if (Array.isArray(block.param) && block.param.length) {
      // 详细倍率块：追加数值条目
      const entries: SkillDetail[] = []
      for (const p of block.param as DetailParam[]) {
        if (!p || typeof p.desc !== 'string') continue
        const props = (p.param ?? {}) as Record<string, SkillParamEntry>
        const firstId = p.desc.match(SKILL_REF_RE)?.[1]
        entries.push({
          name: p.name ?? block?.name ?? '',
          formula: p.desc,
          props,
          format: firstId ? props[firstId]?.format : undefined,
        })
      }
      if (!entries.length) continue
      const gname = block?.name ?? ''
      let gi = indexBy.get(gname)
      /** 派生技能子块：无同名说明文字的独立命名纯数值块（如「涡流集束手雷基础倍率」）。
       *  与潜能无关——无论是否由潜能影像提供，一律标记并悬挂「派生技能」标签；
       *  机制名唯一命中父招式文本时再吸附其下 */
      const derived = !descBy.has(gname)
      if (gi == null) {
        // 吸附判定（逐级退化，唯一命中即采纳）：
        // 1) 完整机制名（去「基础倍率/倍率」后缀）——唯一命中即吸附；歧义（>1）直接维持
        //    独立，不继续退化（歧义护栏：文本提及多个招式时不以短词强行归并）；
        // 2) 0 命中 → 逐级退化：归一化完整名 → 去段次后缀（「第一段」等）→ 尾 token
        //    递进（「…·威势」「…·「虎威」」以最后词汇命中）。候选首个产生命中的即定案：
        //    唯一 → 吸附；歧义 → 终止（跨族候选无子串单调性，更短词唯一只是“碰巧”，
        //    不继续尝试）；
        // 3) 仍 0 → Skill ID 共享兜底：与某有说明的 param 组引用同一数值节点（派生公式
        //    复用父级数值，如「为所欲为」复用「惊喜开箱」的前闪攻击）。
        // 父候选仅限有说明文字的招式组（派生块自身不参与）。
        // 吸附关系先记录，循环末尾统一重排（期间组序索引不可变动，故不做即时插入）。
        if (derived) {
          const hit = (t: string): number[] => {
            const nt = normalizeDerivedText(t)
            if (!nt) return []
            const out: number[] = []
            groups.forEach((g, i) => {
              if (g.derived) return
              const hay = normalizeDerivedText(
                [g.name, typeof g.desc === 'string' ? g.desc : '', g.strongDesc ?? ''].join('\n'),
              )
              if (hay.includes(nt)) out.push(i)
            })
            return out
          }
          let matched = hit(mechanismName(gname, lang))
          if (matched.length === 1) {
            attach.push({ parent: matched[0], child: groups.length })
          } else if (matched.length === 0) {
            const cands: string[] = []
            const add = (t?: string) => {
              if (t && !cands.includes(t)) cands.push(t)
            }
            add(normalizeDerivedText(gname))
            const tokens = gname.split(/[：·・\s]+/).filter(Boolean)
            if (tokens.length > 1) {
              const last = tokens[tokens.length - 1]
              if (DERIVED_SEG_SUFFIX.test(last)) add(tokens.slice(0, -1).join(''))
              for (let i = 1; i < tokens.length; i++) add(tokens.slice(i).join(''))
            }
            for (const cand of cands) {
              matched = hit(cand)
              if (matched.length > 0) break
            }
            if (matched.length === 1) {
              attach.push({ parent: matched[0], child: groups.length })
            } else if (matched.length === 0) {
              // Skill ID 共享兜底（仅剩无任何文本信号的情形）
              const own = new Set(entries.flatMap((e) => [...e.formula.matchAll(/Skill:(\d+)/g)].map((m) => m[1])))
              if (own.size) {
                const shared: number[] = []
                groups.forEach((g, i) => {
                  if (g.derived) return
                  if (
                    (g.entries ?? []).some((en) =>
                      [...en.formula.matchAll(/Skill:(\d+)/g)].some((m) => own.has(m[1])),
                    )
                  )
                    shared.push(i)
                })
                if (shared.length === 1) attach.push({ parent: shared[0], child: groups.length })
              }
            }
          }
        }
        gi = groups.length
        indexBy.set(gname, gi)
        groups.push({ name: gname, desc: descBy.get(gname) })
      }
      const g = groups[gi]
      if (derived) g.derived = true
      markGated(g, block.potential)
      const entryArr = g.entries ?? (g.entries = [])
      entryArr.push(...entries)
    } else if (block.param == null && typeof block.desc === 'string') {
      // 简单描述块：保留说明文字（若已被数值组占用则补上 desc）
      const gname = block.name
      const gi = indexBy.get(gname)
      if (gi == null) {
        const g: SkillGroup = { name: gname, desc: block.desc }
        markGated(g, block.potential)
        indexBy.set(gname, groups.length)
        groups.push(g)
      } else {
        const g = groups[gi]
        if (isPotentialGated(block.potential)) {
          // 门控（强化版）：补上潜在标签；基础版保留在 desc，强化版存入 strongDesc，供基础/潜能切换
          markGated(g, block.potential)
          if (g.strongDesc == null) g.strongDesc = block.desc
          if (g.desc == null) g.desc = block.desc
        } else if (g.desc == null) {
          g.desc = block.desc
        }
      }
    }
  }
  // 吸附重排：派生技能子块（数据中常位于槽位整体末尾）移到父招式之后，紧跟其下
  if (attach.length) {
    const moved = new Set(attach.map((a) => a.child))
    const ordered: SkillGroup[] = []
    const append = (i: number) => {
      ordered.push(groups[i])
      for (const a of attach) if (a.parent === i) append(a.child)
    }
    groups.forEach((_, i) => {
      if (!moved.has(i)) append(i)
    })
    return ordered.length ? ordered : undefined
  }
  return groups.length ? groups : undefined
}

/** 明确引用某个具名终结技的文本（如「[终结技：残心]发动后自动派生」）：视为终结技的派生/关联招式。
 *  ⚠ 判据必须用**当前语言**的槽位名：详情 JSON 是按语言落盘的（en/ja/ko 的组名与引用
 *  都是该语言的写法），写死中文会在非中文页面失配、把终结技并回连携技那一行。 */
function ultimateNamedRefRe(lang: Lang): RegExp {
  const label = pickText(SKILL_LABELS.ultimate, lang)
  return new RegExp('\\[' + label + '[：:]')
}

/** 是否为终结技及其派生/关联招式（与连携技同处 game 的 chain 槽，需拆分为独立行）。
 *  招式名以「终结技：」开头，或描述里明确引用某个具名终结技（如自动派生招）都归入终结技行。 */
function isUltimateGroup(g: SkillGroup, lang: Lang, namedRef: RegExp): boolean {
  if (g.name.startsWith(pickText(SKILL_LABELS.ultimate, lang))) return true
  return namedRef.test(`${g.desc ?? ''}\n${g.strongDesc ?? ''}`)
}

/** 由槽位 key + 语义组构建一行技能（供 buildSkillRows 复用） */
function makeSkillRow(k: SkillSlotKey, groups: SkillGroup[] | undefined, lang: Lang): SkillRow {
  return {
    key: k,
    label: pickText(SKILL_LABELS[k], lang),
    keyEn: SKILL_KEYS[k]?.en ?? k.toUpperCase(),
    groups,
    hasNumbers: !!groups?.some((g) => g.entries?.length),
  }
}

/** 从角色详情的 skill 字典构建有序 SkillRow[]（按游戏 UI 顺序） */
export function buildSkillRows(
  skill: Record<string, unknown> | undefined | null,
  lang: Lang,
): SkillRow[] {
  if (!skill) return []
  const rows: SkillRow[] = []
  for (const k of SKILL_ORDER) {
    if (skill[k] == null) continue
    const desc = (skill[k] as
      | { description?: Array<{ name?: string; desc?: string; param?: unknown }> }
      | undefined)?.description
    const groups = buildSkillGroups(desc, lang)
    // 终结技与连携技在数据里合并为一个 chain 槽，但语义不同：按名称前缀拆成
    // 「连携技（CHAIN）」与「终结技（ULTIMATE）」两行，终结技独立成组。
    if (k === 'chain' && groups) {
      const namedRef = ultimateNamedRefRe(lang)
      const chain = groups.filter((g) => !isUltimateGroup(g, lang, namedRef))
      const ultimate = groups.filter((g) => isUltimateGroup(g, lang, namedRef))
      if (chain.length) rows.push(makeSkillRow('chain', chain, lang))
      if (ultimate.length) rows.push(makeSkillRow('ultimate', ultimate, lang))
    } else {
      rows.push(makeSkillRow(k, groups, lang))
    }
  }
  return rows
}

/** 详细行的最终展示值（代入所选等级后格式化） */
export function skillDetailValue(detail: SkillDetail, level: number): string {
  // 静态文本条目（邦布）：直接取该级原文，无公式求值
  if (detail.values?.length) {
    const L = Math.min(Math.max(level, 1), detail.values.length)
    return detail.values[L - 1] ?? '—'
  }
  // {CAL:…} 内嵌公式占位（如 蕾米埃尔 相变时流「伤害提升」，无 {Skill:} 数值表）：
  // 全量替换为等级代入数值——一条内可同时含文本与多个占位（如 露西「加油！」攻击力提升），
  // 单位/缀词为占位外的普通文案，原样保留，绝不让原始标记外泄（引擎在 ./skillFormula）。
  if (detail.formula.includes('{CAL:')) return replaceCalTokens(detail.formula, level)
  return formatSkillScalar(evaluateSkillFormula(detail.formula, detail.props, level), detail.format)
}

/* ---------- 技能段×指标转置表 ---------- */

/** 段×指标转置表：行=共享 Skill 的段次，列=指标（Prop），值=该级展示串 */
export interface SkillMetricTable {
  /** 行标签列头（转置行标签为段名等，无统一列名时留空） */
  rowLabel: string
  /** 列（指标）：label + propId；仅收录全体招式共享的指标（矩阵保持稠密，无空位） */
  columns: Array<{ label: string; propId: number }>
  /** 行（段次）：label + 按 propId 索引的展示值 */
  rows: Array<{ label: string; values: Record<string, string> }>
  /** 组内不属共享矩阵的条目（静态文本如充能计数、或仅部分招式拥有的指标），独立成补充行 */
  extras?: SkillDetail[]
}

/** 条目名共享前缀（转置行标签/列头的切分依据）；无共享时为 '' */
function commonPrefix(names: string[]): string {
  let p = names[0] ?? ''
  for (const n of names.slice(1)) {
    let i = 0
    while (i < p.length && i < n.length && p[i] === n[i]) i++
    p = p.slice(0, i)
    if (!p) break
  }
  return p
}

/** 条目名共享后缀（从尾部向前比；用于区分重复行标签，如「一段（物理）」补「（物理）」） */
function commonSuffix(strs: string[]): string {
  if (!strs.length) return ''
  let s = strs[0] ?? ''
  for (const n of strs.slice(1)) {
    let i = 0
    while (i < s.length && i < n.length && s[s.length - 1 - i] === n[n.length - 1 - i]) i++
    s = s.slice(s.length - i)
    if (!s) break
  }
  return s
}

/** 公式引用的全部 Skill ID 集合（tiebreaker 配对依据） */
function formulaSkillIds(formula: string): Set<string> {
  const s = new Set<string>()
  const re = /\{Skill:(\d+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(formula))) s.add(m[1])
  return s
}

/**
 * 把技能组转置为「段×指标」表：行 = 名称共享同一主体前缀的招式（一段/二段/三段、
 * 对小体型/中体型/大体型敌人、回旋斩击/快速剪击…），列 = 指标（Prop，伤害倍率/失衡倍率…）。
 * 行分组按名称 LCP 配对（而非 Skill 引用，因「霜锋」等按体型拆分时公式共用一个 Skill）；
 * LCP 平局时用公式的 Skill 集合 Jaccard 相似度（交集/并集）最大者裁决（如
 * 「一段失衡倍率（物理）」归属 Skill 完全相同的「一段伤害倍率（物理）」行，而非「（以太）」行；
 * 「三段（协同）」行因多引用一个 Skill 而得分更低，得以与「三段」行区分）。
 * 行标签 = 该行条目名公共前缀，重复时补「去列标签后的公共后缀」（如 一段/一段（物理）/一段（以太））；
 * 列头 = 每行同名条目「去行主题后缀」的公共前缀（不要求全一致，容忍「（物理）」类行后缀）。
 * 矩阵取「行 × 指标列」的极大双向全覆盖子矩阵（≥2 列且≥2 行才构成真正的表：1×M 退化形态
 * 无纵向对比、退回列表），故矩阵自身无空位；
 * 覆盖不上的条目一律退居 extras 补充行（不阻断表格）：静态文本（无 Skill 引用，如「1点」充能计数）、
 * 对不上任何行的孤立条目（如普罗米娅「披风切割每秒伤害倍率」，披风持续切割无段次可配）、
 * 以及缺某指标的行（如克拉蕾「毁伤」只有伤害无失衡）。
 * 连补充行也凑不出 ≥2×≥2 时返回 null，由调用方退回原纵向列表。
 */
export function buildSkillMetricTable(
  group: SkillGroup,
  level: number,
): SkillMetricTable | null {
  const entries = group.entries ?? []
  if (!entries.length) return null

  // 拆解：含 Skill 引用的条目参与矩阵；静态文本条目直接归入补充行
  const refs: Array<{ detail: SkillDetail; propId: number }> = []
  for (const en of entries) {
    const m = en.formula.match(SKILL_REF_FULL_RE)
    if (m) refs.push({ detail: en, propId: Number(m[2]) })
  }
  if (!refs.length) return null

  /** 最长公共前缀长度 */
  const lcpLen = (a: string, b: string): number => {
    let n = 0
    while (n < a.length && n < b.length && a[n] === b[n]) n++
    return n
  }

  // 按指标（Prop）分列，列序 = 首现序
  const columns: Array<{ propId: number; items: SkillDetail[] }> = []
  const colIndex = new Map<number, number>()
  for (const r of refs) {
    let i = colIndex.get(r.propId)
    if (i == null) {
      i = columns.length
      colIndex.set(r.propId, i)
      columns.push({ propId: r.propId, items: [] })
    }
    columns[i].items.push(r.detail)
  }
  if (columns.length < 2) return null

  // 参考列 = 条目最多者（行数来源；并列取先出现）
  let refIdx = 0
  for (let i = 1; i < columns.length; i++) {
    if (columns[i].items.length > columns[refIdx].items.length) refIdx = i
  }
  const refCol = columns[refIdx]
  // 转置价值门槛：≥2 行才有「段次×指标」的交叉对比（行=段次/主体、列=指标）；
  // 单行矩阵无段次对比维度，退回列表（当前单行均双指标，如妮可「冲刺攻击：为所欲为」）
  if (refCol.items.length < 2) return null
  const refNames = refCol.items.map((d) => d.name ?? '')
  const refSkills = refCol.items.map((d) => formulaSkillIds(d.formula))

  // 行配对：非参考列条目分配到 LCP 最长的参考条目所在行；
  // LCP 平局时以公式 Skill 集合 Jaccard 相似度最大者裁决（交集为 0 或仍并列 → 无法配对）；
  // 无法配对者经下方 extras 收集归入补充行，不阻断矩阵
  const rowMap: Array<Map<number, SkillDetail>> = refCol.items.map(() => new Map())
  for (let c = 0; c < columns.length; c++) {
    if (c === refIdx) continue
    for (const en of columns[c].items) {
      const name = en.name ?? ''
      let bestLen = 0
      let ties: number[] = []
      for (let r = 0; r < refNames.length; r++) {
        const len = lcpLen(refNames[r], name)
        if (len > bestLen) { bestLen = len; ties = [r] }
        else if (len === bestLen && len > 0) ties.push(r)
      }
      if (bestLen === 0) continue
      let target = -1
      if (ties.length === 1) {
        target = ties[0]
      } else {
        // tiebreaker：与参考行公式的 Skill 集合 Jaccard 相似度最大者
        // （交集/并集；完全相等的集合得 1.0，部分共享的「（协同）」行得分更低，如
        //   {1511006} vs {1511006} = 1.0 vs {1511006,1511018} = 0.5）
        const es = formulaSkillIds(en.formula)
        const esArr = [...es]
        let bestSim = -1, bestRow = -1, tie2 = false
        for (const r of ties) {
          let ov = 0
          for (const id of esArr) if (refSkills[r].has(id)) ov++
          const union = new Set([...esArr, ...refSkills[r]]).size
          const sim = union ? ov / union : 0
          if (sim > bestSim) { bestSim = sim; bestRow = r; tie2 = false }
          else if (sim === bestSim && sim > 0) tie2 = true
        }
        if (bestRow < 0 || bestSim === 0 || tie2) continue
        target = bestRow
      }
      rowMap[target].set(columns[c].propId, en)
    }
  }

  // 行 × 列取极大全覆盖子矩阵：先淘汰「凑不成列」的指标（被 ≥2 行覆盖才成列，单条目列
  // 无「段×指标」可对比），再淘汰「覆盖不全」的行；互删至稳定。
  // 被删条目退居 extras 而不阻断表格——如普罗米娅「披风切割每秒伤害倍率」（披风持续切割
  // 无段次可配，只在伤害列出现）、克拉蕾「毁伤伤害倍率」（该招式无失衡指标）。
  // 参考列天然被每行覆盖，恒留在子矩阵内；列序沿用原判据（参考列打头，其余按首现序）
  const covers = (r: number, p: number): boolean => p === refCol.propId || rowMap[r].has(p)
  let rowIdx = refCol.items.map((_, r) => r)
  let complete: number[] = [
    refCol.propId,
    ...columns.map((c) => c.propId).filter((p) => p !== refCol.propId),
  ]
  for (;;) {
    const keptCols = complete.filter((p) => rowIdx.filter((r) => covers(r, p)).length >= 2)
    const keptRows = rowIdx.filter((r) => keptCols.every((p) => covers(r, p)))
    if (keptCols.length === complete.length && keptRows.length === rowIdx.length) break
    complete = keptCols
    rowIdx = keptRows
  }
  if (rowIdx.length < 2 || complete.length < 2) return null
  const completeSet = new Set(complete)

  // 行主题初值 = 该行稠密列条目名的公共前缀；任一为空则退回列表
  const subjects: string[] = []
  for (const r of rowIdx) {
    const names = [refCol.items[r].name ?? '']
    for (const [p, d] of rowMap[r]) {
      if (completeSet.has(p)) names.push(d.name ?? '')
    }
    const subject = commonPrefix(names)
    if (!subject) return null
    subjects.push(subject)
  }

  // 列标签 = 该列所有条目「去行主题后缀」的公共前缀（不要求全一致）；
  // 公共前缀若止于全角开括号「（」，说明吸入了行后缀的起始（如「一段伤害倍率（物理）」列
  // 无裸「伤害倍率」行夹住前缀），剔除该括号
  const colLabel = new Map<number, string>()
  for (const p of complete) {
    const pre: string[] = []
    for (let i = 0; i < rowIdx.length; i++) {
      const entry = p === refCol.propId ? refCol.items[rowIdx[i]] : rowMap[rowIdx[i]].get(p)!
      pre.push((entry.name ?? '').slice(subjects[i].length))
    }
    const raw = commonPrefix(pre)
    const label = raw.endsWith('（') ? raw.slice(0, -1) : raw
    if (!label) return null
    colLabel.set(p, label)
  }

  // 行标签 = 行主题 + 该行条目「去行主题、再去列标签」后的公共后缀（区分重复行）；
  // 补全后仍重复 → 无法构成可读矩阵，退回列表
  const rows: SkillMetricTable['rows'] = []
  for (let i = 0; i < rowIdx.length; i++) {
    const leftovers: string[] = []
    for (const p of complete) {
      const entry = p === refCol.propId ? refCol.items[rowIdx[i]] : rowMap[rowIdx[i]].get(p)!
      const s = (entry.name ?? '').slice(subjects[i].length)
      const label = colLabel.get(p)!
      leftovers.push(s.startsWith(label) ? s.slice(label.length) : s)
    }
    rows.push({ label: subjects[i] + commonSuffix(leftovers), values: {} })
  }
  if (new Set(rows.map((x) => x.label)).size < rows.length) return null

  // 填充矩阵值（代入所选等级）
  for (let i = 0; i < rows.length; i++) {
    for (const p of complete) {
      const entry = p === refCol.propId ? refCol.items[rowIdx[i]] : rowMap[rowIdx[i]].get(p)!
      rows[i].values[String(p)] = skillDetailValue(entry, level)
    }
  }

  // 补充行：未进矩阵的条目（静态文本、孤立条目、缺指标的行），按组内原序
  const placed = new Set<SkillDetail>()
  for (const r of rowIdx) {
    placed.add(refCol.items[r])
    for (const p of complete) {
      if (p !== refCol.propId) placed.add(rowMap[r].get(p)!)
    }
  }
  const extras = entries.filter((en) => !placed.has(en))

  return {
    rowLabel: '',
    columns: complete.map((p) => ({ label: colLabel.get(p)!, propId: p })),
    rows,
    extras,
  }
}

/** 从皮肤字典构建有序 SkinRow[]（按皮肤 id 排序） */
export function buildSkinRows(
  skins: Record<string, unknown> | undefined | null,
): SkinRow[] {
  if (!skins) return []
  return Object.entries(skins)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([k, v]) => ({
      id: k,
      name: (v as { name?: string }).name ?? '',
      desc: (v as { desc?: string }).desc ?? '',
      img: (v as { image?: string }).image ?? '',
    }))
}

/* ---------- 邦布技能槽位（邦布详情页） ---------- */

export const BANGBOO_SKILL_ORDER = ['a', 'b', 'c'] as const
export type BangbooSkillKey = (typeof BANGBOO_SKILL_ORDER)[number]

/** 邦布技能槽位标签（四语；文案表在 domain/uiText） */
export const BANGBOO_SKILL_LABELS: Record<BangbooSkillKey, Loc> = {
  a: uiLoc('detail.bangbooActiveSkill'),
  b: uiLoc('detail.bangbooExtraAbility'),
  c: uiLoc('detail.bangbooChain'),
}

/** 邦布技能数值条目缺 property 列时的占位名（四语：「属性 {n}」） */
const PROP_PLACEHOLDER = uiLoc('detail.propN')

export interface BangbooSkillRow {
  key: BangbooSkillKey
  /** 槽位展示名（按调用方传入的 lang 解析） */
  label: string
  names: string[]
  /** 各级描述去重（不同级仅数值变化，取原文） */
  desc: string
  /** 各级原始描述（与等级一一对应，含富文本；随所选等级展示） */
  descs: string[]
  /** 技能等级上限（a/c=10、b=5；无 level 数据为 0） */
  levelCount: number
  /** 每级 param 按 | 分割的 token（与 stats 条目一一对应） */
  tokens: string[][]
  /** 数值条目（属性名 + 是否含 skill_prop 引用） */
  stats: BangbooSkillStat[]
  /** skill_prop 数值表（skillId → propId → entry），供引用条目随等级求值 */
  propMap: Record<string, Record<string, SkillParamEntry>>
}

/** 邦布技能数值条目（param 分割，与 property 列对齐） */
export interface BangbooSkillStat {
  /** 属性名（property 列缺失时按序号兜底） */
  name: string
  /** 是否含 {Skill:…} 引用（可随等级计算；否则为静态文本如 20秒） */
  referenced: boolean
}

/**
 * 从邦布详情的 skill + skill_prop 构建有序技能行（按 a/b/c 顺序）。
 * param 为每级独立的「|」分隔串：{Skill:ID, Prop:P} 引用（或嵌套公式）对应 skill_prop
 * 数值，其余为静态文本（如冷却时间/生命回复）。
 */
export function buildBangbooSkills(
  skill: Record<string, unknown> | undefined | null,
  skillProp: unknown,
  lang: Lang,
): BangbooSkillRow[] {
  if (!skill) return []
  const propMap = (skillProp ?? {}) as Record<string, Record<string, SkillParamEntry>>
  return BANGBOO_SKILL_ORDER.filter((k) => skill[k] != null).map((k) => {
    const levels = ((skill[k] as { level?: Record<string, unknown> })?.level ??
      {}) as Record<string, { name?: string; desc?: string; property?: string[]; param?: string }>
    const ordered = Object.keys(levels)
      .sort((a, b) => Number(a) - Number(b))
      .map((o) => levels[o])
      .filter(Boolean)
    const names = [...new Set(
      ordered.map((l) => l?.name ?? '').filter(Boolean),
    )]
    const tokens = ordered.map((l) => String(l?.param ?? '').split('|'))
    const tokenCount = Math.max(0, ...tokens.map((t) => t.length))
    const stats: BangbooSkillStat[] = []
    for (let i = 0; i < tokenCount; i++) {
      const prop = ordered[0]?.property?.[i]
      stats.push({
        name: prop && prop.trim() ? prop : fmt(PROP_PLACEHOLDER[lang], { n: i + 1 }),
        referenced: tokens.some((t) => t[i]?.includes('{Skill:')),
      })
    }
    return {
      key: k,
      label: pickText(BANGBOO_SKILL_LABELS[k], lang),
      names,
      desc: ordered[0]?.desc ?? '',
      descs: ordered.map((l) => l?.desc ?? ''),
      levelCount: ordered.length,
      tokens,
      stats,
      propMap,
    }
  })
}

/**
 * 邦布技能条目的展示值（代入所选等级）：
 * - {Skill:…} 引用/嵌套公式 → 经 skill_prop 求值并按 format 格式化
 * - 静态文本（20秒/8%生命值…）→ 取该等级原文
 */
export function bangbooSkillStatValue(
  row: BangbooSkillRow,
  index: number,
  level: number,
): string {
  const L = Math.min(Math.max(level, 1), Math.max(row.levelCount, 1))
  const token = row.tokens[L - 1]?.[index]
  if (!token) return '—'
  if (!token.includes('{Skill:')) return token
  const ref = token.match(/Skill:(\d+),\s*Prop:(\d+)/)
  const format = ref ? row.propMap[ref[1]]?.[ref[2]]?.format : undefined
  return formatSkillScalar(evaluateSkillFormula(token, row.propMap, L), format)
}

/* ============================================================
 * 核心技（passive）：核心被动 + 额外能力，随等级强化。
 * 数据源：角色详情的 passive.level 等级字典，每条记录含
 *   level（核心技等级，1-7）、name[2]（核心被动名 / 额外能力名）、
 *   desc[2]（对应描述，富文本）。
 * 结构：7 条 = 基础 7 级；14 条 = 两轮 1-7（第 2 轮为「强化」版：
 *   核心被动/额外能力效果更强，如猫又核心被动持续 6s→40s）。
 * ============================================================ */

/** 核心技单级记录 */
export interface CoreSkillLevel {
  /** 展示序号（1-based，按数据记录序） */
  no: number
  /** 核心技等级（数据 level 字段；两轮结构时 1-7 循环） */
  level: number
  /** 是否为「强化」版（两轮结构的第 2 轮起） */
  enhanced: boolean
  /** 强化版来源档位（潜能影像，如 'I'）；基础版为 undefined */
  potentialTag?: string
  /** 核心被动名 */
  coreName: string
  /** 额外能力名 */
  extraName: string
  /** [核心被动 desc, 额外能力 desc]（原始富文本，展示层经 rich.ts 处理） */
  desc: [string, string]
}

/** 核心技两组名称的兜底（数据缺 name 时用；四语） */
const CORE_PASSIVE_NAME = uiLoc('detail.corePassive')
const EXTRA_ABILITY_NAME = uiLoc('detail.bangbooExtraAbility')

/** 核心技聚合数据 */
export interface CoreSkill {
  /** 核心被动名（各级一致） */
  coreName: string
  /** 额外能力名（各级一致） */
  extraName: string
  /** 核心技等级数（去重后，7；两轮结构仍为 7） */
  levelCount: number
  /** 是否存在「强化」版（14 条结构时 true） */
  hasEnhance: boolean
  /** 各级记录（按序） */
  levels: CoreSkillLevel[]
}

/** 从 passive 字典构建核心技数据；无数据时返回 null */
export function buildCoreSkill(
  passive: Record<string, unknown> | undefined | null,
  lang: Lang,
): CoreSkill | null {
  const level = (passive as { level?: Record<string, unknown> } | undefined)?.level
  if (!level) return null
  const records = Object.values(level)
    .map((v) => v as Record<string, unknown>)
    .filter((v) => Array.isArray(v?.name) && Array.isArray(v?.desc))
    .map((v) => ({
      level: Number(v?.level) || 0,
      potential: v?.potential,
      coreName: String((v.name as string[])[0] ?? CORE_PASSIVE_NAME[lang]),
      extraName: String((v.name as string[])[1] ?? EXTRA_ABILITY_NAME[lang]),
      desc: [(v.desc as string[])[0] ?? '', (v.desc as string[])[1] ?? ''] as [string, string],
    }))
  if (!records.length) return null
  // 两轮结构检测：level 字段去重后数量 < 记录数（如 7 < 14）→ 第 2 轮起为强化版
  const levelCount = new Set(records.map((r) => r.level)).size
  const hasEnhance = levelCount > 0 && levelCount < records.length
  return {
    coreName: records[0].coreName,
    extraName: records[0].extraName,
    levelCount,
    hasEnhance,
    levels: records.map((r, i) => ({
      no: i + 1,
      level: r.level,
      enhanced: hasEnhance && i >= levelCount,
      potentialTag: potentialStartLevel(r.potential),
      coreName: r.coreName,
      extraName: r.extraName,
      desc: r.desc,
    })),
  }
}

/* ============================================================
 * 核心技强化（extra_level）：核心技的独立强化条目。
 * 每档有解锁等级门槛（max_level: 15/25/35/45/55/60）与属性加成
 * （extra 字典：prop/name/format/value）。
 * 注意 value 语义为「截至该档的累计值」；游戏面板按「本档新增量」
 * 展示（两属性交替递增：冲击力+6 → 基础攻击力+25 → 冲击力+6 …），
 * 故 buildCoreEnhance 输出为每档与上一档的差值（新增量）。
 * 与「潜能影像」（potential_detail，V2.5 激发潜能）是不同系统。
 * ============================================================ */

/** 核心技强化单条属性加成（value 为本档新增量，raw 数据单位） */
export interface CoreEnhanceBonus {
  /** 属性码（hakushin prop 码，如 30501；比中文名稳定，改名不失效） */
  prop?: number
  /** 属性名（如「暴击率」「基础攻击力」） */
  name: string
  /** 本档新增量（raw 数据单位；百分比字段为万分比，如 480 = 4.8%） */
  value: number
  /** hakushin 格式串（{0:0.#%} 等） */
  format?: string
  /** 格式化显示串（如「4.8%」「25」「0.12」） */
  text: string
}

/** 核心技强化档位（A-F） */
export interface CoreEnhanceLevel {
  /** 档位编号（A-F） */
  no: string
  /** 解锁等级门槛（max_level） */
  unlockAt: number
  /** 该档新增属性加成（与上一档的差值，0 新增已过滤） */
  bonus: CoreEnhanceBonus[]
}

/** 按 hakushin format 串格式化强化值 */
export function formatCoreEnhance(value: number, format?: string): string {
  const f = format ?? '{0:0.#}'
  if (f.includes('%')) {
    return `${(value / 100).toFixed(1).replace(/\.0$/, '')}%`
  }
  if (f.includes('##')) return value.toFixed(2).replace(/\.?0+$/, '')
  if (f.includes('.#')) return value.toFixed(1).replace(/\.0$/, '')
  return String(Math.round(value))
}

/** 核心技强化档位编号（A-F，与游戏内核心技 A/B/C 等级口径一致） */
const ENHANCE_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']

/** 属性显示缩放：raw 值除以该系数得到游戏展示值。
 *  key 用属性码而非中文名（文案改名不失效）；数据验证 prop 码 100% 覆盖。
 *  基础能量自动回复（30501）以「百分位每秒」存储（12 = 0.12 点/秒），
 *  format 串 {0:0.##} 不含该缩放，需在此补齐（否则会误显为「+12」）。
 *  新增属性时先用探针扫描 format={0:0.##} 的属性集，确认是否需补缩放。 */
const ENHANCE_SCALE: Record<number, number> = {
  30501: 100,
}

/** raw 值 → 游戏展示值（按属性码缩放） */
function scaleEnhance(prop: number, raw: number): number {
  return raw / (ENHANCE_SCALE[prop] ?? 1)
}

/** 生成展示串：raw 值先按属性缩放，再按 format 格式化 */
function enhanceText(prop: number, raw: number, format?: string): string {
  return formatCoreEnhance(scaleEnhance(prop, raw), format)
}

/** 从 extra_level 字典构建核心技强化档位列表（按档序）；
 *  value 语义为「累计值」，此处输出每档新增量（与上一档差值）；无数据时返回 [] */
export function buildCoreEnhance(
  extraDict: Record<string, unknown> | undefined | null,
): CoreEnhanceLevel[] {
  if (!extraDict) return []
  // 按属性码追踪累计值（数据验证 prop 100% 存在；缺位时退回属性名保持合并语义）
  let prev = new Map<number | string, { value: number; format?: string }>()
  return Object.entries(extraDict)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([k, v]) => {
      const o = (v ?? {}) as Record<string, unknown>
      const bonus: CoreEnhanceBonus[] = []
      const next = new Map<number | string, { value: number; format?: string }>()
      for (const e of Object.values((o.extra ?? {}) as Record<string, unknown>)) {
        const p = (e ?? {}) as { name?: string; format?: string; value?: number; prop?: unknown }
        const name = String(p.name ?? '')
        const prop = Number(p.prop) || 0
        const key = prop || name
        const value = Number(p.value) || 0
        const delta = value - (prev.get(key)?.value ?? 0)
        next.set(key, { value, format: p.format })
        if (delta <= 0) continue
        bonus.push({
          prop: prop || undefined,
          name,
          value: delta,
          format: p.format,
          text: enhanceText(prop, delta, p.format),
        })
      }
      prev = next
      return {
        no: ENHANCE_LABELS[Number(k) - 1] ?? String(k),
        unlockAt: Number(o.max_level) || 0,
        bonus,
      }
    })
    .filter((l) => l.unlockAt > 0)
}

/** 核心技强化满级累计（各档新增量之和，与 buildCoreEnhance 同源缩放）；
 *  按属性码合并（真实数据同名异码不并现；未来出现时分行展示，语义更精确），
 *  format 取该属性末档（数据验证同属性跨档恒定；变化时总量以末档为准） */
export function coreEnhanceTotal(
  levels: readonly CoreEnhanceLevel[],
): CoreEnhanceBonus[] {
  const acc = new Map<number | string, CoreEnhanceBonus>()
  for (const lv of levels) {
    for (const b of lv.bonus) {
      const key = b.prop ?? b.name
      const value = (acc.get(key)?.value ?? 0) + b.value
      acc.set(key, {
        prop: b.prop,
        name: b.name,
        value,
        format: b.format,
        text: enhanceText(b.prop ?? 0, value, b.format),
      })
    }
  }
  return [...acc.values()]
}

/* ============================================================
 * 潜能影像（potential_detail，V2.5「激发潜能」）：老角色加强系统。
 * 6 档（level_show_name 如「炽焰行歌 I」），档 I 为机制补强（无文字），
 * 档 II-VI 为数值补强（name 效果名 + desc 富文本）。
 * 与核心技强化（extra_level）是不同系统。
 * ============================================================ */

/** 潜能影像单档 */
export interface PotentialCinema {
  /** 档位号（I-VI，从 level_show_name 提取；无则用 id） */
  no: string
  /** 档位全名（如「炽焰行歌 I」） */
  label: string
  /** 效果名（如「潜能觉醒：绝焰」；档 I 通常为空） */
  name: string
  /** 效果描述（富文本；档 I 通常为空） */
  desc: string
}

const ROMAN_RE = /[IVXLCDM]+$/

/** 从 potential_detail 字典构建潜能影像档位列表（按档序）；无数据时返回 [] */
export function buildPotentialCinema(
  detail: Record<string, unknown> | undefined | null,
): PotentialCinema[] {
  if (!detail) return []
  return Object.entries(detail)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([k, v]) => {
      const o = (v ?? {}) as Record<string, unknown>
      const label = String(o.level_show_name ?? '')
      const m = label.match(ROMAN_RE)
      return {
        no: m?.[0] ?? String(k),
        label,
        name: String(o.name ?? ''),
        desc: String(o.desc ?? ''),
      }
    })
    .filter((p) => p.label || p.name || p.desc)
}

/**
 * 从技能门控信息反推档位概述：对 description 为空的潜能影像档位（如档 I，
 * 源数据 name/desc 为空），用其门控招式生成一句话概述（新增 X…；强化 Y…）。
 * 有原生描述（II-VI 档）的档位原样保留。
 */
export function synthesizePotentialCinema(
  skills: readonly SkillRow[],
  cinema: readonly PotentialCinema[],
  core: CoreSkill | null | undefined,
  lang: Lang,
): PotentialCinema[] {
  if (!cinema.length) return [...cinema]
  const added = new Map<string, string[]>()
  const enhanced = new Map<string, string[]>()
  for (const row of skills) {
    for (const g of row.groups ?? []) {
      const lv = potentialStartLevel(g.potential)
      if (!lv) continue
      const map = g.potentialType === 'new' ? added : enhanced
      const list = map.get(lv) ?? []
      // 纯数值门控子块（派生技能）以机制名入概述，不暴露「…基础倍率」类伪名
      list.push(g.derived && g.potentialType === 'new' ? mechanismName(g.name, lang) : g.name)
      map.set(lv, list)
    }
  }
  // 核心技的潜能「强化」版起档（如两轮结构第二轮自档 I），用于「核心被动/额外能力扩展」概述
  const coreStart = core?.hasEnhance
    ? core.levels[core.levelCount]?.potentialTag
    : undefined
  return cinema.map((p) => {
    if (p.desc) return p
    const parts: string[] = []
    const sep = pickText(LIST_SEP, lang)
    const a = added.get(p.no)
    if (a?.length) parts.push(fmt(pickText(POT_ADDED, lang), { list: a.join(sep) }))
    const e = enhanced.get(p.no)
    if (e?.length) parts.push(fmt(pickText(POT_ENHANCED, lang), { list: e.join(sep) }))
    if (coreStart === p.no) {
      parts.push(
        fmt(pickText(POT_EXTENDED, lang), {
          list: [pickText(CORE_PASSIVE_NAME, lang), pickText(EXTRA_ABILITY_NAME, lang)].join(sep),
        }),
      )
    }
    // 概述是**当前语言的句子**，句间分隔符也得随语言（写死中文「；」会让英文页出现
    // 「New: …；Enhanced: …」这种全角中文标点；与 listSep 同属标点，一并进文案表）
    return parts.length ? { ...p, desc: parts.join(pickText(SENTENCE_SEP, lang)) } : p
  })
}

/* ============================================================
 * 角色基础属性随等级成长（DESIGN.md P2：纯函数、无 Vue 依赖、可单测）。
 * 模型（已用游戏内 Lv.1/10/20/30/40/50/60 锚点验证）：
 *   属性(L) = floor( 1 级基础 + 该段累计突破加成 + growth/10000 × (L-1) )
 *   突破段取自 level 字典（hakushin ascension）。
 *   注意：核心技强化（extra_level）/ 潜能影像（potential_detail）均为独立
 *   养成系统，不随等级自动并入基础面板。
 * ============================================================ */

/** 角色等级范围（绝区零 1–60 级） */
export const CHAR_LEVEL_MIN = 1
export const CHAR_LEVEL_MAX = 60
export const CHAR_LEVEL_DEFAULT = CHAR_LEVEL_MAX

/** 突破段信息：level 字典中的一段（如 {1..6}） */
export interface CharBreakSegment {
  /** 突破段号（1-6，对应第几次突破后的段） */
  phase: number
  /** 段内等级下限（不含；段 1 为 0） */
  min: number
  /** 段内等级上限（含） */
  max: number
  /** 至该段为止的累计突破加成（生命值） */
  hp: number
  /** 至该段为止的累计突破加成（攻击力） */
  attack: number
  /** 至该段为止的累计突破加成（防御力） */
  defence: number
}

/** 从 level 字典解析出按段号排序的突破段（升序）；仅模块内使用（charBreakSegment / statAtLevel 链路） */
function parseCharBreaks(
  levelDict: Record<string, unknown> | undefined | null,
): CharBreakSegment[] {
  if (!levelDict) return []
  return Object.entries(levelDict)
    .filter(([, v]) => v && typeof v === 'object')
    .map(([, v]) => {
      const o = v as Record<string, unknown>
      return {
        min: Number(o.level_min) || 0,
        max: Number(o.level_max) || 0,
        hp: Number(o.hp_max) || 0,
        attack: Number(o.attack) || 0,
        defence: Number(o.defence) || 0,
      }
    })
    .sort((a, b) => a.min - b.min)
    .map((s, i) => ({ ...s, phase: i + 1 }))
}

/** 指定等级所属的突破段；无数据时返回 null */
export function charBreakSegment(
  levelDict: Record<string, unknown> | undefined | null,
  lv: number,
): CharBreakSegment | null {
  const segs = parseCharBreaks(levelDict)
  // 段判定：(min, max]（段 1 的 min=0），lv=60 落最后一段
  return segs.find((s) => lv > s.min && lv <= s.max) ?? null
}

/** 单属性成长：floor(基础 + 突破加成 + growth/10000 × (L-1))；L 钳制 ≥ 1（防越界负成长） */
export function statAtLevel(
  base: number,
  growth: number,
  breakBonus: number,
  lv: number,
): number {
  const L = Math.max(1, lv)
  return Math.floor(base + breakBonus + (growth / 10000) * (L - 1))
}

/* ---------- 完整面板（KeyValueGrid 数据源） ---------- */

/** 面板字段访问器：stats 字典取数值（非数字视为缺） */
type StatCell = number | string | unknown[]
function cell(s: Record<string, StatCell> | undefined, key: string): number | null {
  const v = s?.[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** 百分比展示：万分比数值 /100 保留 2 位（与旧 STAT_DEFS 一致） */
function pct(v: number): string {
  return `${(v / 100).toFixed(2)}%`
}

/**
 * 角色在指定等级下的基础面板（含突破加成；潜能为独立系统，不并入本表）。
 * 输出与 KeyValueGrid 直接兼容的 StatItem[]；stats 缺失时返回 []。
 */
/** 角色面板数值名（四语；文案表在 domain/uiText） */
const STAT_LABELS = {
  hp: uiLoc('detail.hp'),
  atk: uiLoc('detail.atk'),
  def: uiLoc('detail.def'),
  impact: uiLoc('detail.impact'),
  critRate: uiLoc('detail.critRate'),
  critDmg: uiLoc('detail.critDmg'),
  penRate: uiLoc('detail.penRate'),
  anomalyControl: uiLoc('detail.anomalyControl'),
  anomalyMastery: uiLoc('detail.anomalyMastery'),
  energyRegen: uiLoc('detail.energyRegen'),
} as const

export function characterStatsAtLevel(
  stats: Record<string, StatCell> | undefined,
  levelDict: Record<string, unknown> | undefined | null,
  lv: number,
  lang: Lang,
): StatItem[] {
  if (!stats) return []
  const seg = charBreakSegment(levelDict, lv)
  const segHp = seg?.hp ?? 0
  const segAtk = seg?.attack ?? 0
  const segDef = seg?.defence ?? 0
  const s = (k: keyof typeof STAT_LABELS) => pickText(STAT_LABELS[k], lang)
  const rows: Array<[string, string | null]> = [
    [s('hp'), numStr(cell(stats, 'hp_max'), cell(stats, 'hp_growth'), segHp, lv)],
    [s('atk'), numStr(cell(stats, 'attack'), cell(stats, 'attack_growth'), segAtk, lv)],
    [s('def'), numStr(cell(stats, 'defence'), cell(stats, 'defence_growth'), segDef, lv)],
    [s('impact'), cell(stats, 'break_stun') != null ? String(cell(stats, 'break_stun')) : null],
    [s('critRate'), pctOrNull(cell(stats, 'crit'))],
    [s('critDmg'), pctOrNull(cell(stats, 'crit_damage'))],
    [s('penRate'), pctOrNull(cell(stats, 'pen_rate'))],
    [s('anomalyControl'), cell(stats, 'element_mystery') != null ? String(cell(stats, 'element_mystery')) : null],
    [s('anomalyMastery'), cell(stats, 'element_abnormal_power') != null ? String(cell(stats, 'element_abnormal_power')) : null],
    [s('energyRegen'), cell(stats, 'sp_recover') != null ? String(cell(stats, 'sp_recover')) : null],
  ]
  return rows
    .filter((r): r is [string, string] => r[1] != null)
    .map(([label, value]) => ({ label, value }))
}

/** 成长属性的面板值（整数） */
function numStr(
  base: number | null,
  growth: number | null,
  bonus: number,
  lv: number,
): string | null {
  if (base == null) return null
  return String(statAtLevel(base, growth ?? 0, bonus, lv))
}

/** 百分比属性的面板值 */
function pctOrNull(v: number | null): string | null {
  if (v == null) return null
  return pct(v)
}

/* ---------- 音擎基础属性（等级滑条） ---------- */

/** 音擎等级范围（1-60，10 级一突破） */
export const W_ENGINE_LEVEL_MIN = 1
export const W_ENGINE_LEVEL_MAX = 60
export const W_ENGINE_LEVEL_DEFAULT = W_ENGINE_LEVEL_MAX

/**
 * 音擎主属性（基础攻击力）成长曲线，已突破口径（10/20/30/40/50 显示突破后）：
 * - Lv.1 = base，Lv.60 = max；M = max − base
 * - 段 1（Lv.1→Lv.10）走 11.25% M（9 步），随后每 10 级段走 11.25% M，
 *   每次突破瞬间 +6.5% M；与 BWIKI 详细面板断点吻合（±1 取整误差）。
 */
export function wEngineMainAt(lv: number, base: number, max: number): number {
  if (lv >= W_ENGINE_LEVEL_MAX) return max
  if (lv <= W_ENGINE_LEVEL_MIN) return base
  const M = max - base
  if (M <= 0) return base
  const seg = Math.floor(lv / 10) // 0..5（突破后段起点：Lv.10k = base + 17.75% M × k）
  if (seg === 0) {
    return Math.floor(base + M * 0.1125 * ((lv - 1) / 9))
  }
  return Math.floor(base + M * (0.1775 * seg + 0.01125 * (lv - 10 * seg)))
}

/**
 * 音擎副属性随等级成长：每 10 级突破 ×1.3（1 → 1.3 → 1.6 → 1.9 → 2.2 → 2.5 封顶）。
 * base 为万分比整数（如 960 = 9.6%），返回同量纲。
 */
export function wEngineRandAt(lv: number, base: number): number {
  const seg = Math.min(Math.floor(lv / 10), 5)
  return Math.round(base * (1 + 0.3 * seg))
}

/** 音擎当前等级的突破次数（0-5；Lv.10k 视为已突破） */
export function wEngineBreakCount(lv: number): number {
  return Math.min(Math.max(Math.floor(lv / 10), 0), 5)
}

/** 潜能概述合成用的前缀与列举分隔符（四语；见 synthesizePotentialCinema） */
const POT_ADDED = uiLoc('detail.potentialAdded')
const POT_ENHANCED = uiLoc('detail.potentialEnhanced')
const POT_EXTENDED = uiLoc('detail.potentialExtended')
const LIST_SEP = uiLoc('common.listSep')
/** 句间分隔符（与 listSep 成对：一个是列举项之间，一个是句子之间） */
const SENTENCE_SEP = uiLoc('common.sentenceSep')

/** 音擎属性账目的两类角标（四语） */
const MAIN_PROP_TAG = uiLoc('detail.mainProp')
const SUB_PROP_TAG = uiLoc('detail.subProp')

/**
 * 音擎在指定等级下的基础属性（主属性 + 副属性），输出与 KeyValueGrid 兼容。
 * 缺满级值（atk_max 未注入）时回退 Lv.1 静态值；% 格式按万分比 /100 显示。
 */
export function wEnginePropsAtLevel(
  lv: number,
  base: { name?: string; value?: number } | undefined | null,
  rand: { name?: string; value?: number; format?: string } | undefined | null,
  max: number | undefined,
  lang: Lang,
): StatItem[] {
  const items: StatItem[] = []
  const mainName = base?.name
  const randName = rand?.name
  if (mainName && base?.value != null) {
    const v = max != null ? wEngineMainAt(lv, base.value, max) : base.value
    items.push({ label: mainName, value: String(v), tag: pickText(MAIN_PROP_TAG, lang) })
  }
  if (randName && rand?.value != null) {
    const v = wEngineRandAt(lv, rand.value)
    const fmt = rand.format ?? ''
    items.push({
      label: randName,
      value: fmt.includes('%') ? `${(v / 100).toFixed(2)}%` : String(v),
      tag: pickText(SUB_PROP_TAG, lang),
    })
  }
  return items
}

/* ---------- 音擎精炼（阶数滑条） ---------- */

/** 音擎精炼阶数范围（1-5，满精炼 5 阶）：数据侧 `talents` 字典的键即阶数 */
export const W_ENGINE_REFINE_MIN = 1
export const W_ENGINE_REFINE_MAX = 5

/**
 * 取指定精炼阶的档位行：`talents` 里 1-5 阶是同一段效果的不同数值，
 * 详情页只呈现当前阶的那一份。数据缺该阶（源站形状变更 / 未收录满 5 阶）时
 * 取序号最接近的一档——调用方须用**该行自身的序号**标注阶数，宁可显示相邻阶
 * 并如实标注，也不留空白区（与名录卡片「缺基础档时如实标注实际档位」同一约定）。
 */
export function refineRowAt(rows: DetailRow[], level: number): DetailRow | null {
  if (!rows.length) return null
  const exact = rows.find((r) => r.no === level)
  if (exact) return exact
  return rows.reduce((best, r) => (Math.abs(r.no - level) < Math.abs(best.no - level) ? r : best))
}

/* ---------- 邦布基础属性（等级滑条） ---------- */

/** 邦布等级范围（1-60，10 级一突破，与角色/音擎一致） */
export const BANGBOO_LEVEL_MIN = 1
export const BANGBOO_LEVEL_MAX = 60
export const BANGBOO_LEVEL_DEFAULT = BANGBOO_LEVEL_MAX

/** 邦布当前等级的突破次数（0-5；Lv.10k 视为已突破） */
export function bangbooBreakCount(lv: number): number {
  return Math.min(Math.max(Math.floor(lv / 10), 0), 5)
}

/**
 * 邦布在指定等级下的面板（已突破口径，与角色/音擎一致）：
 * - 生命/攻击/防御：floor(基础 + 段累计突破加成 + 成长/10000 × (L-1))，段判定按突破后
 * - 暴击率/暴击伤害：Lv.1 基础 + 当前段 extra（万分数），突破时随段提升
 * - 冲击力/异常掌控/能量回复：不随等级变化
 * 输出与 KeyValueGrid 兼容；stats 缺失时返回 []。
 */
export function bangbooStatsAtLevel(
  stats: Record<string, StatCell> | undefined,
  levelDict: Record<string, unknown> | undefined | null,
  lv: number,
  lang: Lang,
): StatItem[] {
  if (!stats) return []
  const L = Math.min(Math.max(lv, BANGBOO_LEVEL_MIN), BANGBOO_LEVEL_MAX)
  const segs = parseCharBreaks(levelDict)
  // 已突破口径段号：Lv.10k 落入其突破后的段（10→段2 … 50→段6），无数据按段1
  const seg = segs[Math.min(Math.floor(L / 10) + 1, Math.max(segs.length, 1)) - 1]
  const segHp = seg?.hp ?? 0
  const segAtk = seg?.attack ?? 0
  const segDef = seg?.defence ?? 0

  // 段 extra（暴击率/暴击伤害追加）：entries 按段号排序，取当前口径段
  const entries = Object.entries(levelDict ?? {})
    .filter(([, v]) => v && typeof v === 'object')
    .sort((a, b) => Number(a[0]) - Number(b[0]))
  const segIdx = Math.min(Math.floor(L / 10) + 1, Math.max(entries.length, 1)) - 1
  const extra = (entries[segIdx]?.[1] as { extra?: Record<string, { value?: number }> } | undefined)
    ?.extra ?? {}
  const extraCrit = typeof extra['20101']?.value === 'number' ? (extra['20101'] as { value: number }).value : 0
  const extraCritDmg = typeof extra['21101']?.value === 'number' ? (extra['21101'] as { value: number }).value : 0

  const hp = cell(stats, 'hp_max')
  const atk = cell(stats, 'attack')
  const def = cell(stats, 'defence')
  const grow = (key: string) => cell(stats, key) ?? 0
  const num = (v: number) => String(v)
  const pct2 = (v: number) => `${(v / 100).toFixed(2)}%`
  const s = (k: keyof typeof STAT_LABELS) => pickText(STAT_LABELS[k], lang)

  const rows: Array<[string, string | null]> = [
    [s('hp'), hp != null ? num(statAtLevel(hp, grow('hpupgrade'), segHp, L)) : null],
    [s('atk'), atk != null ? num(statAtLevel(atk, grow('attack_upgrade'), segAtk, L)) : null],
    [s('def'), def != null ? num(statAtLevel(def, grow('def_upgrade'), segDef, L)) : null],
    [s('impact'), cell(stats, 'break_stun') != null ? num(cell(stats, 'break_stun')!) : null],
    [s('critRate'), cell(stats, 'crit') != null ? pct2(cell(stats, 'crit')! + extraCrit) : null],
    [s('critDmg'), cell(stats, 'crit_dmg') != null ? pct2(cell(stats, 'crit_dmg')! + extraCritDmg) : null],
    [s('anomalyControl'), cell(stats, 'element_abnormal_power') != null ? num(cell(stats, 'element_abnormal_power')!) : null],
    [s('energyRegen'), cell(stats, 'endurance') != null ? num(cell(stats, 'endurance')!) : null],
  ]
  return rows
    .filter((r): r is [string, string] => r[1] != null)
    .map(([label, value]) => ({ label, value }))
}
