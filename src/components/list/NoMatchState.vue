<script setup lang="ts">
/**
 * 「检索/筛选无匹配」空态（名录页共用）：标题 + 出路文案 + 一键清除。
 * 与 AsyncState 分工明确——AsyncState 只管**数据级**为空（源数据没有内容），
 * 本组件只管**条件级**为空（有数据，但被检索/筛选筛光了）。
 *
 * 只负责内容与文案；外框（边线/留白）由调用方按语境给（表格空态行 vs 栅格空态框）。
 * 保留 .empty-title / .empty-clear 类名：全站走查脚本据此定位空态。
 */
withDefaults(
  defineProps<{
    /** 空态标题（如「无匹配音擎」） */
    title: string
    /** 补充说明；缺省用名录页通用句 */
    hint?: string
    /** 是否有可清除的条件（true 才给出「清除」按钮） */
    showClear?: boolean
  }>(),
  { hint: '换个关键词，或清除检索与筛选条件查看全部档案。' },
)

const emit = defineEmits<{ (e: 'clear'): void }>()
</script>

<template>
  <div class="no-match">
    <p class="empty-title mono">{{ title }}</p>
    <p class="empty-hint">{{ hint }}</p>
    <button v-if="showClear" type="button" class="empty-clear mono" @click="emit('clear')">
      清除检索与筛选
    </button>
  </div>
</template>

<style scoped>
.no-match {
  text-align: center;
}

.empty-title {
  font-size: var(--fs-micro);
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--ink-1);
}

.empty-hint {
  margin-top: 10px;
  font-size: var(--fs-caption);
  color: var(--ink-2);
}

.empty-clear {
  margin-top: 18px;
  padding: 7px 14px;
  background: none;
  border: 1px solid var(--line-1);
  border-radius: 2px;
  color: var(--ink-1);
  font-size: var(--fs-caption);
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease);
}

@media (hover: hover) {
  .empty-clear:hover {
    color: var(--amber-hi);
    border-color: var(--amber);
  }
}

.empty-clear:focus-visible {
  outline: 1px solid var(--focus);
  outline-offset: 2px;
}
</style>
