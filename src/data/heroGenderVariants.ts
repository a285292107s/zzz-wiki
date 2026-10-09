/* ============================================================
 * heroGenderVariants — 双形态角色 hero 头图（Mindscape_{id}_Female/Male_2）单一事实源访问器。
 *
 * 数据在 hero-gender-variants.json：value = { variants, defaultFile }。
 * defaultFile = 本站默认展示（女性）版；男性版为 variants 中 ≠ defaultFile 的项（不依赖顺序）。
 * 当前形态经 useHeroForm 选中（1551 详情页 AgentHead 形态切换钮；首页 hero 头图已移除）。
 * 命名与 download-icons.mjs 的 HERO_GENDER_VARIANTS 一致。
 * ============================================================ */

import variants from './hero-gender-variants.json'

/** hero 头图形态（与 useHeroForm 状态共用；双形态角色按此取对应图） */
export type HeroForm = 'female' | 'male'

type GenderVariantEntry = {
  variants: string[]
  defaultFile: string
}

const byId = variants as Record<string, GenderVariantEntry>

/** 取某角色当前形态对应的 hero 裸文件名（无 .webp）。
 *  女性=defaultFile（缺省展示版）；男性=variants 中非 defaultFile 的那项（缺位则回退 defaultFile）。
 *  非双形态角色（不在 JSON 中）返回 null，调用方回落到裸名 Mindscape_{id}_2 规则。 */
export function heroVariantFile(id: number | undefined, form: HeroForm): string | null {
  if (id == null) return null
  const entry = byId[String(id)]
  if (!entry) return null
  if (form === 'female') return entry.defaultFile
  return entry.variants.find((v) => v !== entry.defaultFile) ?? entry.defaultFile
}

/** 取角色在**指定形态**下的 hero 头图文件名（不含 .webp）。
 *  非双形态角色（不在 JSON 中）按裸名规则回落 `Mindscape_{id}_2`。
 *  这是「id + 形态 → 文件名」的**唯一**出口：详情页、首页卡面、过渡预热全走它，
 *  避免同一个回落表达式在四处各写一遍而漂移。 */
export function heroFileForForm(id: number | undefined, form: HeroForm): string {
  return heroVariantFile(id, form) ?? `Mindscape_${id}_2`
}

/** 取角色 hero 头图的「默认展示」文件名（不含 .webp）：双形态角色取默认（女性）版，其余取裸名
 *  Mindscape_{id}_2。供校准工具（CalibrateView）引用默认形态——校准只在默认（女性）版上做，
 *  故这里恒取 female，不跟随用户选择。
 *  **首页「今日角色」不用它**：那里跟随用户所选形态（`heroFileForForm` + `useHeroForm`），
 *  与详情页保持一致；详情页 AgentHead 同理按所选形态取图。 */
export function heroImageFile(id: number | undefined): string {
  return heroFileForForm(id, 'female')
}
