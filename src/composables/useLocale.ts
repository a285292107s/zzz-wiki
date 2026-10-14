/* ============================================================
 * useLocale — 当前展示语言（全站一份）。
 *
 * **范围**：语言同时切换**游戏内容**与**界面短文案**——前者是角色/音擎/邦布/驱动盘的名称、
 * 技能与描述正文、术语释义、阵营与特殊属性展示名（随四语数据面，见决策记录 0010）；
 * 后者是导航、按钮、区块标题、筛选标签、空错态、检索面板、设置页与页面 meta
 * （随四语文案表 `domain/uiText.*.json`，见决策记录 0011）。**站内中文长文**（`/about`、
 * `/formulas`）与构建期静态产物（sitemap、逐路由 HTML、`og:` 元信息）仍是中文单语，
 * 长文页对非中文读者挂「本页仅中文」注记。
 *
 * **存哪**：本机 localStorage——与代理人名录版式、佩洛伊斯立绘形态同一类偏好，**不进 URL**。
 * 理由：语言是本机偏好而不是页面身份。进了 URL 会让同一页面有多个地址，
 * 而 sitemap / canonical / 逐路由静态 HTML 都按单地址生成（见 generate-sitemap 头注释）。
 *
 * 状态是模块级的（与 useAgentsViewVersion / useHeroForm 同模式）：
 * 设置页的「展示语言」选项板与各列表/详情页读的是同一份，不存在「两处语言不一致」。
 * （切换入口只有设置页一处，站头没有语言控件——站的宽度空间账不允许，见 0010。）
 * ============================================================ */

import { readonly, ref, type Ref } from 'vue'
import { DEFAULT_LANG, LANG_META, isLang, type Lang } from '@/domain/lang'

const STORAGE_KEY = 'zzz-wiki:lang'

/** 读本机偏好语言；不可读（隐私模式）或值非法时返回 null，交由默认语言兜底。 */
function readStored(): Lang | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return isLang(raw) ? raw : null
  } catch {
    return null
  }
}

/** 当前语言。首访固定默认语言（zh）——**不按 navigator.language 自动切换**：
 *  站点面向中文读者，自动跟随会让「浏览器语言不是中文」的人一进来就看到另一种语言，
 *  而切换入口是可见的（见决策记录 0010 的备选方案取舍）。 */
const current = ref<Lang>(readStored() ?? DEFAULT_LANG)

const lang = readonly(current)

function persist(next: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* 不可写场景忽略：偏好不落盘不阻断浏览 */
  }
}

function applyHtmlLang(value: Lang): void {
  if (typeof document !== 'undefined') document.documentElement.lang = LANG_META[value].htmlLang
}

/** 启动时调用一次（main.ts）：把已存语言写到 `<html lang>`。
 *  读屏与搜索引擎据此判定页面语言，缺失会退回 index.html 的静态值。 */
export function bootstrapLocale(): void {
  applyHtmlLang(current.value)
}

/** 切换语言：状态、本机偏好、`<html lang>` 三处同步改。
 *  数据面按语言取数，列表/详情消费方读 `lang` 后会自动重新取（见 useAsyncResource）。 */
export function setLang(next: Lang): void {
  if (!isLang(next) || next === current.value) return
  current.value = next
  persist(next)
  applyHtmlLang(next)
}

/** 组件内取用：`const { lang, setLang } = useLocale()`（模板里 `lang` 自动解包） */
export function useLocale(): { lang: Readonly<Ref<Lang>>; setLang: (next: Lang) => void } {
  return { lang, setLang }
}
