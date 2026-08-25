/* ============================================================
 * useHeroForm — 佩洛伊斯（1551）双形态 hero 头图选用（Female/Male）。
 *
 * 角色详情页 AgentHead（1551 佩洛伊斯）的 hero 头图形态切换钮使用同一状态：
 * 切换即时一致；localStorage 持久化，跨刷新 / 跨页保持用户所选形态。
 * （首页 hero 头图已移除，形态切换钮移至详情页，见 HomeView / AgentHead）
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

/** 全局双形态选择（模块级响应式，localStorage 持久化）。1551 详情页 AgentHead 使用 */
export const heroForm: Ref<HeroForm> = ref(loadHeroForm())

function setHeroForm(v: HeroForm): void {
  heroForm.value = v
  try {
    localStorage.setItem(HERO_FORM_KEY, v)
  } catch {
    // 隐私模式等不可写场景忽略（本次会话内仍生效）
  }
}

export function useHeroForm(): { heroForm: Ref<HeroForm>; toggleHeroForm: () => void } {
  function toggleHeroForm(): void {
    setHeroForm(heroForm.value === 'female' ? 'male' : 'female')
  }
  return { heroForm, toggleHeroForm }
}
