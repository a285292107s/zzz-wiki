/* ============================================================
 * useFeaturedAgents — 首页「今日角色」精选池（DESIGN.md §6.1 走 useAsyncResource）。
 * 池结构与逐张校准参数存于 src/data/featured-pool.json（校准工具 dev 中间件读写），
 * 生日表存于 src/data/featured-birthdays.json（构建期派生、入库，见脚本同名文件），
 * 这里是两份数据的唯一消费方之一；构图参数 pos/zoom/originY 含义见 IMG_GUIDE.md。
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
import featuredBirthdays from '@/data/featured-birthdays.json'

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
  /** 今天是不是这位的生日：标本签据此挂「生日」小签，读屏名也随之带上（见 FeaturedDeck） */
  isBirthday: boolean
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
 * 展示格是版心内居中的超宽标本板（取景框最宽 1180 CSS px，再乘逐图 zoom 1.05-1.49），
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

/** 某角色的生日（`MM-DD`，与生日表同构）；源数据无生日（如 1551）返回 null —— 该角色只参与补齐 */
export function birthdayOf(id: number): string | null {
  const table = featuredBirthdays as unknown as Record<string, string>
  const v = table[String(id)]
  return typeof v === 'string' ? v : null
}

/** 某天（默认今天）的 `MM-DD` 键：与生日表同构，故「是否当天生日」只是一次字符串比较 */
export function monthDayKey(d: Date = new Date()): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * 今日精选：**当天生日的角色优先**。
 *
 * 当天过生日的池内角色排在牌堆最前（生日表见 scripts/generate-featured-birthdays.mjs），
 * 其余名额按「本地日期播种」的确定性顺序补齐 —— 同日恒定（文案承诺的是「今日」这批，
 * 回访还能命中图片缓存）、跨日自动换一批；生日组内部同样按播种序，故同日顺序也恒定。
 *
 * 曾按「属性 + 阵营」双重去重以免首屏 4 张雷同，改为生日优先后不再需要。
 * 选片必须同步发生（头图 src 只依赖 id，才能与清单请求并行），不能等名录返回 ——
 * 这正是生日要在构建期派生、入库、CI 校验的原因。
 *
 * @param date  选片基准日（默认此刻）：同时定 seed 与「今天」，避免两次读时钟跨零点打架
 * @param count 牌堆张数（默认 4）：当天生日角色多于 count 时，按播种序取前 count 位
 */
export function pickFeatured(
  pool: readonly PoolItem[],
  date: Date = new Date(),
  count = 4,
): PoolItem[] {
  const seed = daySeed(date)
  const today = monthDayKey(date)

  const birthday: PoolItem[] = []
  const others: PoolItem[] = []
  for (const p of pool) (birthdayOf(p.id) === today ? birthday : others).push(p)

  // seededShuffle 返回新数组（不改入参），故可安全地把它当作结果容器继续补位
  const out = seededShuffle(birthday, seed)
  for (const p of seededShuffle(others, seed)) {
    if (out.length >= count) break
    out.push(p)
  }
  return out.slice(0, count)
}

/**
 * 由池条目 + 名录解析卡片。list 为 null（清单未就绪）时照样出卡：头图 src 只依赖 id，
 * 名字/元素留空由视图占位——让 LCP 图片与清单请求并行，而非排在它后面。
 * 名单就绪后按名录真值解析；池内 id 不在名录时丢弃并紧凑重排编号（策展真值）。
 * `sizes` 由调用方按挂载期取景框宽定档（见 deckSizes），好让预热与真实 <img> 同档。
 * `form` 为双形态角色的当前形态（佩洛伊斯）：**卡面跟随详情页所选形态**，
 * 好让卡片与降落端同图、共享元素飞行不出现「女性溶解成男性」。非双形态角色不受影响。
 * `birthdayKey` 为「今天」的 `MM-DD`（默认取当前日期）：调用方传入与选片**同一个**基准日，
 * 免得标志与选片跨零点各说各话。
 */
export function buildFeaturedCards(
  seed: PoolItem[],
  list: CharacterListItem[] | null,
  sizes: string = deckSizes(),
  form: HeroForm = DEFAULT_HERO_FORM,
  birthdayKey: string = monthDayKey(),
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
      // 生日标记与选片同源（同一张生日表 + 同一个「今天」）：不依赖名录，
      // 故名录未就绪、名字还在占位时标记就已经是对的
      isBirthday: birthdayOf(n.id) === birthdayKey,
    })
  }
  return cards.map((c, i) => ({ ...c, no: String(i + 1).padStart(2, '0') }))
}

/** 首页「今日角色」：**当天生日的角色优先**，按日期确定性取 4 张 + 解析，返回响应式 featured。
 *  同日恒定（文案承诺的是「今日」这批，回访还能命中图片缓存）、跨日自动换一批；
 *  早前用 Math.random 每次挂载换人——文案与行为不符，且回访用户永远冷缓存。
 *  featured 与 picks 等长起步（名字未就绪时留空占位），清单到达后按真值收敛。 */
export function useFeaturedAgents() {
  /** 选片基准日只取一次：picks 与卡片的生日标记共用同一个「今天」，跨零点不会两边劈叉 */
  const date = new Date()
  const picks = pickFeatured(FEATURED_POOL, date)
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
  const featured = computed(() => buildFeaturedCards(picks, list.value, sizes, heroForm.value, monthDayKey(date)))
  return { featured, picks }
}
