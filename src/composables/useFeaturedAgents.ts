/* ============================================================
 * useFeaturedAgents — 首页「今日角色」精选池（DESIGN.md §6.1 走 useAsyncResource）。
 * 池结构与逐张校准参数存于 src/data/featured-pool.json（校准工具 dev 中间件读写），
 * 这里是唯一消费方之一；构图参数 pos/zoom/originY 含义见 IMG_GUIDE.md。
 * 视图只消费 { featured }（响应式），不写 fetch/异步状态机（DESIGN.md §4.1）。
 * ============================================================ */

import { computed } from 'vue'
import type { CharacterListItem } from '@/data/types'
import type { ImageSource } from '@/utils/imageSource'
import { ELEMENTS } from '@/domain/enums'
import { listFor } from '@/data/resources'
import { catalogEntry } from '@/domain/catalog'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { heroFileForForm, type HeroForm } from '@/data/heroGenderVariants'
import { useHeroForm, DEFAULT_HERO_FORM } from '@/composables/useHeroForm'
import type { FeaturedPool, PoolItem } from '@/domain/featuredPool'
import poolJson from '@/data/featured-pool.json'
import featuredElements from '@/data/featured-elements.json'

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
  srcs: ImageSource[]
  pos: string
  zoom: number
  originY: number
  to: string
}

/** 本地 hero 头图根（download:icons 落地 public/data/img/hero，运行时零外部请求）。 */
const LOCAL_HERO = `${import.meta.env.BASE_URL ?? '/'}data/img/hero`

/** 首页头图取景框的 CSS 宽度上界（px）：高度上限 clamp(240px,44vh,500px) × 2.36 = 1180px
 *  （见 FeaturedDeck.vue 的 .deck-frame；改了那里就要同步这里）。 */
export const DECK_MAX_WIDTH = 1180

/** 手机（≤860，与 FeaturedDeck 的竖幅断点同一个数）竖框的「等效源宽」。
 *  竖幅（4:5）会把超宽源图放大取中段，故**布局宽不足以表达需求**；实测口径（屏 390、框 350×437）：
 *    · card 800  → 绘制 0.97×：DPR1 刚好够（~30KB）
 *    · wide 1600 → 绘制 0.97×：DPR2 刚好够（~84KB）
 *    · 原图      → DPR3 也只有 1.22×（竖幅在 DPR3 本就超出源图能力），但要 ~350KB/张
 *  取 520px：>400 使 DPR2 选 wide（而非被放大 1.94× 的 card），≤533 使 DPR3 仍选 wide、
 *  不落回 350KB 的原图 —— 首屏 4 张因此稳定在 120KB（DPR1）～340KB（DPR2/3）。 */
const DECK_SIZES_NARROW = '520px'

/**
 * 头图 `sizes`：交给浏览器的「元素布局宽」提示。
 *  · 桌面（>860）：取景框宽度 = min(视口宽, 1180px)（2.36 横幅，高度上限反推）
 *  · 手机（≤860）：竖幅的等效源宽，见 DECK_SIZES_NARROW
 *
 * 刻意用**纯 px** 而非 `100vw` / 媒体查询：挂载期的 `new Image()` 预热不在文档里，
 * 脱离文档的 img 求不了媒体查询与 vw（实测落到 sizes 末条 → 手机上错选 wide，
 * 白拉 4 张 ~84KB）。纯 px 在预热探针与真实 <img> 上必然同档，两边不会打架。
 */
export function deckSizes(
  viewportWidth: number = typeof window === 'undefined' ? DECK_MAX_WIDTH : window.innerWidth,
): string {
  if (viewportWidth <= 860) return DECK_SIZES_NARROW
  return `${Math.min(viewportWidth, DECK_MAX_WIDTH)}px`
}

/**
 * 首页头图候选：本地派生档（card / wide 交给浏览器按 DPR 自选）→ 本地原图 → CDN。
 *
 * 展示格是内容栏里居中的超宽标本板（取景框最宽 1180 CSS px，再乘逐图 zoom 1.05-1.49），
 * 只有 800px 的 card 一档时桌面上被放大近 2×、DPR2 近 4× —— 首页首屏肉眼可见发糊。
 * 故加 wide（1600px）一档，并让浏览器在 srcset 里选：手机/DPR≤2 仍取 800px（省带宽），
 * 桌面 DPR1 取 1600px（1:1），DPR≥1.21 落回原图（它才是够用的那一档）。
 * 两档规格与展示格的绑定关系见 scripts/build/hero-cards.mjs 文件头。
 *
 * 原图放最后一位当「上界档」：它已是最后一档，w 描述符取值不影响选档结果（浏览器只在前
 * 面各档密度都低于 DPR 时才落回它），取全池原图宽的下界 1920 以免虚报。
 */
