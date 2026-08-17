/* ============================================================
 * 目录元信息 — 4 类目唯一事实源（DESIGN.md §5.3）。
 * App.vue 导航、HomeView 目录、路由、列表页全部由此派生，
 * 不再允许手写第二份类目清单。
 * 纯数据模块：不依赖 Vue / api（避免循环依赖）。
 * ============================================================ */

import type { IconCategory } from '@/data/icons'

export interface CatalogEntry {
  /** 档案编号，如 '01' */
  no: string
  /** 中文名 */
  label: string
  /** 英文标识（导航/首页排版用） */
  en: string
  /** 路由路径 */
  path: string
  /** 首页目录描述 */
  desc: string
  /** 首页目录卡的图标候选数据 */
  icon: { Id: number; icon: string }
  /** 图标分类（icons.ts 候选规则用） */
  iconCategory: IconCategory
  /** 名录文件名（public/data/{file}.json） */
  listFile: string
  /** 详情目录（public/data/zh/{dir}/{id}.json） */
  detailDir: string
}

export const CATALOG: readonly CatalogEntry[] = [
  {
    no: '01',
    label: '代理人',
    en: 'AGENTS',
    path: '/agents',
    desc: '新艾利都的代理人档案：属性、职业、阵营与战斗数据。',
    icon: { Id: 1011, icon: 'IconRole01' },
    iconCategory: 'character',
    listFile: 'character',
    detailDir: 'character',
  },
  {
    no: '02',
    label: '音擎',
    en: 'W-ENGINES',
    path: '/w-engines',
    desc: '驱动代理人的武装终端，按职业与稀有度编目。',
    icon: { Id: 12001, icon: 'Weapon_B_Common_01' },
    iconCategory: 'weapon',
    listFile: 'weapon',
    detailDir: 'weapon',
  },
  {
    no: '03',
    label: '邦布',
    en: 'BANGBOO',
    path: '/bangboos',
    desc: '空洞探索的忠实伙伴，收录全部型号与数据。',
    icon: { Id: 53001, icon: 'IconBangbooPiece12' },
    iconCategory: 'bangboo',
    listFile: 'bangboo',
    detailDir: 'bangboo',
  },
  {
    no: '04',
    label: '驱动盘',
    en: 'DISK DRIVES',
    path: '/disks',
    desc: '驱动盘的套装效果与词条一览。',
    icon: { Id: 31000, icon: 'SuitWoodpeckerElectro' },
    iconCategory: 'disc',
    listFile: 'equipment',
    detailDir: 'equipment',
  },
]

/** 按路由路径查找类目（导航/页面用），找不到返回 undefined。 */
export function catalogByPath(path: string): CatalogEntry | undefined {
  return CATALOG.find((c) => c.path === path)
}

/** 页面标题文案（页面头 eyebrow 用，如 'AGENTS'）。 */
export function catalogEyebrow(path: string): string {
  return catalogByPath(path)?.en ?? 'ARCHIVE'
}
