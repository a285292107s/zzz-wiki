/* ============================================================
 * 技能键位图标 — 本地矢量字形
 *
 * 来源：temp/ 下 7 个游戏图标（Icon_*.webp）逐像素分析后以 SVG 重绘
 * （icon_proto.py 迭代比对 IoU，icon_components.py 连通域/主轴向分析），
 * 与官方图标形似；零外部请求，符合「运行时零外部请求」铁律。
 *
 * 字形映射（游戏资产名 → 本地 SVG 内层标记，100x100 视口）：
 *   Icon_Normal        普通攻击三爪
 *   Icon_Evade         闪避双层 ∧ chevron
 *   Icon_SpecialReady  特殊技·蓄满：紫色菱形 + 四角斜条（Icon_Special
 *                      nanoka 无素材，描本沿用同族 Ready 字形）
 *   Icon_QTE           连携触发：X 斜条 + 中央横六边形
 *   Icon_UltimateReady 终结技：橙色四芒爆星
 *   Icon_Switch        支援/切换：拱顶三柱 + 交叉斜撑
 *   Icon_CoreSkill     核心技：细环 + 六辐 + 独立中心盘
 * ============================================================ */

export type SkillSlot =
  | 'basic'
  | 'dodge'
  | 'special'
  | 'chain'
  | 'assist'
  | 'core'
  | 'qte'

export type SkillAssetKey =
  | 'Icon_Normal'
  | 'Icon_Evade'
  | 'Icon_SpecialReady'
  | 'Icon_QTE'
  | 'Icon_UltimateReady'
  | 'Icon_Switch'
  | 'Icon_CoreSkill'

/** 技能槽 → 官方资产名 */
export const SLOT_ASSET: Record<SkillSlot, SkillAssetKey> = {
  basic: 'Icon_Normal',
  dodge: 'Icon_Evade',
  special: 'Icon_SpecialReady', // 无 Icon_Special 素材，沿用同族 Ready 字形
  chain: 'Icon_UltimateReady',
  assist: 'Icon_Switch',
  core: 'Icon_CoreSkill',
  qte: 'Icon_QTE',
}

/** 键位标签（详情页键名纹章） */
export const SLOT_LABELS: Record<SkillSlot, string> = {
  basic: 'NORMAL',
  dodge: 'DODGE',
  special: 'SPECIAL',
  chain: 'CHAIN',
  assist: 'ASSIST',
  core: 'CORE',
  qte: 'QTE',
}

/** 中央圆底背景色（沿用站点墨色） */
const BG_FILL = 'var(--ink-0, #151515)'
const RING_STROKE = 'var(--ink-2, #555)'

