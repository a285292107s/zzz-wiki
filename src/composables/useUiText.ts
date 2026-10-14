/* ============================================================
 * useUiText — 当前语言的界面文案树（决策记录 0011）。
 *
 * 用法：`const { t } = useUiText()`，模板里直接 `{{ t.list.code }}`。
 * 整棵树按语言替换（不是逐键合并）：每份语言文件都是完整的，缺键在编译期就被挡住了。
 * 语言切换 → `lang` 变 → computed 重算 → 所有读 `t.x` 的模板重新渲染。
 * ============================================================ */

import { computed, type ComputedRef } from 'vue'
import { uiTextFor, type UiText } from '@/domain/uiText'
import { useLocale } from '@/composables/useLocale'

export function useUiText(): { t: ComputedRef<UiText> } {
  const { lang } = useLocale()
  return { t: computed(() => uiTextFor(lang.value)) }
}