export function heroSources(file: string, sizes: string = deckSizes()): ImageSource[] {
  const card = `${LOCAL_HERO}/card/${file}.webp`
  const wide = `${LOCAL_HERO}/wide/${file}.webp`
  const local = `${LOCAL_HERO}/${file}.webp`
  return [
    { src: wide, srcset: `${card} 800w, ${wide} 1600w, ${local} 1920w`, sizes },
    { src: local },
    { src: `https://static.nanoka.cc/assets/zzz/${file}.webp` },
  ]
}

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

/** 以「本地日期」为种子（同日恒定、跨日变化）。 */
export function daySeed(d: Date = new Date()): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
}

/** 确定性洗牌（mulberry32 小 PRNG）：同一 seed 必得同一排列。
 *  用于「今日角色」——区块文案承诺的是**今天**这一批，而非每次刷新都换人：
 *  随机挑选会让文案与行为不符，回访用户也拿不到同一批（图片缓存白费）。 */
export function seededShuffle<T>(arr: readonly T[], seed: number): T[] {
  let s = seed >>> 0
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = a[i]
    a[i] = a[j]
    a[j] = tmp
  }
  return a
}

/**
 * 今日精选：**属性 + 阵营双重去重**。
 *
 * 纯随机洗牌会连着挑出同质角色——实测出现过「4 张里 3 张白发红眼」的观感重复
 * （首页第一屏最显眼的位置，重复即显得随手）。两道约束：
 *   ① **属性不重复**（避免同色系扎堆）
 *   ② **阵营不重复**（不同阵营的设计语言差异明显：机车帮 / 家政 / 治安局 / 防卫军…）
 * 逐级放宽：先要求两者都不重复 → 属性不够时放宽阵营 → 再不够才按洗牌序补齐（不静默少给）。
 *
 * 表来自构建期派生并提交的 featured-elements.json（见 scripts/generate-featured-elements.mjs）：
 * 选片必须同步发生（头图 src 只依赖 id，才能与清单请求并行），不能等名录返回。
 */
export function pickFeatured(pool: readonly PoolItem[], seed: number, count = 4): PoolItem[] {
  const shuffled = seededShuffle(pool, seed)
  const out: PoolItem[] = []
  const take = (needDistinctCamp: boolean) => {
    for (const p of shuffled) {
      if (out.length >= count) break
      if (out.includes(p)) continue
      const k = keyOf(p.id)
      if (out.some((q) => keyOf(q.id).element === k.element)) continue
      if (needDistinctCamp && out.some((q) => keyOf(q.id).camp === k.camp)) continue
      out.push(p)
    }
  }
  take(true) // ① 属性 + 阵营都不重复
  take(false) // ② 放宽阵营，仍保持属性不重复
  if (out.length < count) {
    for (const p of shuffled) {
      if (out.length >= count) break
      if (!out.includes(p)) out.push(p)
    }
  }
  return out
}

/** 池条目的去重键（属性 + 阵营；特殊属性单独成键，避免与基础属性混为一谈） */
export function elementKeyOf(id: number): string {
  const k = keyOf(id)
  return k.special ? `special-${k.special}` : `el-${k.element}`
}

/** 池条目的阵营键（缺失时按 id 单列，不与任何条目「同阵营」） */
export function campKeyOf(id: number): string {
  return keyOf(id).camp ?? `camp-unknown-${id}`
}

function keyOf(id: number): { element: number | undefined; camp: string | null; special: string | null } {
  // 紧凑表格式：[属性码, 阵营] 或 [属性码, 阵营, 特殊属性]（见 generate-featured-elements.mjs）。
  // JSON 导入被推断为 (string|number)[]，元组断言需经 unknown 中转（直接断言 TS 会报不重叠）。
  const table = featuredElements as unknown as Record<string, (string | number)[]>
  const e = table[String(id)]
  return {
    element: typeof e?.[0] === 'number' ? e[0] : undefined,
    camp: typeof e?.[1] === 'string' ? e[1] : null,
    special: typeof e?.[2] === 'string' ? e[2] : null,
  }
}