/** 官方资产名 → 内层 SVG 标记（符号形状，100x100 视口） */
export const SKILL_GLYPHS: Record<SkillAssetKey, string> = {
  /* 三爪：顶帽 + 左中右三爪（侧爪斜向渐细）+ 三处横档 + 底部汇合 */
  Icon_Normal:
    '<circle cx="50" cy="14" r="5.5" fill="#F2F2F2"/>' +
    '<rect x="25" y="11" width="50" height="12" rx="6" ry="6" fill="#F2F2F2"/>' +
    '<path d="M 37 22.5 L 23 17 L 6.5 68 L 17 72.5 Z" fill="#F2F2F2"/>' +
    '<circle cx="37" cy="22.5" r="4" fill="#F2F2F2"/>' +
    '<circle cx="23" cy="17" r="4" fill="#F2F2F2"/>' +
    '<circle cx="6.5" cy="68" r="4" fill="#F2F2F2"/>' +
    '<circle cx="17" cy="72.5" r="4" fill="#F2F2F2"/>' +
    '<circle cx="30" cy="19.5" r="7.5" fill="#F2F2F2"/>' +
    '<circle cx="13.5" cy="72" r="5.5" fill="#F2F2F2"/>' +
    '<path d="M 56 13 L 44 13 L 45 76 L 55 76 Z" fill="#F2F2F2"/>' +
    '<circle cx="56" cy="13" r="4" fill="#F2F2F2"/>' +
    '<circle cx="44" cy="13" r="4" fill="#F2F2F2"/>' +
    '<circle cx="45" cy="76" r="4" fill="#F2F2F2"/>' +
    '<circle cx="55" cy="76" r="4" fill="#F2F2F2"/>' +
    '<circle cx="50" cy="14" r="6" fill="#F2F2F2"/>' +
    '<circle cx="50" cy="76" r="5" fill="#F2F2F2"/>' +
    '<path d="M 63 17 L 77 22.5 L 83 72.5 L 93.5 68 Z" fill="#F2F2F2"/>' +
    '<circle cx="63" cy="17" r="4" fill="#F2F2F2"/>' +
    '<circle cx="77" cy="22.5" r="4" fill="#F2F2F2"/>' +
    '<circle cx="83" cy="72.5" r="4" fill="#F2F2F2"/>' +
    '<circle cx="93.5" cy="68" r="4" fill="#F2F2F2"/>' +
    '<circle cx="66" cy="19.5" r="7.5" fill="#F2F2F2"/>' +
    '<circle cx="87" cy="72" r="5.5" fill="#F2F2F2"/>' +
    '<rect x="48" y="39" width="34" height="6" rx="3" ry="3" fill="#F2F2F2"/>' +
    '<rect x="5" y="46.5" width="42" height="7" rx="3.5" ry="3.5" fill="#F2F2F2"/>' +
    '<rect x="48" y="57" width="20" height="6" rx="3" ry="3" fill="#F2F2F2"/>' +
    '<rect x="29" y="81.5" width="40" height="9" rx="4.5" ry="4.5" fill="#F2F2F2"/>',

  /* 闪避：双层 ∧ chevron（外大内小，弧臂外鼓）+ 顶帽 + 底带 */
  Icon_Evade:
    '<rect x="32" y="6.5" width="36" height="12" rx="6" ry="6" fill="#F2F2F2"/>' +
    '<path d="M 50 16 Q -24 50 26 83" fill="none" stroke="#F2F2F2" stroke-width="8" stroke-linecap="round"/>' +
    '<path d="M 50 16 Q 74 50 74 83" fill="none" stroke="#F2F2F2" stroke-width="8" stroke-linecap="round"/>' +
    '<circle cx="50" cy="16" r="4.5" fill="#F2F2F2"/>' +
    '<circle cx="50" cy="51" r="7" fill="#F2F2F2"/>' +
    '<path d="M 50 51 Q 33 66 40 84" fill="none" stroke="#F2F2F2" stroke-width="7.5" stroke-linecap="round"/>' +
    '<path d="M 50 51 Q 67 66 60 84" fill="none" stroke="#F2F2F2" stroke-width="7.5" stroke-linecap="round"/>' +
    '<rect x="24" y="83" width="52" height="8" rx="4" ry="4" fill="#F2F2F2"/>',

  /* 特殊技·蓄满：紫色中央菱形 + 四角斜条（各与菱形留隙、向外倾） */
  Icon_SpecialReady:
    '<path d="M 50 33.5 L 66.5 50 L 50 66.5 L 33.5 50 Z" fill="#6D5AE8"/>' +
    '<circle cx="50" cy="33.5" r="6" fill="#6D5AE8"/>' +
    '<circle cx="66.5" cy="50" r="6" fill="#6D5AE8"/>' +
    '<circle cx="50" cy="66.5" r="6" fill="#6D5AE8"/>' +
    '<circle cx="33.5" cy="50" r="6" fill="#6D5AE8"/>' +
    '<path d="M 29 13 Q 24 25 13 40" fill="none" stroke="#6D5AE8" stroke-width="12" stroke-linecap="round"/>' +
    '<path d="M 71 13 Q 76 25 87 40" fill="none" stroke="#6D5AE8" stroke-width="12" stroke-linecap="round"/>' +
    '<path d="M 13 60 Q 24 75 29 87" fill="none" stroke="#6D5AE8" stroke-width="12" stroke-linecap="round"/>' +
    '<path d="M 87 60 Q 76 75 71 87" fill="none" stroke="#6D5AE8" stroke-width="12" stroke-linecap="round"/>',

  /* 连携触发：四角粗斜条 + 中央横置六边形 */
  Icon_QTE:
    '<path d="M 38 10 Q 22 18 14 35" fill="none" stroke="#F2F2F2" stroke-width="19" stroke-linecap="round"/>' +
    '<path d="M 62 10 Q 78 18 86 35" fill="none" stroke="#F2F2F2" stroke-width="19" stroke-linecap="round"/>' +
    '<path d="M 38 90 Q 22 82 14 65" fill="none" stroke="#F2F2F2" stroke-width="19" stroke-linecap="round"/>' +
    '<path d="M 62 90 Q 78 82 86 65" fill="none" stroke="#F2F2F2" stroke-width="19" stroke-linecap="round"/>' +
    '<path d="M 28 50 L 40 40 L 60 40 L 72 50 L 60 60 L 40 60 Z" fill="#F2F2F2"/>' +
    '<circle cx="28" cy="50" r="4" fill="#F2F2F2"/>' +
    '<circle cx="40" cy="40" r="4" fill="#F2F2F2"/>' +
    '<circle cx="60" cy="40" r="4" fill="#F2F2F2"/>' +
    '<circle cx="72" cy="50" r="4" fill="#F2F2F2"/>' +
    '<circle cx="60" cy="60" r="4" fill="#F2F2F2"/>' +
    '<circle cx="40" cy="60" r="4" fill="#F2F2F2"/>',

  /* 终结技：橙色四芒爆星（上下尖锥 + 左右弧臂 + 中央菱形） */
  Icon_UltimateReady:
    '<path d="M 50 37 L 63 50 L 50 63 L 37 50 Z" fill="#F89000"/>' +
    '<circle cx="50" cy="37" r="6" fill="#F89000"/>' +
    '<circle cx="63" cy="50" r="6" fill="#F89000"/>' +
    '<circle cx="50" cy="63" r="6" fill="#F89000"/>' +
    '<circle cx="37" cy="50" r="6" fill="#F89000"/>' +
    '<path d="M 50 5 L 36 24 L 64 24 Z" fill="#F89000"/>' +
    '<circle cx="50" cy="5" r="4" fill="#F89000"/>' +
    '<circle cx="36" cy="24" r="4" fill="#F89000"/>' +
    '<circle cx="64" cy="24" r="4" fill="#F89000"/>' +
    '<path d="M 50 95 L 40 78 L 60 78 Z" fill="#F89000"/>' +
    '<circle cx="50" cy="95" r="4" fill="#F89000"/>' +
    '<circle cx="40" cy="78" r="4" fill="#F89000"/>' +
    '<circle cx="60" cy="78" r="4" fill="#F89000"/>' +
    '<path d="M 34 16 Q 4 50 40 86" fill="none" stroke="#F89000" stroke-width="17" stroke-linecap="round"/>' +
    '<path d="M 66 16 Q 96 50 60 86" fill="none" stroke="#F89000" stroke-width="17" stroke-linecap="round"/>',

  /* 支援/切换：拱顶 + 三柱 + 交叉斜撑 + 底带 */
  Icon_Switch:
    '<rect x="18" y="11" width="64" height="12" rx="6" ry="6" fill="#F2F2F2"/>' +
    '<circle cx="50" cy="13" r="9" fill="#F2F2F2"/>' +
    '<rect x="10.5" y="17" width="11" height="56" rx="5.5" ry="5.5" transform="rotate(6 16 45)" fill="#F2F2F2"/>' +
    '<rect x="45" y="26" width="10" height="40" rx="5" ry="5" fill="#F2F2F2"/>' +
    '<rect x="78.5" y="17" width="11" height="56" rx="5.5" ry="5.5" transform="rotate(-6 84 45)" fill="#F2F2F2"/>' +
    '<line x1="26" y1="46" x2="60" y2="78" stroke="#F2F2F2" stroke-width="8.5" stroke-linecap="round"/>' +
    '<line x1="74" y1="46" x2="40" y2="78" stroke="#F2F2F2" stroke-width="8.5" stroke-linecap="round"/>' +
    '<rect x="21" y="77.5" width="58" height="11" rx="5.5" ry="5.5" fill="#F2F2F2"/>',

  /* 核心技：细外环 + 六辐（不触盘）+ 独立中心盘 */
  Icon_CoreSkill:
    '<circle cx="50" cy="50" r="39" fill="none" stroke="#F2F2F2" stroke-width="4.5"/>' +
    '<line x1="50" y1="26" x2="50" y2="11.5" stroke="#F2F2F2" stroke-width="14" stroke-linecap="round"/>' +
    '<line x1="70.8" y1="38" x2="83.3" y2="30.8" stroke="#F2F2F2" stroke-width="14" stroke-linecap="round"/>' +
    '<line x1="29.2" y1="38" x2="16.7" y2="30.8" stroke="#F2F2F2" stroke-width="14" stroke-linecap="round"/>' +
    '<line x1="50" y1="74" x2="50" y2="88.5" stroke="#F2F2F2" stroke-width="14" stroke-linecap="round"/>' +
    '<line x1="29.2" y1="62" x2="16.7" y2="69.2" stroke="#F2F2F2" stroke-width="14" stroke-linecap="round"/>' +
    '<line x1="70.8" y1="62" x2="83.3" y2="69.2" stroke="#F2F2F2" stroke-width="14" stroke-linecap="round"/>' +
    '<circle cx="50" cy="50" r="8.5" fill="#F2F2F2"/>',
}

/** 无独立素材的文本内同名标记（游戏内同族图标）→ 复用字形 */
const ALIAS: Record<string, SkillAssetKey> = {
  Icon_Special: 'Icon_SpecialReady',
  Icon_SpecialReady_Rp: 'Icon_SpecialReady',
}

/** 生成完整 SVG 图标串；size 传数字像素或 CSS 长度（如 '100%'、'1em'） */
export function renderSkillGlyph(asset: string, size: number | string = 38): string {
  const name = asset.replace(/\.(png|webp)$/i, '')
  const key = (SKILL_GLYPHS[name as SkillAssetKey] ? name : ALIAS[name]) as SkillAssetKey | undefined
  const inner = key ? SKILL_GLYPHS[key] : null
  if (!inner) return ''
  const w = typeof size === 'number' ? `${size}px` : size
  return (
    `<svg width="${w}" height="${w}" viewBox="0 0 100 100" fill="none" ` +
    `xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${name}">` +
    `<circle cx="50" cy="50" r="46" fill="${BG_FILL}"/>` +
    inner +
    `<circle cx="50" cy="50" r="46" fill="none" stroke="${RING_STROKE}" stroke-width="1.5"/>` +
    `</svg>`
  )
}