/* ============================================================
 * useFeaturedAgents — 首页「今日角色」精选池（DESIGN.md §6.1 走 useAsyncResource）。
 * 池结构与逐张校准参数存于 src/data/featured-pool.json（校准工具 dev 中间件读写），
 * 这里是唯一消费方之一；构图参数 pos/zoom/originY 含义见 IMG_GUIDE.md。
 * 视图只消费 { featured }（响应式），不写 fetch/异步状态机（DESIGN.md §4.1）。
 * ============================================================ */

import { computed } from 'vue'
import type { CharacterListItem } from '@/data/types'
import { ELEMENTS } from '@/domain/enums'
import { listFor } from '@/data/resources'
import { catalogEntry } from '@/domain/catalog'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { heroImageFile } from '@/data/heroGenderVariants'
import type { FeaturedPool, PoolItem } from '@/domain/featuredPool'
import poolJson from '@/data/featured-pool.json'

/** 精选池（来自数据文件；结构防御性检查，非法/缺失则空池）。 */
export const FEATURED_POOL: PoolItem[] = Array.isArray((poolJson as FeaturedPool)?.pool)
  ? (poolJson as FeaturedPool).pool
  : []

export interface FeaturedCard {
  id: number
  no: string
  zh: string
  en: string
  elementZh: string
  elementColor: string
  srcs: string[]
  pos: string
  zoom: number
  originY: number
  to: string
}

/** 本地 hero 头图根（download:icons 落地 public/data/img/hero，运行时零外部请求） */
const LOCAL_HERO = `${import.meta.env.BASE_URL ?? '/'}data/img/hero`

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

/** 由池条目 + 名录解析卡片：名字/元素/特殊属性/头图候选。缺失 id 丢弃并紧凑重排编号。 */
export function buildFeaturedCards(seed: PoolItem[], list: CharacterListItem[]): FeaturedCard[] {
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
        `${LOCAL_HERO}/${heroImageFile(n.id)}.webp`,
        `https://static.nanoka.cc/assets/zzz/${heroImageFile(n.id)}.webp`,
      ],
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

  // 首屏头图预热：卡片区要等角色清单 JSON 返回后才 v-if 渲染；且带 transform:scale 的 img
  // 会升级为独立合成层，合成器按 DOM 顺序解码/栅格化，最右一张总最后上屏（网络其实并行）。
  // 故在 picks 定下后立刻并行预取+预解码本地图，与清单 fetch 重叠，使卡片渲染时已解码、
  // 4 张可同帧合成，消除「第 4 张慢半拍」。
  for (const p of picks) {
    const img = new Image()
    img.decoding = 'async'
    img.src = `${LOCAL_HERO}/${heroImageFile(p.id)}.webp`
    // decode() 把解码放工作线程，不阻塞主线程；失败（池内本地图理应齐全）静默，留 <img @error> CDN 兜底
    img.decode().catch(() => {
      /* noop：留给 <img @error> 的 CDN 兜底 */
    })
  }

  const { data: list } = useAsyncResource<CharacterListItem[]>(() => listFor<CharacterListItem>(catalogEntry('/agents')))
  const featured = computed(() => (list.value ? buildFeaturedCards(picks, list.value) : []))
  return { featured }
}
