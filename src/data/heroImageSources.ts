/* ============================================================
 * heroImageSources — 详情页 hero 头图与名录卡片候选链的单一事实源。
 *
 * 两个消费方必须算出**同一个地址**，否则会白下一份：
 *   · AgentHead 渲染（真正上屏的那张）
 *   · 首页「今日角色」→ 详情的共享元素过渡（起飞前预热降落端的画）
 *
 * 详情页档位规则（与 generate-route-html.mjs 的预载 media 条件同源，改一处要同步三处）：
 *   · 窄屏（≤860，与 tokens.css 同一断点）或 DPR<1.5：mobile/ 1400w 派生
 *     （手机可见窗仅 ~350 CSS px，原图宽 1326–2580 超采 2–4×）
 *   · 否则原图：宽屏 hero 盒 ~1168 CSS px，DPR1 用 1400w 会放大，故取原图
 *     （解包母版贴边后画幅更满，DPR2 桌面会有 ~1.3× 放大，母版分辨率即上限）
 * 顺序即回退顺序：派生档缺失时落到原图，本地耗尽才走同源 CDN 兜底。
 *
 * 名录卡片（9:16 竖格）走另一套档位，见 heroGridSources。
 * ============================================================ */

import type { ImageSource } from '@/utils/imageSource'

/** 本地 hero 头图根（download:icons 落地 public/data/img/hero，运行时零外部请求） */
export const LOCAL_HERO = `${import.meta.env.BASE_URL ?? '/'}data/img/hero`

/** 详情页 hero 的候选链（`base` 为不含 .webp 的裸文件名）。 */
export function heroDetailSources(
  base: string,
  opts: { narrow: boolean; retina: boolean },
): ImageSource[] {
  const local = `${LOCAL_HERO}/${base}.webp`
  const mobile = `${LOCAL_HERO}/mobile/${base}.webp`
  const cdn = `https://static.nanoka.cc/assets/zzz/${base}.webp`
  return opts.narrow || !opts.retina
    ? [{ src: mobile }, { src: local }, { src: cdn }]
    : [{ src: local }, { src: cdn }]
}

/** hero 候选链的首选地址 = 渲染时真正会请求的那一份（候选无 srcset，故首项即实取）。
 *  共享元素过渡的起飞前预热带它去暖缓存：算错档位等于白下一份（见文件头）。 */
export function heroDetailPrimarySrc(
  base: string,
  opts: { narrow: boolean; retina: boolean },
): string {
  return heroDetailSources(base, opts)[0]!.src
}

/** 当前视口下的档位判定（与 AgentHead 的 useMediaQuery 同一条查询）：
 *  预热发生在 setup / 路由守卫里，拿不到响应式 ref，故就地求值一次。 */
export function heroDetailViewport(): { narrow: boolean; retina: boolean } {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return { narrow: false, retina: true }
  }
  return {
    narrow: window.matchMedia('(max-width: 860px)').matches,
    retina: window.matchMedia('(min-resolution: 1.5dppx)').matches,
  }
}

/** 名录卡片（9:16 竖格）的候选链（`base` 为不含 .webp 的裸文件名）。
 *
 *  档位按**高**算，不按宽：9:16 从约 2:1 的场景横幅里取景，用满原图高度、只用掉约 28% 的宽度
 *  —— 按宽度挑档会让结果小 3 倍以上（实测：按宽 400 出 10.5KB/张，放大糊；
 *  按高 800 出 82.4KB/张，与 wide/ 同价）。
 *   · DPR < 1.5：card/ 800×392（32KB/张，格内实际需要 ~277 CSS px）
 *   · DPR ≥ 1.5：wide/ 1600×784（84KB/张）
 *  两档都不在本地时落到原图（~351KB/张），本地耗尽才走同源 CDN 兜底。 */
export function heroGridSources(base: string, opts: { retina: boolean }): ImageSource[] {
  const local = `${LOCAL_HERO}/${base}.webp`
  const card = `${LOCAL_HERO}/card/${base}.webp`
  const wide = `${LOCAL_HERO}/wide/${base}.webp`
  const cdn = `https://static.nanoka.cc/assets/zzz/${base}.webp`
  return [{ src: opts.retina ? wide : card }, { src: local }, { src: cdn }]
}

/** 等一张图可绘制（带上限）：**超时/失败都 resolve** —— 预热是优化不是功能，
 *  调用方（共享元素过渡）只借它把「新快照空画布」的窗口压到最小。
 *  环境无 `decode`（jsdom 等）时不假装等待，直接放行。 */
export function awaitImageReady(src: string, timeoutMs: number): Promise<void> {
  const img = new Image()
  img.decoding = 'async'
  img.src = src
  const ready = typeof img.decode === 'function' ? img.decode().catch(() => undefined) : undefined
  if (!ready) return Promise.resolve()
  const cap = new Promise<void>((r) => setTimeout(r, timeoutMs))
  return Promise.race([ready, cap]).then(() => undefined)
}
