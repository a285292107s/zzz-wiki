<script setup lang="ts">
import HollowImage from '@/components/HollowImage.vue'

/**
 * 边缘注记式交叉引用（marginalia cross-reference）。
 * 一条档案脚注：上方 hairline 分隔；行内 = mono 眉标 · 衬线名称 · 尾部印记徽章。
 * 通用化：既承载「代理人 → 专属音擎」，也承载「音擎 → 归属代理人」（反向）。
 * 继承既有交互语言：hover 只在名称下方扫过一道琥珀发丝线，其余纹丝不动。
 * 无卡盒、无底、无圆角、无通用箭头徽标。
 */
defineProps<{
  /** 跳转目标（详情路由） */
  to: string
  /** 说明文字眉标（如「专属音擎」/「归属代理人」） */
  label: string
  /** 显示名（如 型号名 / 代理人名） */
  name: string
  /** 印记徽章图标候选链（unframed 无框图） */
  iconSrcs: string[]
  /**
   * 印记徽章形态，按素材原始高宽比定盒（与公告 NameCell 的 thumb 同一约定）：
   * - banner：横幅头像（180×64 ≈ 2.8:1，代理人角色素材），宽扁盒 88×32，contain 完整显示
   * - square：方形图标（400×400，音擎/邦布素材），方盒 40×40，contain 完整显示
   * 默认 square。若把 banner 素材硬塞进方盒会把宽头像压成细条，识别吃力。
   */
  thumb?: 'banner' | 'square'
  /**
   * 无障碍标签：不作为 prop 声明，调用方以 `aria-label` attribute 传入，
   * 经默认 attribute 透传落到根 RouterLink 的 <a> 上（避免 kebab/camel 命名与 vue-tsc 冲突）。
   */
}>()
</script>

<template>
  <RouterLink :to="to" class="signature">
    <span class="sig-label">{{ label }}</span>
    <span class="sig-name serif">{{ name }}</span>
    <span :class="['sig-icon', { banner: thumb === 'banner' }]">
      <HollowImage unframed :srcs="iconSrcs" :alt="name" />
    </span>
  </RouterLink>
</template>

<style scoped>
/* ---------- 边缘注记式交叉引用（与 AgentHead hero / W-Engine head 共用同一套 marginalia 语言） ----------
   不是卡片、不是按钮。一行档案脚注：上方 hairline 分隔，marginalia 式排版 =
   mono 眉标（label）· 衬线名称 · 尾部印记徽章（emblem）。
   反AI味：不画通用箭头、不堆层级；hover 只在名称下方扫过一道琥珀发丝线。 */

.signature {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  margin-top: 26px;
  padding-top: 18px;
  border-top: 1px solid var(--line-1);
  color: var(--ink-0);
  text-decoration: none;
  max-width: 100%;
}

/* mono 眉标：说明文字，小字 + 宽字距 + 上小写，静置一侧 */
.sig-label {
  font-family: var(--mono);
  font-size: var(--fs-micro);
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--ink-2);
  white-space: nowrap;
}

/* 衬线名称：主体，比眉标高一档、色浅一档；hover 时下方扫过一道琥珀发丝线。
   overflow（ellipsis）会剪裁内容盒外的 sub-pixel，故用 padding-bottom 为发丝线留出
   内部空间：::after 落位于 padding 盒内（bottom:0），不会被 overflow 裁掉。
   且过渡只用 transform: scaleX，GPU 友好，不触发 layout/repaint。 */
.sig-name {
  position: relative;
  font-size: var(--fs-lead);
  letter-spacing: 0.02em;
  line-height: 1.2;
  color: var(--ink-0);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-bottom: 5px;
}

.sig-name::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 1px;
  background: var(--amber);
  transform: scaleX(0);
  transform-origin: left center;
  transition: transform var(--t-fast) var(--ease);
}

.signature:hover .sig-name::after {
  transform: scaleX(1);
}

/* 尾部印记徽章：无框图，作注记的落款；尺寸与公告 NameCell 的 thumb 完全对齐（单一事实源）。
   方形（音擎 400²）：40×40 方盒 = 音擎/邦布列表同尺寸；横幅（代理人 180×64 ≈ 2.8:1）：88×32 宽扁盒 = 代理人列表同尺寸，
   contain 完整显示。静置 0.88 透明度，hover 回满。 */
.sig-icon {
  flex: none;
  width: 40px;
  height: 40px;
  opacity: 0.88;
  transition: opacity var(--t-fast) var(--ease);
}

.sig-icon.banner {
  width: 88px;
  height: 32px;
}

.signature:hover .sig-icon {
  opacity: 1;
}

.sig-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
</style>
