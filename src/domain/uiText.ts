/* ============================================================
 * uiText — 界面文案表（四语）。
 *
 * **为什么要一张集中表**（决策记录 0011）：界面短文案是站内自己写的，源站没有对应译文，
 * 四语写法必须由人（或 AI）产出并**复核**。集中一处才好逐条对着看、也才好整表交给译者；
 * 散在 50 多个模板里就没有可复核的单一入口了。
 *
 * **与「文案随结构」的分工**：跟着数据结构走的那几类标签**不**进本表——
 * 属性/职业/攻击类型（`domain/enums.ts`，官方译名）、类目与导航（`domain/catalog.ts`）、
 * 技能槽位与数值面板标签（`domain/sections.ts`）。它们与自己的数据同处一处，
 * 用 `pickText(x.label, lang)` 取；本表只收「没有归属结构」的那些界面文案。
 *
 * **键的对齐由类型强制**：`UiText` 派生自中文清单（结构事实源），其余三语按同一类型赋值，
 * 缺任何一条键都会编译报错；多出的键不会报错（对象变量赋值不做多余属性检查），
 * 由 `tests/ui-text.test.ts` 的键对齐断言补上。
 * ============================================================ */

import zh from './uiText.zh.json'
import en from './uiText.en.json'
import ja from './uiText.ja.json'
import ko from './uiText.ko.json'
import { LANGS, type Lang, type Loc } from './lang'

/** 文案树结构（由中文清单派生）。 */
export type UiText = typeof zh

const TEXT: Record<Lang, UiText> = { zh, en, ja, ko }

/** 取某语言的整棵文案树。 */
export function uiTextFor(lang: Lang): UiText {
  return TEXT[lang]
}

/** 按点号键路径读一条文案（键写错 → 立刻抛错，不静默给空串）。 */
function readKey(lang: Lang, path: string): string {
  let node: unknown = TEXT[lang]
  for (const part of path.split('.')) {
    node = (node as Record<string, unknown> | undefined)?.[part]
  }
  if (typeof node !== 'string') throw new Error(`[uiText] 缺少文案键 ${path}（${lang}）`)
  return node
}

/**
 * 取某条文案的**四语 Loc**。用于「先存 Loc、渲染时再按当前语言取」的场合——
 * 目前只有路由 meta 的标题（路由表在模块加载期建好，那时还不知道用户选了什么语言）。
 * 键路径与文案表一致，如 `uiLoc('meta.detailSuffix')`。
 */
export function uiLoc(path: string): Loc {
  return {
    zh: readKey('zh', path),
    en: readKey('en', path),
    ja: readKey('ja', path),
    ko: readKey('ko', path),
  }
}

/** 键数量自检：四语清单必须逐键对齐（多键/漏键都会在这里被点出来）。 */
export function uiTextKeyCounts(): Record<Lang, number> {
  const count = (o: unknown): number =>
    o && typeof o === 'object'
      ? Object.values(o as Record<string, unknown>).reduce<number>((n, v) => n + count(v), 0)
      : 1
  return Object.fromEntries(LANGS.map((l) => [l, count(TEXT[l])])) as Record<Lang, number>
}


/**
 * 文案占位符替换：`{name}` → 值。
 * 界面文案里凡需要拼数字/名字的（「突破 {n} 阶」「第 {n} 位：{label}」）都走这里，
 * 让各语言自行决定占位符的语序与前后缀，而不是把中文语序硬编码进组件。
 * 未知占位符原样保留（宁可露出 `{x}` 也不静默吞掉）。
 */
export function fmt(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (raw, key: string) =>
    key in vars ? String(vars[key]) : raw,
  )
}
