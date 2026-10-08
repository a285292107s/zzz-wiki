<script setup lang="ts">
/** DetailSkeleton — 详情页加载骨架（档案标本语言：细线框 + 灰底占位条 + 静默脉冲）。
 *
 *  为什么要有：加载态此前只有一行 `LOADING…`，页面 ~720px 高；数据到达后长到 8000+px，
 *  首屏从「一行字」直接换成「整面封面 + 区块」—— 观感上就是「闪了一下」。
 *  骨架把**首屏的形状先摆出来**（封面带 + 区块标题 + 档案行），内容到达时是「填进去」，
 *  而不是「换一页」。占位条与真值同高（沿用 .skel/.bar 的既有语言），故不产生位移。
 *
 *  仅覆盖首屏：视口外的区块不摆（摆了也看不见，白涨 DOM）。 */
withDefaults(
  defineProps<{
    /** 档案行数（与 .dossier 的 dt/dd 网格同形） */
    rows?: number
  }>(),
  { rows: 4 },
)
</script>

<template>
  <!-- `skel` 必须带上：占位条（.bar）的底色与静默脉冲定义在 base.css 的 `.skel .bar` 下，
       本组件只负责骨架的**形状**（与 CatalogTableSkeleton 同一约定） -->
  <div class="detail-skel skel" aria-hidden="true">
    <!-- 封面带：与 AgentHead 的 .ahead 同高（clamp(360px,46vh,560px)），
         故数据到达时整页构图不变，只是这张带子被真正的封面替换 -->
    <div class="skel-head">
      <span class="bar head-line" />
      <span class="bar head-title" />
      <span class="bar head-meta" />
    </div>

    <div class="skel-section">
      <div class="skel-head-row">
        <span class="bar no-bar" />
        <span class="bar title-bar" />
        <span class="rule-bar" />
      </div>
      <dl class="skel-grid">
        <div v-for="r in rows" :key="r" class="skel-cell">
          <span class="bar k-bar" />
          <span class="bar v-bar" />
        </div>
      </dl>
    </div>
  </div>
</template>

<style scoped>
.detail-skel {
  /* 与详情页内容同栏宽：骨架与真值对齐，替换时不产生横向跳动 */
  padding-bottom: var(--pad-section);
}

.skel-head {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 14px;
  min-height: clamp(360px, 46vh, 560px);
  padding: 0 var(--pad-page);
  /* 与 .ahead 同一条下刻线：构图分界在骨架期就成立 */
  border-bottom: var(--rule);
  background: var(--bg-0);
}

.skel-head .head-line {
  width: 168px;
  height: 12px;
}

.skel-head .head-title {
  width: min(42%, 320px);
  height: 52px;
}

.skel-head .head-meta {
  width: 220px;
  height: 20px;
}

.skel-section {
  padding-top: calc(var(--pad-section) * 0.5);
}

.skel-head-row {
  display: flex;
  align-items: baseline;
  gap: var(--space-head);
  border-top: var(--rule);
  padding-top: 14px;
  margin-bottom: 24px;
}

.skel-head-row .no-bar {
  width: 18px;
  height: 12px;
}

.skel-head-row .title-bar {
  width: 96px;
  height: 22px;
}

.skel-head-row .rule-bar {
  flex: 1;
  height: 1px;
  background: var(--line-0);
}

/* 档案行：与 .dossier 的两列网格同形（dt 标签 + dd 值） */
.skel-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 var(--space-col);
  border-top: var(--rule);
}

.skel-cell {
  display: flex;
  align-items: baseline;
  gap: 14px;
  padding: 12px 0;
  border-bottom: var(--rule);
}

.skel-cell .k-bar {
  width: 64px;
  height: 12px;
  flex: none;
}

.skel-cell .v-bar {
  width: 120px;
  height: 16px;
}

@media (max-width: 860px) {
  .skel-head {
    min-height: clamp(340px, 46vh, 520px);
  }

  .skel-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
