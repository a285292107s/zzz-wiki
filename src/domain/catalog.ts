/* ============================================================
 * 目录元信息 — 4 类目唯一事实源（DESIGN.md §5.3）。
 * App.vue 导航、HomeView 目录、路由、列表页全部由此派生，
 * 不再允许手写第二份类目清单。
 * 纯数据模块：不依赖 Vue / api（避免循环依赖）。
 *
 * `label` / `desc` 是四语 `Loc`（决策记录 0011）：导航、首页目录与页面标题都取这一份。
 * `en` 仍是语言无关的拉丁文标识（AGENTS / W-ENGINES…），是排版元素不是译文。
 * ============================================================ */

import type { IconCategory } from '@/data/icons'
import type { Loc } from './lang'

export interface CatalogEntry {
  /** 档案编号，如 '01' */
  no: string
  /** 类目名（四语） */
  label: Loc
  /** 英文标识（导航/首页排版用，语言无关） */
  en: string
  /** 路由路径 */
  path: string
  /** 首页目录描述（四语） */
  desc: Loc
  /** 首页目录卡的图标候选数据 */
  icon: { Id: number; icon: string }
  /** 图标分类（icons.ts 候选规则用） */
  iconCategory: IconCategory
  /** 名录文件名（public/data/live/{lang}/{file}.json） */
  listFile: string
  /** 详情目录（public/data/live/{lang}/{dir}/{id}.json） */
  detailDir: string
}

export const CATALOG: readonly CatalogEntry[] = [
  {
    no: '01',
    label: { zh: '代理人', en: 'Agents', ja: '代理人', ko: '에이전트' },
    en: 'AGENTS',
    path: '/agents',
    desc: {
      zh: '新艾利都的代理人档案：属性、职业、阵营与战斗数据。',
      en: 'Agent files of New Eridu: attributes, professions, factions and combat data.',
      ja: '新エリー都の代理人アーカイブ。属性・職種・陣営・戦闘データ。',
      ko: '뉴에리두 에이전트 아카이브: 속성, 직업, 진영, 전투 데이터.',
    },
    icon: { Id: 1011, icon: 'IconRole01' },
    iconCategory: 'character',
    listFile: 'character',
    detailDir: 'character',
  },
  {
    no: '02',
    label: { zh: '音擎', en: 'W-Engines', ja: '音動機', ko: 'W-엔진' },
    en: 'W-ENGINES',
    path: '/w-engines',
    desc: {
      zh: '驱动代理人的武装终端，按职业与稀有度编目。',
      en: 'The armed terminals Agents wield, catalogued by profession and rarity.',
      ja: '代理人を駆動する武装端末。職種とレアリティで整理。',
      ko: '에이전트를 구동하는 무장 단말. 직업과 등급으로 정리.',
    },
    icon: { Id: 12001, icon: 'Weapon_B_Common_01' },
    iconCategory: 'weapon',
    listFile: 'weapon',
    detailDir: 'weapon',
  },
  {
    no: '03',
    label: { zh: '驱动盘', en: 'Drive Discs', ja: 'ドライブディスク', ko: '드라이브 디스크' },
    en: 'DRIVE DISCS',
    path: '/disks',
    desc: {
      zh: '驱动盘的套装效果与词条一览。',
      en: 'Drive Disc set bonuses and stat lines at a glance.',
      ja: 'ドライブディスクのセット効果とオプション一覧。',
      ko: '드라이브 디스크 세트 효과와 옵션 목록.',
    },
    icon: { Id: 31000, icon: 'SuitWoodpeckerElectro' },
    iconCategory: 'disc',
    listFile: 'equipment',
    detailDir: 'equipment',
  },
  {
    no: '04',
    label: { zh: '邦布', en: 'Bangboos', ja: 'ボンプ', ko: '뱅부' },
    en: 'BANGBOO',
    path: '/bangboos',
    desc: {
      zh: '空洞探索的忠实伙伴，收录全部型号与数据。',
      en: 'Faithful Hollow-diving companions — every model and its data.',
      ja: 'ホロウ探索の頼れる相棒。全機種とデータを収録。',
      ko: '공동 탐사의 든든한 동료. 모든 기종과 데이터 수록.',
    },
    icon: { Id: 53001, icon: 'IconBangbooPiece12' },
    iconCategory: 'bangboo',
    listFile: 'bangboo',
    detailDir: 'bangboo',
  },
]

/**
 * 图文板块入口（非数据类目的常设页面）。独立于 CATALOG：它们没有 listFile/detailDir/icon 契约。
 * 字段：
 *   - nav：是否进站头主导航（战斗公式与设置进）
 *   - glyph：无游戏图标时的标本符号（首页目录的占位符）
 *
 * 编号是**展示位次**（站头导航与首页目录都会印出来），故必须连续：
 * 目录顺序 = 编号升序 = 站头导航顺序（导航取其中 nav:true 的，编号不留空号）。
 */
