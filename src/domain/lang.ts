/* ============================================================
 * 语言集 — 单一事实源（DESIGN.md ADR-004 / 决策记录 0010）。
 *
 * 语言码同时决定三件事，三者必须一致：
 *   1) 数据面目录名 `public/data/live/{lang}/…`（见 DATA_GUIDE §3）
 *   2) 源站详情端点路径 `…/zzz/{ver}/{lang}/character/{id}.json`（见 build/domains.ts）
 *   3) 界面 `<html lang>` 与名录名的回退起点（见 composables/useLocale、utils/names）
 *
 * 语言集落在 langs.json 而非本文件：构建期有两条工具链要消费它——TS 管线
 * （build/index.ts、verify-data.ts，经本文件）与纯 .mjs 脚本
 * （generate-sitemap / generate-route-html / icon-inventory，经 scripts/build/langs.mjs）。
 * TS 侧从 JSON 导入，.mjs 侧用 fs 读同一份文件，故不存在第二份语言清单。
 * ============================================================ */

import LANGS_JSON from './langs.json'

/** 站点支持的语言码。与 langs.json 逐项一致——一致性由 tests/lang.test.ts 哨兵守住。 */
export type Lang = 'zh' | 'en' | 'ja' | 'ko'

/**
 * 有序语言集，**DEFAULT_LANG 必须在首位**。
 * 构建期脚本按 `LANGS[0]` 取「枚举用语言」（名录 id / 图标清单与语言无关，
 * 取任一种即可；固定取首位让产物可复现）。
 *
 * 断言在此不可避免：`import` JSON 数组推断为 `string[]`（不是字面量元组），
 * 不写 `as readonly Lang[]` 连现状都编译不过。两条漂移方向各有守卫——
 * 「Lang 多了成员、langs.json 没跟上」由下面的 `LANG_META: Record<Lang, LangMeta>` 编译期挡住；
 * 「langs.json 多了语言、Lang 没跟上」由 `tests/lang.test.ts` 的规范清单运行时挡住
 * （加了语言就必须同时改这里的类型、数据面与那条哨兵）。
 */
export const LANGS: readonly Lang[] = LANGS_JSON as readonly Lang[]

/** 默认语言：数据面起点与首访界面语言（历史站点即中文）。 */
export const DEFAULT_LANG: Lang = 'zh'

/** 语言元信息：切换入口只显示**自称**（原生拼写），不引入任何译文。 */
export interface LangMeta {
  /** 语言码 = 数据目录名 */
  code: Lang
  /** 该语言的自称，如「日本語」——排版用，不是译文 */
  endonym: string
  /** 写入 `<html lang>` 的 BCP 47 标签 */
  htmlLang: string
}

export const LANG_META: Record<Lang, LangMeta> = {
  zh: { code: 'zh', endonym: '中文', htmlLang: 'zh-CN' },
  en: { code: 'en', endonym: 'English', htmlLang: 'en' },
  ja: { code: 'ja', endonym: '日本語', htmlLang: 'ja' },
  ko: { code: 'ko', endonym: '한국어', htmlLang: 'ko' },
}

/** 外部输入（localStorage / URL / 数据目录名）→ 语言码的守卫。 */
export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (LANGS as readonly string[]).includes(value)
}

/**
 * 一条**四语齐全**的文案。缺任何一种语言都是类型错误——这是界面三语化的类型护栏：
 * 新增一条文案时必须同时给出四种语言的写法，不存在「漏翻某一种」的静默降级。
 */
export type Loc = Record<Lang, string>

/**
 * 取 `Loc` 里当前语言的那一条。
 * 参数序是**文案在前、语言在后**，与 `utils/names.pickName(item, lang)` 同族。
 */
export function pickText(loc: Loc, lang: Lang): string {
  return loc[lang]
}

/**
 * 逐语言拼接若干 `Loc`（同一语言内部拼接，绝不跨语言）。
 * 用于需要先合成一条 `Loc`、之后才按当前语言取的场合——目前是路由 meta 的标题
 * （类目名 + 各语言自己的「详情」后缀）。
 */
export function joinLoc(...parts: Loc[]): Loc {
  const join = (lang: Lang): string => parts.map((p) => p[lang]).join('')
  return { zh: join('zh'), en: join('en'), ja: join('ja'), ko: join('ko') }
}

/**
 * 运行时判定「这是不是一条四语文案」。
 * 路由 `meta` 是弱类型袋子（`RouteMeta` 允许任意值），取标题时必须先判形而不是断言。
 */
export function isLoc(value: unknown): value is Loc {
  if (!value || typeof value !== 'object') return false
  return LANGS.every((l) => typeof (value as Record<string, unknown>)[l] === 'string')
}
