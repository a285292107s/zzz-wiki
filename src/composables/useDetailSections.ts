/* ============================================================
 * useDetailSections — 详情页区块导航收编（DESIGN.md §6.1）。
 * 四个详情页共用的三件套：navItems 驱动的 scrollspy + 区块 reveal
 * 指令 + 区块编号查询（noOf，供 DetailSection 的 :no 派生，杜绝
 *「导航编号与区块编号双份事实」漂移）。
 * ============================================================ */

import { nextTick, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'
import { useDetailNavigation } from './useDetailNavigation'
import type { AsyncStatus } from './useAsyncResource'

/** 区块导航子条目：指向区块内局部锚点（如技能下的普通攻击/闪避/特殊技） */
export interface DetailSectionChild {
  id: string
  label: string
}

/** 区块导航条目（详情页 navItems 的公共形状） */
export interface DetailSectionItem {
  id: string
  no: string
  label: string
  /** 子条目：区块内局部定位，不参与顶层编号 */
  children?: DetailSectionChild[]
}

/** 展平顶层编号 + 全部子锚点 id（scrollspy 观察 / 深链兜底共用） */
function sectionIds(items: DetailSectionItem[]): string[] {
  return items.flatMap((n) => [n.id, ...(n.children?.map((c) => c.id) ?? [])])
}

export function useDetailSections(
  navItems: MaybeRefOrGetter<DetailSectionItem[]>,
  status: Ref<AsyncStatus>,
) {
  const { activeSection, revealDir, activate } = useDetailNavigation()

  /** 数据就绪 + DOM 渲染后建立区块观察与深链兜底 */
  watch(status, (s) => {
    if (s !== 'success') return
    nextTick(() => activate(sectionIds(toValue(navItems))))
  })

  /** 按区块 id 查编号（DetailSection :no 单一来源）。
   *  每个被渲染的区块都已被对应 navItems 的 add() 登记（同条件派生），故总能取到；
   *  仅当误漏登记时兜底空串，避免错号/重号（此前硬编码的 ?? '0X' 随条件区块变化必然失真）。 */
  const noOf = (id: string) => toValue(navItems).find((n) => n.id === id)?.no ?? ''

  return { activeSection, revealDir, noOf }
}