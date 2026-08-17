<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  /** 依序尝试的图片候选；全部失败后显示文字占位 */
  srcs?: Array<string | null | undefined>
  /** 兼容单图用法 */
  src?: string | null
  alt?: string
  /** short label rendered while the image is missing/broken */
  fallback?: string
  /** cover 裁切时对齐方向，默认居中；竖长图请用 'top' 保住头部 */
  position?: 'center' | 'top' | 'bottom'
  /** 容器高宽比（CSS aspect-ratio）。默认 1（方形） */
  ratio?: string | number
  /** 图片适应方式：cover 裁切填充（默认）/ contain 整图等比完整显示（不裁切） */
  fit?: 'cover' | 'contain'
}>()

const candidates = computed(() => {
  const list = props.srcs?.filter(Boolean) ?? []
  if (!list.length && props.src) return [props.src]
  return list
})

const idx = ref(0)

watch(
  candidates,
  () => {
    idx.value = 0
  },
)

const current = computed(() => candidates.value[idx.value] ?? null)
/** 是否已耗尽所有候选（显示文字占位） */
const exhausted = computed(() => !candidates.value.length || idx.value >= candidates.value.length)

function onError() {
  idx.value += 1
}
</script>

<template>
  <span
    class="frame"
    :class="{ broken: exhausted }"
    :style="ratio != null ? { 'aspect-ratio': ratio } : undefined"
  >
    <img
      v-if="!exhausted && current"
      :key="current"
      :src="current"
      :alt="alt ?? ''"
      loading="lazy"
      decoding="async"
      :class="[
        fit !== 'contain' ? 'fit-cover' : 'fit-contain',
        { 'pos-top': position === 'top', 'pos-bottom': position === 'bottom' },
      ]"
      @error="onError"
    />
    <span v-else class="ph" aria-hidden="true">
      {{ (fallback && fallback.length ? fallback.slice(0, 2) : '—').toUpperCase() }}
    </span>
  </span>
</template>

<style scoped>
.frame {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 1;
  background: var(--bg-1);
  border: 1px solid var(--line-0);
  overflow: hidden;
  position: relative;
}

.frame img {
  width: 100%;
  height: 100%;
  display: block;
}

.frame img.fit-cover {
  object-fit: cover;
  object-position: center;
}

.frame img.fit-contain {
  object-fit: contain;
  object-position: center;
}

.frame img.pos-top {
  object-position: top center;
}

.frame img.pos-bottom {
  object-position: bottom center;
}

.ph {
  font-family: var(--mono);
  font-size: 0.85rem;
  letter-spacing: 0.08em;
  color: var(--ink-3);
  user-select: none;
}

.frame.broken {
  border-style: dashed;
}
</style>