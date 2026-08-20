/* ============================================================
 * useDetailSections — 详情页区块导航收编（DESIGN.md §6.1）。
 * 四个详情页共用的三件套：navItems 驱动的 scrollspy + 区块 reveal
 * 指令 + 区块编号查询（noOf，供 DetailSection 的 :no 派生，杜绝
 *「导航编号与区块编号双份事实」漂移）。
 * ============================================================ */

import { nextTick, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'
import { useDetailNavigation } from './useDetailNavigation'
import type { AsyncStatus } from './useAsyncResource'

/** 区块导航条目（详情页 navItems 的公共形状） */
export interface DetailSectionItem {
  id: string
  no: string
  label: string
}

export function useDetailSections(
  navItems: MaybeRefOrGetter<DetailSectionItem[]>,
  status: Ref<AsyncStatus>,
) {
  const { activeSection, revealDir, activate } = useDetailNavigation()

  /** 数据就绪 + DOM 渲染后建立区块观察与深链兜底 */
  watch(status, (s) => {
    if (s !== 'success') return
    nextTick(() => activate(toValue(navItems).map((n) => n.id)))
  })

  /** 按区块 id 查编号（DdetailSection :no 单一来源） */
  const noOf = (id: string) => toValue(navItems).find((n) => n.id === id)?.no

  return { activeSection, revealDir, noOf }
}