<script setup lang="ts">
/**
 * 栅格卡片内的一个「块」：上边细线 + 等宽小字标签（可跟一句注记）+ 内容。
 * 驱动盘卡片用它陈列 2/4 件套，音擎卡片用它陈列满级面板与音擎效果——
 * 与页面其它区块同语言：靠 1px 细线分层级，不用底色/圆角/投影。
 */
withDefaults(
  defineProps<{
    /** 块标签（等宽小字，如「2 件套」/「音擎效果」） */
    label: string
    /** prose=正文段落排印（描述文本）；plain=内容自行排印（如数值账目） */
    variant?: 'prose' | 'plain'
  }>(),
  { variant: 'prose' },
)
</script>

<template>
  <!-- div 而非 section：本块是卡内的视觉分块（标签是 span，不构成文档章节），
       且 spacing-audit 的严格门禁按 `section` 选择器收版式级容器——
       组件内部的 10px 光学补偿不该被算作版式节奏（见 spacing-audit 范围界定）。 -->
  <div class="card-block">
    <!-- 标签与注记同处一个行盒（均为行内元素）：行高由块自身的 strut 撑起，
         与抽取前驱动盘卡片上手写的「2 件套 / 4 件套」逐像素一致。
         勿改成 flex —— 会把行盒压到标签自身字号的高度（实测少 8px）。 -->
    <span class="block-lbl mono">{{ label }}</span>
    <span v-if="$slots.note" class="block-note mono"><slot name="note" /></span>
    <div :class="['block-body', `v-${variant}`]">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.card-block {
  border-top: var(--rule);
  padding-top: 10px;
}

/* 卡片底色是 --bg-2（比页面底色亮的档位）：ink-2 在此实测 4.40:1，10px 小字过不了
   4.5:1（axe 实测 400 处命中）；ink-3 只有 2.06:1。故标签与注记一律 ink-1（6.98:1），
   层级交由字号/字距/等宽小字承担，不再靠压暗颜色。 */
.block-lbl {
  font-size: var(--fs-nano);
  letter-spacing: 0.2em;
  color: var(--ink-1);
}

/* 注记：紧跟标签的限定语（满级档位/精炼阶数）；无注记时不渲染 */
.block-note {
  margin-left: 10px;
  font-size: var(--fs-nano);
  letter-spacing: 0.14em;
  color: var(--ink-1);
}

.block-body {
  margin-top: 6px;
}

.block-body.v-prose {
  font-size: var(--fs-caption);
  line-height: 1.7;
  color: var(--ink-1);
  max-width: 46ch;
}
</style>