/**
 * 由池条目 + 名录解析卡片。list 为 null（清单未就绪）时照样出卡：头图 src 只依赖 id，
 * 名字/元素留空由视图占位——让 LCP 图片与清单请求并行，而非排在它后面。
 * 名单就绪后按名录真值解析；池内 id 不在名录时丢弃并紧凑重排编号（策展真值）。
 * `sizes` 由调用方按挂载期取景框宽定档（见 deckSizes），好让预热与真实 <img> 同档。
 * `form` 为双形态角色的当前形态（佩洛伊斯）：**卡面跟随详情页所选形态**，
 * 好让卡片与降落端同图、共享元素飞行不出现「女性溶解成男性」。非双形态角色不受影响。
 */
export function buildFeaturedCards(
  seed: PoolItem[],
  list: CharacterListItem[] | null,
  sizes: string = deckSizes(),
  form: HeroForm = DEFAULT_HERO_FORM,
): FeaturedCard[] {
  const byId = new Map((list ?? []).map((x) => [x.Id, x]))
  const cards: FeaturedCard[] = []
  for (const n of seed) {
    const item = byId.get(n.id)
    if (list && !item) continue
    const el = item?.element !== undefined ? ELEMENTS[item.element] : undefined
    const hasSpecial = Boolean(item?.special_element)
    const file = heroFileForForm(n.id, form)
    cards.push({
      id: n.id,
      no: '', // 末尾统一重排
      zh: item?.zh ?? '',
      en: item?.en ?? '',
      elementZh: item?.special_element ?? el?.zh ?? '',
      // 特殊属性（如 玄墨）无专属色，不套基础元素色，落回标签默认 ink
      elementColor: hasSpecial ? '' : (el?.color ?? ''),
      srcs: heroSources(file, sizes),
      pos: n.pos,
      zoom: n.zoom,
      originY: n.originY,
      to: `/agents/${n.id}`,
    })
  }
  return cards.map((c, i) => ({ ...c, no: String(i + 1).padStart(2, '0') }))
}

/** 首页「今日角色」：按**当天日期**确定性取 4 张 + 解析，返回响应式 featured。
 *  同日恒定（文案承诺的是「今日」这批，回访还能命中图片缓存）、跨日自动换一批；
 *  早前用 Math.random 每次挂载换人——文案与行为不符，且回访用户永远冷缓存。
 *  featured 与 picks 等长起步（名字未就绪时留空占位），清单到达后按真值收敛。 */
export function useFeaturedAgents() {
  const picks = pickFeatured(FEATURED_POOL, daySeed())
  /** 挂载期按取景框宽定档：卡片与预热共用同一个值，两边的档位不会打架 */
  const sizes = deckSizes()

  /** 双形态角色的当前形态（佩洛伊斯）：卡面与详情页共用一份选择，切换后回首页即同图。
   *  本 ref 是模块级单例（localStorage 持久化），在此读取使 `featured` 对它保持响应式。 */
  const { heroForm } = useHeroForm()

  // 首屏头图预热：卡片在挂载即渲染（图 src 只依赖 id，不等清单）；且带 transform:scale 的 img
  // 会升级为独立合成层，合成器按 DOM 顺序解码/栅格化，最右一张总最后上屏（网络其实并行）。
  // 故在 picks 定下后立刻并行预取+预解码本地图，与清单 fetch 重叠，使卡片渲染时已解码、
  // 4 张可同帧合成，消除「第 4 张慢半拍」。
  // 预热必须**走同一份 srcset + sizes**：档位由浏览器按 DPR 选，探针若自己另算 sizes
  // （脱离文档的 img 求不了媒体查询/vw）就会挑错档 → 白拉一张，比不预热更糟。
  // 形态按挂载时的 heroForm 取值：形态只在详情页切换，回到首页必是重新挂载，故此处不会取到旧值。
  for (const p of picks) {
    const primary = heroSources(heroFileForForm(p.id, heroForm.value), sizes)[0]!
    const img = new Image()
    img.decoding = 'async'
    img.srcset = primary.srcset ?? ''
    img.sizes = primary.sizes ?? ''
    img.src = primary.src
    // decode() 把解码放工作线程，不阻塞主线程；失败（池内本地图理应齐全）静默，留 <img @error> CDN 兜底
    img.decode().catch(() => {
      /* noop：留给 <img @error> 的 CDN 兜底 */
    })
  }

  const { data: list } = useAsyncResource<CharacterListItem[]>(() => listFor<CharacterListItem>(catalogEntry('/agents')))
  const featured = computed(() => buildFeaturedCards(picks, list.value, sizes, heroForm.value))
  return { featured, picks }
}
