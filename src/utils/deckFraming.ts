/* ============================================================
 * deckFraming — 首页「今日角色」卡片立绘的取景样式（纯逻辑，可单测）。
 *
 * 只有一个消费方（FeaturedDeck），但它承载一条**容易改错**的判断：起飞前那张画该不该
 * 把取景切成「目的地取景」。宽度断点与环境无关的推理都收在这里，组件只负责调它。
 *
 * 两个状态：
 *   · 常态         —— 用该图自己的 9:16 校准（pos / originY / zoom），见 IMG_GUIDE.md
 *   · 起飞前变形态 —— 切到「桌面详情页 hero 的取景」：hero 画幅的 object-position 双轴平移、
 *                     不缩放（详情页 hero 只做 cover 平移，见 IMG_GUIDE.md 的 hero 模式）
 *
 * **为什么窄屏不做变形**：变形目标（桌面详情页 hero 的取景，hero 画幅、只平移不缩放）只在桌面
 * 等于降落端。窄屏详情头图（AgentHead 手机端）套用的是 9:16 母版校准，目的地取景就等于卡片
 * 自己的校准取景 —— 变形到桌面 hero 的取景反而把画推离目的地：实测（390×844，源图可见分数区间）
 *   卡片校准态 y 0–0.7722（= 窄屏详情页 y 0–0.7722，逐像素一致）
 *   桌面 hero 取景态 y 0–1.0（该图源图比 hero 画幅窄时纵向铺满）
 * 交接口因此凭空多出 1/0.7722 ≈ 1.295× 的纵向尺度差（恰等于该图 zoom）——
 * 正是 README 里那个「飞到最后啪地换了个大小」，在窄屏被变形自己造了出来。
 * 故窄屏下**不动才是对的**：让画保持校准取景飞过去，交接零错位。
 *
 * 断点 860 与 CSS（tokens.css / FeaturedDeck / AgentHead 的 @media）同值；
 * 单一事实源在样式侧，这里只接受调用方传入的判定结果（组件用 useMediaQuery 求值），
 * 因此本模块不重复声明断点数字。
 * ============================================================ */

/** 逐图 9:16 校准参数（featured-pool.json 的 modes['9:16']），结构类型以便本模块不依赖上层 */
export interface DeckCalibration {
  pos: string
  zoom: number
  originY: number
}

/** 目的地取景：桌面详情页 hero 的 hero 画幅校准（只用双轴平移；无校准＝居中） */
export interface DeckDestination {
  pos: string
  posY: string
}

const DEFAULT_CALIBRATION: DeckCalibration = { pos: '50%', zoom: 1, originY: 50 }
const DEFAULT_DESTINATION: DeckDestination = { pos: '50%', posY: '50%' }

/** 桌面详情页 hero 的取景：cover + 双轴平移、不缩放（与 AgentHead 桌面端同一套） */
function destinationStyle(destination: DeckDestination | undefined): Record<string, string> {
  const d = destination ?? DEFAULT_DESTINATION
  return {
    objectPosition: `${d.pos} ${d.posY}`,
    transformOrigin: '50% 50%',
    transform: 'scale(1)',
  }
}

/**
 * 卡片立绘的内联取景样式。
 *
 * @param calibration 该卡的 9:16 校准（可为 undefined：数据未到达时回落到居中）
 * @param destination 目的地（桌面详情页 hero）的取景；undefined 时按居中
 * @param morphing    是否处于「起飞前取景变形」中（由编排状态驱动）
 * @param narrow      是否窄屏（≤860，与 CSS 同一条媒体查询）
 */
export function deckFigureStyle(
  calibration: DeckCalibration | undefined,
  destination: DeckDestination | undefined,
  morphing: boolean,
  narrow: boolean,
): Record<string, string> {
  // 窄屏不变形：目的地取景 = 卡片校准取景，切桌面 hero 取景只会制造尺度错位（见文件头）
  if (morphing && !narrow) return destinationStyle(destination)
  const c = calibration ?? DEFAULT_CALIBRATION
  return {
    objectPosition: c.pos,
    transformOrigin: `50% ${c.originY}%`,
    transform: `scale(${c.zoom})`,
  }
}