export interface GuideEntry {
  no: string
  /** 板块名（四语）；正文长文仍只有中文（决策记录 0011） */
  label: Loc
  en: string
  path: string
  desc: Loc
  glyph: string
  nav: boolean
}

export const GUIDE_ENTRIES: readonly GuideEntry[] = [
  {
    no: '05',
    label: { zh: '战斗公式', en: 'Combat Formulas', ja: '戦闘公式', ko: '전투 공식' },
    en: 'FORMULAS',
    path: '/formulas',
    desc: {
      zh: '从伤害乘区到失衡、属性异常与命破，逐段拆解战斗数值构成。',
      en: 'Damage multipliers, Daze, Attribute Anomaly and Rupture, broken down step by step.',
      ja: 'ダメージ乗算区から怯み・属性異常・命破まで、戦闘数値の構成を順に分解。',
      ko: '피해 배율부터 그로기, 속성 이상, 명파까지 전투 수치 구성을 단계별로 해설.',
    },
    glyph: '×',
    nav: true,
  },
  {
    no: '06',
    label: { zh: '设置', en: 'Settings', ja: '設定', ko: '설정' },
    en: 'SETTINGS',
    path: '/settings',
    desc: {
      zh: '本机偏好：佩洛伊斯立绘形态与展示语言。',
      en: 'On-device preferences: Pyrois portrait form and display language.',
      ja: '本端末の設定：ピュロイスの立ち絵形態、表示言語。',
      ko: '이 기기 설정: 피로이스 일러스트 형태, 표시 언어.',
    },
    glyph: '⋮',
    nav: true,
  },
] as const

/**
 * 站点自身说明（与游戏内容无关的页面）：只从页脚进入，不进首页目录与站头导航，
 * 故没有展示位次与图标。页脚链接由本清单派生，不手写第二份文案（决策记录 0028）。
 */
export interface SiteInfoEntry {
  label: Loc
  path: string
}

export const SITE_INFO_ENTRIES: readonly SiteInfoEntry[] = [
  {
    label: { zh: '项目架构', en: 'Architecture', ja: 'サイト構成', ko: '사이트 구조' },
    path: '/architecture',
  },
  {
    label: { zh: '数据说明', en: 'About the data', ja: 'データについて', ko: '데이터 안내' },
    path: '/about',
  },
] as const

/** 按路由路径取板块名（首页目录板块 + 页脚说明页），缺失返回 undefined。 */
export function guideForPath(path: string): { label: Loc } | undefined {
  return [...GUIDE_ENTRIES, ...SITE_INFO_ENTRIES].find((e) => e.path === path)
}

/**
 * 站头导航一览 = 4 个数据类目 + 进主导航的图文板块（GUIDE_ENTRIES 里 nav:true 的）。
 * SiteHeader 的主排导航（≥980）与它的窄屏 ☰ 菜单（≤979）共用这一份派生结果：
 * 两处必须是同一份清单，改这里即两处同步。检索面板**不**列这一份——
 * 导航入口归站头一处，面板只做检索（见 QuickSearch 头部注释）。
 */
export const NAV_ENTRIES: readonly { no: string; label: Loc; en: string; to: string }[] = [
  ...CATALOG.map((c) => ({ no: c.no, label: c.label, en: c.en, to: c.path })),
  ...GUIDE_ENTRIES.filter((g) => g.nav).map((g) => ({
    no: g.no,
    label: g.label,
    en: g.en,
    to: g.path,
  })),
]

/** 按路由路径查找类目（导航/页面用），找不到返回 undefined。 */
export function catalogByPath(path: string): CatalogEntry | undefined {
  return CATALOG.find((c) => c.path === path)
}

/** 按路由路径取类目，缺失即抛错——调用处的路径是代码内常量，
 *  写错属于编程错误，应尽早失败而不是静默回退。视图取数一律经此。 */
export function catalogEntry(path: string): CatalogEntry {
  const c = catalogByPath(path)
  if (!c) throw new Error(`[catalog] 未登记的类目路径：${path}`)
  return c
}

/**
 * 类目策展：不进入名录浏览列表的条目（名录页与详情翻页共用同一份过滤）。
 * 伊埃斯（55098）是绳匠专属的 H.D.D. 搭档，不是可获取的收藏型号
 * （源站名录即空 icon / 占位 desc 的桩数据），从邦布名录浏览列表隐藏；
 * 详情页仍可经直接链接与翻页外的路径到达。
 */
export const HIDDEN_ITEM_IDS: ReadonlyMap<string, ReadonlySet<number>> = new Map([
  ['/bangboos', new Set<number>([55098])],
])
