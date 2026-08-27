<script setup lang="ts">
import { computed, ref, watch } from 'vue'

/** 会话级候选失败缓存（模块级单例）：某地址本会话 404 过的，后续挂载直接跳到下一候选。
 *  列表页几十个图标 × 每次进入都重打一遍 404 是纯浪费；会话内不重复尝试。 */
const sessionFailed = new Set<string>()

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
  /** 容器的自撑宽高比（CSS aspect-ratio）。仅当父容器未固定高度（如画像等宽-only 盒子）、需组件按宽推算高时传；
   *  若父容器已定宽高，frame 会自动填满父盒，无需传此值（单一数据源=父样式）。默认 1（方形） */
  ratio?: string | number
  /** 图片适应方式：cover 裁切填充（默认）/ contain 整图等比完整显示（不裁切） */
  fit?: 'cover' | 'contain'
  /** 加载优先级：默认 lazy；首屏大图请显式传 eager（LCP 动机） */
  loading?: 'lazy' | 'eager'
  /** 无框模式：只渲染 <img> 本体（全栏底图 / 标本卡等自带定位容器的场景），
   *  不渲染边框与文字占位——候选耗尽后整体隐藏，由父容器兜底样式接管 */
  unframed?: boolean
  /** 透传到 <img> 的内联样式（构图参数：object-position / transform 等） */
  imgStyle?: Record<string, string>
}>()

const candidates = computed(() => {
  const list = props.srcs?.filter((s): s is string => Boolean(s)) ?? []
  if (!list.length && props.src) return [props.src]
  return list
})

/** 首个未在会话中失败的候选下标；全败过则返回 length（直接耗尽态） */
function firstAliveIdx(): number {
  const list = candidates.value
  const i = list.findIndex((u) => !sessionFailed.has(u))
  return i === -1 ? list.length : i
}

const idx = ref(0)

watch(
  candidates,
  () => {
    idx.value = firstAliveIdx()
  },
  { immediate: true },
)

const current = computed(() => candidates.value[idx.value] ?? null)
/** 是否已耗尽所有候选（显示文字占位；unframed 时隐藏图片本体） */
const exhausted = computed(() => !candidates.value.length || idx.value >= candidates.value.length)

function onError() {
  const cur = current.value
  if (cur) sessionFailed.add(cur)
  idx.value += 1
}
</script>

<template>
  <!-- 无框模式：img 本体即组件输出（样式/定位完全交给父容器与 img-style） -->
  <img
    v-if="unframed && !exhausted && current"
    :key="current"
    :src="current"
    :alt="alt ?? ''"
    :loading="loading ?? 'lazy'"
    decoding="async"
    :style="imgStyle"
    @error="onError"
  />
  <span
    v-else-if="!unframed"
    class="frame"
    :class="{ broken: exhausted }"
    :style="ratio != null ? { 'aspect-ratio': ratio } : undefined"
  >
    <img
      v-if="!exhausted && current"
      :key="current"
      :src="current"
      :alt="alt ?? ''"
      :loading="loading ?? 'lazy'"
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
  /* 默认填满父容器盒子 —— 盒子尺寸只在一处（父样式）定义，避免与 ratio 重复写死。
     父容器高度为 auto 时，百分比高度回退为 auto，退化为下方 aspect-ratio 自撑。 */
  height: 100%;
  /* 无固定父盒（占位/自撑）时的方形兜底；显式 ratio prop 会以内联样式覆盖它 */
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