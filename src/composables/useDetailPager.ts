/* ============================================================
 * useDetailPager — 详情页「上一档 / 下一档」数据源（四个详情视图共用）。
 *
 * 顺序语义与名录页默认排序一致（Id 升序 = 名录添加序）；
 * 编号取名录内序位（padStart 3，档案编号语感），首尾条目空位渲染哑端。
 * 名录来自 api 层缓存（列表页/首页已拉过，详情页基本零网络）。
 * ============================================================ */

import { computed, type ComputedRef, type Ref } from 'vue'
import type { CatalogEntry } from '@/domain/catalog'
import type { DetailPagerItem } from '@/components/detail/DetailPager.vue'
import { listFor } from '@/data/resources'
import { useAsyncResource } from './useAsyncResource'

export function useDetailPager(
  entry: CatalogEntry,
  currentId: Ref<number | string>,
  pickLabel: (row: Record<string, unknown>) => string,
  /** 行过滤（可选）：与名录页的策展过滤保持同一份逻辑（如邦布名录隐藏绳匠专属搭档） */
  keep?: (row: Record<string, unknown>) => boolean,
): {
  prev: ComputedRef<DetailPagerItem | null>
  next: ComputedRef<DetailPagerItem | null>
} {
  const { data: list } = useAsyncResource<Record<string, unknown>[]>(() => listFor(entry))

  const rows = computed(() =>
    (list.value ?? [])
      .filter((r) => (keep ? keep(r) : true))
      .sort((a, b) => Number(a.Id) - Number(b.Id))
      .map((r) => ({ id: Number(r.Id), label: pickLabel(r) })),
  )

  const idx = computed(() =>
    rows.value.findIndex((r) => String(r.id) === String(currentId.value)),
  )

  const to = (r: { id: number; label: string } | undefined, i: number): DetailPagerItem | null =>
    r ? { to: `${entry.path}/${r.id}`, no: String(i + 1).padStart(3, '0'), label: r.label } : null

  const prev = computed<DetailPagerItem | null>(() => to(rows.value[idx.value - 1], idx.value - 1))
  const next = computed<DetailPagerItem | null>(() => to(rows.value[idx.value + 1], idx.value + 1))

  return { prev, next }
}
