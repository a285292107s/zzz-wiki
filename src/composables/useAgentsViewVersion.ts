/* ============================================================
 * useAgentsViewVersion — 代理人名录页的展示版本偏好（表格 / 卡片）。
 *
 * **本地偏好，不进 URL**：版本是「这位读者自己的阅读习惯」，不是「这份视图的内容」。
 * 写进查询参数的话，读者复制出去的筛选链接会把他的偏好强加给收件人，
 * 也会与 q/attr/prof/camp/sort 那套「URL = 可分享视图」的语义混在一起。
 *
 * 与 useHeroForm 同构：模块级响应式 + localStorage，跨刷新与跨路由保持；
 * 读写都做环境兜底（无 localStorage / 隐私模式不可写的场景回落默认值）。
 * ============================================================ */

import { ref, type Ref } from 'vue'

/** 'table' = 保留至今的表格名录；'cards' = 参考 /calibrate 角色格的新版卡片名录 */
export type AgentsViewVersion = 'table' | 'cards'

/** 新读者默认落在新版卡片名录 */
export const DEFAULT_AGENTS_VIEW: AgentsViewVersion = 'cards'

const AGENTS_VIEW_KEY = 'zzz-wiki:agents-view'

function loadAgentsViewVersion(): AgentsViewVersion {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(AGENTS_VIEW_KEY)
    if (saved === 'table' || saved === 'cards') return saved
  }
  return DEFAULT_AGENTS_VIEW
}

export const agentsViewVersion: Ref<AgentsViewVersion> = ref(loadAgentsViewVersion())

/** 写偏好。存储不可写（隐私模式等）时忽略——本次会话内仍生效。 */
export function setAgentsViewVersion(v: AgentsViewVersion): void {
  agentsViewVersion.value = v
  try {
    localStorage.setItem(AGENTS_VIEW_KEY, v)
  } catch {
    /* 存储不可写时仅本会话生效 */
  }
}

/** 设置页与名录外壳共用：读当前版本 + 写入新版本 */
export function useAgentsViewVersion(): {
  agentsViewVersion: Ref<AgentsViewVersion>
  setAgentsViewVersion: (v: AgentsViewVersion) => void
} {
  return { agentsViewVersion, setAgentsViewVersion }
}
