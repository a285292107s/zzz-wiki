<script setup lang="ts">
import { computed } from 'vue'
import { HIT_TYPES } from '@/domain/enums'
import type { AttrCode, HitCode, SpecCode } from '@/domain/enums'
import type { CharacterDetail } from '@/data/types'
import Tags from '@/components/Tags.vue'
import Rarity from '@/components/Rarity.vue'

const props = defineProps<{
  detail: CharacterDetail
}>()

const attrCode = computed<AttrCode | null>(() => {
  const el = props.detail.element_type
  const key = el ? Object.keys(el)[0] : null
  return key ? (Number(key) as AttrCode) : null
})

/** 特殊属性展示名：有 special_element_type（如 星见雅→烈霜）时优先展示 */
const specialElementName = computed<string | null>(() => {
  const sp = props.detail.special_element_type
  return sp?.name ? String(sp.name) : null
})

const specCode = computed<SpecCode | null>(() => {
  const w = props.detail.weapon_type
  const key = w ? Object.keys(w)[0] : null
  return key ? (Number(key) as SpecCode) : null
})

const hitZh = computed<string | null>(() => {
  const h = props.detail.hit_type
  const key = h ? Object.keys(h)[0] : null
  return key ? (HIT_TYPES[Number(key) as HitCode]?.zh ?? null) : null
})

const codeName = computed(() => props.detail.code_name?.toUpperCase() ?? '')

/** Mindscape 场景图：以角色编号（id）命名的背景立绘，作整栏 hero 底图 */
const heroSrcs = computed(() => [
  `https://static.nanoka.cc/assets/zzz/Mindscape_${props.detail.id}_2.webp`,
])
</script>

<template>
  <header class="ahead">
    <!-- hero 底图：Mindscape_{id}_2.webp 满栏铺底（object-cover 保人物头部），置右微移，留出左侧信息呼吸感 -->
    <span class="hero-bg" aria-hidden="true">
      <img :src="heroSrcs[0]" alt="" loading="lazy" decoding="async" />
    </span>
    <!-- 存档面：底部深掩埋保证文字可读；右上渐淡露出场景，避免整面压黑 -->
    <span class="scrim" aria-hidden="true" />
    <!-- 四角琥珀定位标：档案标本的对位框，非投影非霓虹，纯线框语言 -->
    <span class="marks" aria-hidden="true"><i /><i /><i /><i /></span>

    <div class="file-row">
      <p class="eyebrow">AGENT FILE · NO.{{ String(detail.id ?? '').padStart(4, '0') }}</p>
    </div>

    <div class="main">
      <div class="id-block">
        <p v-if="codeName" class="ghost mono">{{ codeName }}</p>
        <h1 class="page-title">{{ detail.name ?? '—' }}</h1>
        <div class="meta">
          <!-- 稀有度置于标签组首位：与属性/职业并列，避免档案行右侧孤悬 -->
          <Rarity :rank="detail.rarity" />
          <Tags :element="attrCode" :element-label="specialElementName" :specialty="specCode" />
          <span v-if="hitZh" class="tag mono">{{ hitZh }}</span>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.ahead {
  position: relative;
  overflow: hidden;
  /* 与主页 hero 同一横幅图式：不堆超高柱，文字块在曝光区内纵向居中 */
  min-height: clamp(360px, 46vh, 560px);
  background: var(--bg-0); /* 图片缺失/加载前也保有存档底色 */
  margin-bottom: calc(var(--pad-section) * 0.8);
  border-bottom: var(--rule);
}

/* ---------- 底图 ---------- */

.hero-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.hero-bg img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  /* 与主页一致：居中取景，场景横幅完整占据版面 */
  object-position: center;
}

/* ---------- 存档面：与主页同一向纵向曝光｜顶部透出场景，底部深掩埋保障可读 ----------
   色阶统一取 --scrim-*（以 bg-0 为基色），禁止手写 rgba */

.scrim {
  position: absolute;
  inset: 0;
  z-index: 1;
  background:
    linear-gradient(180deg,
      var(--scrim-1) 0%,
      var(--scrim-2) 30%,
      var(--scrim-3) 60%,
      var(--scrim-4) 100%);
  pointer-events: none;
}

/* ---------- 四角定位标（纯线框：无圆角、无发光、无投影） ---------- */

.marks {
  position: absolute;
  inset: 16px;
  z-index: 1;
  pointer-events: none;
}

.marks i {
  position: absolute;
  width: 14px;
  height: 14px;
  border: 0 solid var(--amber);
  opacity: 0.85;
}

.marks i:nth-child(1) { top: 0; left: 0; border-top-width: 1px; border-left-width: 1px; }
.marks i:nth-child(2) { top: 0; right: 0; border-top-width: 1px; border-right-width: 1px; }
.marks i:nth-child(3) { bottom: 0; left: 0; border-bottom-width: 1px; border-left-width: 1px; }
.marks i:nth-child(4) { bottom: 0; right: 0; border-bottom-width: 1px; border-right-width: 1px; }

/* ---------- 档案编号行 ---------- */

.file-row {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  /* 与下方详情区版心同对齐；顶留一份呼吸空间，配合四角定位标内框 */
  padding: 18px var(--pad-page) 15px;
}

/* ---------- 主体：沉底单栏，置于暗面保障可读 ---------- */

.main {
  position: relative;
  z-index: 2;
  /* 纵向上居中：不吃满下缘，与主页 hero 的横幅图式呼应 */
  margin-top: auto;
  margin-bottom: auto;
  padding: clamp(30px, 4vw, 54px) var(--pad-page);
  max-width: 64ch;
}

/* hero 专属标题尺度：比全局 page-title 更果断，字距微收以衬 CID 衬线气质 */
.main .page-title {
  font-size: clamp(34px, 5.6vw, 64px);
  line-height: 1.04;
  letter-spacing: -0.01em;
}

/* 代号作标题上方 kicker：mono + 琥珀细线引导，与顶部 eyebrow 同属档案语言 */
.ghost {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
  font-size: clamp(12px, 1.4vw, 15px);
  font-weight: 400;
  letter-spacing: 0.34em;
  text-transform: uppercase;
  color: var(--amber);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ghost::before {
  content: '';
  flex: none;
  width: 22px;
  height: 1px;
  background: var(--amber);
}

.meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 22px;
}

/* ---------- 移动端：场景面让位，信息沉底更清爽 ---------- */

@media (max-width: 860px) {
  .ahead {
    min-height: clamp(340px, 46vh, 520px);
  }

  .marks {
    inset: 12px;
  }
}
</style>