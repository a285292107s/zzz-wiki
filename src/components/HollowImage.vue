<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { normalizeCandidates, type ImageCandidate } from '@/utils/imageSource'

/** 会话级候选失败缓存（模块级单例）：某地址本会话 404 过的，后续挂载直接跳到下一候选。
 *  列表页几十个图标 × 每次进入都重打一遍 404 是纯浪费；会话内不重复尝试。 */
const sessionFailed = new Set<string>()

const props = defineProps<{
  /** 依序尝试的图片候选；全部失败后显示文字占位。
   *  候选可以是单地址字符串，也可以是 `{ src, srcset, sizes }`（同一张图的多个派生档位
   *  交给浏览器按 DPR 选，见 src/utils/imageSource.ts） */
  srcs?: Array<ImageCandidate | null | undefined>
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
  /** 首屏 LCP 图设 high：与逐路由 HTML 的 <link rel=preload as=image> 配合，
   *  让浏览器把这张图排在其它资源之前（详情页头图实测即 LCP 元素） */
  fetchpriority?: 'high' | 'low' | 'auto'
}>()

const candidates = computed(() => {
  const list = normalizeCandidates(props.srcs)
  if (!list.length && props.src) return [{ src: props.src }]
  return list
})

/** 首个未在会话中失败的候选下标；全败过则返回 length（直接耗尽态） */
function firstAliveIdx(): number {
  const list = candidates.value
  const i = list.findIndex((u) => !sessionFailed.has(u.src))
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
  if (cur) sessionFailed.add(cur.src)
  idx.value += 1
}
</script>

<template>
  <!-- 无框模式：img 本体即组件输出（样式/定位完全交给父容器与 img-style）。
       key 用 src：候选换档时重建元素，否则浏览器会复用旧 src 的加载状态 -->
  <img
    v-if="unframed && !exhausted && current"
    :key="current.src"
    :src="current.src"
    :srcset="current.srcset"
    :sizes="current.sizes"
    :alt="alt ?? ''"
    :loading="loading ?? 'lazy'"
    :fetchpriority="fetchpriority"
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
      :key="current.src"
      :src="current.src"
      :srcset="current.srcset"
      :sizes="current.sizes"
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
  /* 走字号令牌（原 0.85rem = 13.6px 越轨：typography-audit 在「候选耗尽、显示占位」
     的页面上会抓到它，例：离线时本地缺的那一枚邦布图标） */
  font-size: var(--fs-small);
  letter-spacing: 0.08em;
  color: var(--ink-3);
  user-select: none;
}

.frame.broken {
  border-style: dashed;
}
</style>