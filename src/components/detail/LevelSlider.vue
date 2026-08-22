<script setup lang="ts">
/** 等级滑条：发丝线轨道 + 方形钮（与"档案标本"细线框语言一致），
 *  可选突破刻度（marks）。供技能/基础属性等按等级查看数值的区块复用。 */

export interface LevelMark {
  /** 刻度对应的数值（input value） */
  at: number
  /** 刻度下方标注（如 '10' / '60'） */
  label: string
  /** 是否为突破点（琥珀色强调） */
  break?: boolean
}

withDefaults(
  defineProps<{
    modelValue: number
    min?: number
    max?: number
    /** 无障碍标签（如「角色等级」） */
    label: string
    marks?: LevelMark[]
  }>(),
  { min: 1, max: 60, marks: undefined },
)

const emit = defineEmits<{ 'update:modelValue': [number] }>()

function onChange(e: Event) {
  emit('update:modelValue', Number((e.target as HTMLInputElement).value))
}
</script>

<template>
  <div class="level-slider">
    <input
      class="level-range"
      type="range"
      step="1"
      :min="min"
      :max="max"
      :value="modelValue"
      :aria-label="label"
      :aria-valuetext="`等级 ${modelValue}`"
      @input="onChange"
    />
    <div v-if="marks?.length" class="slider-marks" aria-hidden="true">
      <span
        v-for="m in marks"
        :key="m.at"
        class="mark"
        :class="{ 'is-break': m.break }"
      >
        <i class="tick" />
        <b class="mono">{{ m.label }}</b>
      </span>
    </div>
  </div>
</template>

<style scoped>
.level-slider {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* ---------- 滑条本体（与 SkillGroup 同源样式，统一维护于此） ---------- */

.level-range {
  appearance: none;
  -webkit-appearance: none;
  width: 100%;
  margin: 0;
  padding: 6px 0;
  background: transparent;
  cursor: pointer;
  min-width: 0;
}

/* 细线轨道（2px 发丝线），避免原生高亮粗条的视觉侵占 */
.level-range::-webkit-slider-runnable-track {
  height: 2px;
  background: var(--line-2);
  border-radius: 1px;
}
.level-range::-moz-range-track {
  height: 2px;
  background: var(--line-2);
  border-radius: 1px;
}

/* 小方钮：2px 圆角，与"档案标本"的细线框语言一致 */
.level-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 11px;
  height: 11px;
  margin-top: -4.5px;
  background: var(--amber);
  border: 1px solid var(--bg-0);
  border-radius: 2px;
  transition: background var(--t-fast) var(--ease);
}
.level-range::-moz-range-thumb {
  width: 11px;
  height: 11px;
  background: var(--amber);
  border: 1px solid var(--bg-0);
  border-radius: 2px;
  transition: background var(--t-fast) var(--ease);
}
.level-range:hover::-webkit-slider-thumb,
.level-range:active::-webkit-slider-thumb {
  background: var(--amber-hi);
}
.level-range:hover::-moz-range-thumb,
.level-range:active::-moz-range-thumb {
  background: var(--amber-hi);
}
.level-range:hover::-webkit-slider-runnable-track,
.level-range:hover::-moz-range-track {
  background: var(--line-1);
}
.level-range:focus-visible {
  outline: 1px solid var(--amber);
  outline-offset: 4px;
  border-radius: 2px;
}

/* ---------- 突破刻度 ---------- */

.slider-marks {
  display: flex;
  justify-content: space-between;
  padding: 0 5px; /* 与 11px 方钮中心对齐两端刻度 */
}

.mark {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}

.mark .tick {
  width: 1px;
  height: 5px;
  background: var(--line-2);
}

.mark b {
  font-size: var(--fs-badge);
  font-weight: 400;
  letter-spacing: 0.06em;
  color: var(--ink-3);
}

.mark.is-break .tick {
  background: var(--amber);
  height: 7px;
}

.mark.is-break b {
  color: var(--amber);
}
</style>
