/* ============================================================
 * imageSource — <img> 候选的通用契约（HollowImage 与调用方共用）
 *
 * 候选既可以是单地址字符串（多数场景足够），也可以是 `{ src, srcset, sizes }`：
 * 同一张图有多个本地派生档位时（首页「今日角色」的 card 800w / wide 1600w / 原图），
 * 把档位交给浏览器按 DPR × 视口自己挑，而不是在前端用 JS 猜 devicePixelRatio。
 * ============================================================ */

export interface ImageSource {
  /** 必填：srcset 不受支持、或描述符全部不匹配时的兜底地址 */
  src: string
  /** 宽度描述符集合，如 `/a.webp 800w, /b.webp 1600w`（按宽度升序） */
  srcset?: string
  /** srcset 的 w 描述符基准（元素布局宽度）——**给了 srcset 就必须给 sizes**，
   *  否则浏览器按 100vw 兜底，档位选择会偏大 */
  sizes?: string
}

/** 候选：字符串（单地址）或带 srcset 的完整描述 */
export type ImageCandidate = string | ImageSource

/** 归一化候选列表：滤掉空值、字符串升格为 `{ src }`，**保持入参顺序**（顺序即候选链优先级） */
export function normalizeCandidates(
  list: readonly (ImageCandidate | null | undefined)[] | undefined,
): ImageSource[] {
  const out: ImageSource[] = []
  for (const c of list ?? []) {
    if (!c) continue
    if (typeof c === 'string') out.push({ src: c })
    else if (c.src) out.push(c)
  }
  return out
}
