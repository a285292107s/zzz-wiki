/* ============================================================
 * useHeroForm — 佩洛伊斯（1551）双形态 hero 头图选用（Female/Male）。
 *
 * 消费方：佩洛伊斯（1551）详情页 AgentHead、首页「今日角色」、代理人名录卡片。
 * 切换入口统一在**设置页**（/settings）——它是全站偏好设置的落点，
 * 详情页不再各放一个切换钮（那里读者是来看档案的，不是来调设置的）。
 * localStorage 持久化，跨刷新 / 跨页保持用户所选形态。
 * 双形态命名与 download-icons.mjs 的 HERO_GENDER_VARIANTS 一致（Mindscape_1551_Female/Male_2）。
 * ============================================================ */

import { ref, type Ref } from 'vue'
import type { HeroForm } from '@/data/heroGenderVariants'

export const DEFAULT_HERO_FORM: HeroForm = 'female'
const HERO_FORM_KEY = 'zzz-wiki:hero-form'

function loadHeroForm(): HeroForm {
  if (typeof localStorage !== 'undefined') {
    const v = localStorage.getItem(HERO_FORM_KEY)
    if (v === 'female' || v === 'male') return v
  }
  return DEFAULT_HERO_FORM
}

/** 全局双形态选择（模块级响应式，localStorage 持久化）。 */
export const heroForm: Ref<HeroForm> = ref(loadHeroForm())

/** 写形态偏好。存储不可写（隐私模式等）时忽略——本次会话内仍生效。 */
export function setHeroForm(v: HeroForm): void {
  heroForm.value = v
  try {
    localStorage.setItem(HERO_FORM_KEY, v)
  } catch {
    // 隐私模式等不可写场景忽略（本次会话内仍生效）
  }
}

export function useHeroForm(): {
  heroForm: Ref<HeroForm>
  setHeroForm: (v: HeroForm) => void
} {
  return { heroForm, setHeroForm }
}
