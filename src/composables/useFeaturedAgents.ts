/* ============================================================
 * useFeaturedAgents — 首页「今日角色」精选池（DESIGN.md §6.1 走 useAsyncResource）。
 * 精选来自 img/hero/Mindscape_{id}_2.webp 的手工校准池，每次挂载随机取 4 张轮换。
 * 构图参数 pos/zoom/originY（对脸/放大填满/纵向中心）含义见 IMG_GUIDE.md。
 * 视图只消费 { featured }（响应式），不写 fetch/异步状态机（DESIGN.md §4.1）。
 * ============================================================ */

import { computed } from 'vue'
import type { CharacterListItem } from '@/data/types'
import { ELEMENTS } from '@/domain/enums'
import { api } from '@/data/api'
import { useAsyncResource } from '@/composables/useAsyncResource'

export interface FeaturedSeed {
  id: number
  pos: string
  zoom: number
  originY: number
}

export interface FeaturedCard {
  id: number
  no: string
  zh: string
  en: string
  elementZh: string
  elementColor: string
  srcs: string[]
  idx: number
  pos: string
  zoom: number
  originY: number
  to: string
}

/** 本地 hero 头图根（download:icons 落地 public/data/img/hero，运行时零外部请求） */
const LOCAL_HERO = `${import.meta.env.BASE_URL ?? '/'}data/img/hero`

/** 精选池（逐张手工校准过构图；换角色/扩池只增删一行）。 */
export const FEATURED_POOL: FeaturedSeed[] = [
  { id: 1011, pos: '50%', zoom: 1.3, originY: 49.8 },
  { id: 1331, pos: '40%', zoom: 1.2, originY: 47 },
  { id: 1371, pos: '40%', zoom: 1.2, originY: 30.2 },
  { id: 1051, pos: '64%', zoom: 1.22, originY: 61.4 },
  { id: 1281, pos: '54%', zoom: 1.29, originY: 49.6 },
  { id: 1291, pos: '70%', zoom: 1.22, originY: 59.4 },
  { id: 1391, pos: '36%', zoom: 1.25, originY: 41.9 },
  { id: 1441, pos: '62%', zoom: 1.21, originY: 64.0 },
  { id: 1491, pos: '40%', zoom: 1.18, originY: 55.1 },
  { id: 1501, pos: '45%', zoom: 1.2, originY: 56.9 },
  { id: 1511, pos: '42%', zoom: 1.06, originY: 52.5 },
  { id: 1561, pos: '42%', zoom: 1.25, originY: 48.6 },
]

/** Fisher–Yates 洗牌：不修改入参，返回新的随机排列（用于每次挂载换一批）。 */
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = a[i]
    a[i] = a[j]
    a[j] = tmp
  }
  return a
}

/** 由精选种子 + 名录解析卡片：名字/元素/特殊属性/头图候选。缺失 id 丢弃并紧凑重排编号。 */
export function buildFeaturedCards(seed: FeaturedSeed[], list: CharacterListItem[]): FeaturedCard[] {
  const byId = new Map(list.map((x) => [x.Id, x]))
  const cards: FeaturedCard[] = []
  for (const n of seed) {
    const item = byId.get(n.id)
    if (!item) continue
    const el = item.element !== undefined ? ELEMENTS[item.element] : undefined
    const hasSpecial = Boolean(item.special_element)
    cards.push({
      id: n.id,
      no: '', // 末尾统一重排
      zh: item.zh ?? '',
      en: item.en ?? '',
      elementZh: item.special_element ?? el?.zh ?? '',
      // 特殊属性（如 玄墨）无专属色，不套基础元素色，落回标签默认 ink
      elementColor: hasSpecial ? '' : (el?.color ?? ''),
      srcs: [
        `${LOCAL_HERO}/Mindscape_${n.id}_2.webp`,
        `https://static.nanoka.cc/assets/zzz/Mindscape_${n.id}_2.webp`,
      ],
      idx: 0,
      pos: n.pos,
      zoom: n.zoom,
      originY: n.originY,
      to: `/agents/${n.id}`,
    })
  }
  return cards.map((c, i) => ({ ...c, no: String(i + 1).padStart(2, '0') }))
}

/** 首页「今日角色」：每次挂载随机取 4 张 + 解析，返回响应式 featured。 */
export function useFeaturedAgents() {
  const picks = shuffle(FEATURED_POOL).slice(0, 4)
  const { data: list } = useAsyncResource<CharacterListItem[]>(() => api.list<CharacterListItem>('character'))
  const featured = computed(() => (list.value ? buildFeaturedCards(picks, list.value) : []))
  return { featured }
}
