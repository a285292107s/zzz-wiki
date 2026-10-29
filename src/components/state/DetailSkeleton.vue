<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'agent' | 'compact'
    rows?: number
    ratio?: string
    wide?: boolean
  }>(),
  { variant: 'agent', rows: 4, ratio: '1 / 1', wide: false },
)
</script>

<template>
  <div v-if="variant === 'compact'" class="detail-skel skel" aria-hidden="true">
    <div class="skel-compact-head">
      <div class="skel-id">
        <span class="bar c-eyebrow" />
        <span class="bar c-title" />
        <span class="bar c-meta" />
        <span class="bar c-sub" />
        <span class="bar c-sub c-sub-short" />
        <span class="bar c-foot" />
      </div>
      <div class="skel-portrait" :class="{ wide }">
        <span class="skel-frame" :style="{ aspectRatio: ratio }">
          <span class="bar skel-fill" />
        </span>
      </div>
    </div>

    <div class="skel-compact-section">
      <div class="skel-head-row">
        <span class="bar no-bar" />
        <span class="bar title-bar" />
      </div>
      <ul class="skel-lines">
        <li v-for="r in rows" :key="r" class="skel-line">
          <span class="bar line-k" />
          <span class="bar line-v" />
        </li>
      </ul>
    </div>

    <div class="skel-compact-section">
      <div class="skel-head-row">
        <span class="bar no-bar" />
        <span class="bar title-bar" />
      </div>
      <ul class="skel-lines">
        <li v-for="r in 2" :key="r" class="skel-line">
          <span class="bar line-k" />
          <span class="bar line-v" />
        </li>
      </ul>
    </div>
  </div>

  <div v-else class="detail-skel skel" aria-hidden="true">
    <div class="skel-head">
      <span class="bar head-line" />
      <span class="bar head-title" />
      <span class="bar head-meta" />
    </div>

    <div class="skel-section">
      <div class="skel-head-row">
        <span class="bar no-bar" />
        <span class="bar title-bar" />
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
  border-bottom: var(--rule);
  background: var(--bg-0);
}

@media (min-width: 1200px) {
  .skel-head {
    aspect-ratio: 2.8;
    min-height: 0;
  }
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
  align-items: center;
  gap: var(--space-head);
  margin-bottom: 28px;
}

.skel-head-row .no-bar {
  width: 18px;
  height: 13px;
}

.skel-head-row .title-bar {
  width: 128px;
  height: 30px;
}

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

.skel-compact-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 40px;
  margin-bottom: calc(var(--pad-section) * 0.8);
}

.skel-id {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.skel-id .c-eyebrow {
  width: 168px;
  height: 12px;
}

.skel-id .c-title {
  width: min(46%, 300px);
  height: 52px;
  margin-top: 18px;
}

.skel-id .c-meta {
  width: 140px;
  height: 20px;
  margin-top: 18px;
}

.skel-id .c-sub {
  width: min(70%, 380px);
  height: 16px;
  margin-top: 14px;
}

.skel-id .c-sub-short {
  width: min(52%, 300px);
  margin-top: 8px;
}

.skel-id .c-foot {
  width: 200px;
  height: 12px;
  margin-top: 16px;
}

.skel-portrait {
  flex: none;
  width: min(280px, 34vw);
}

.skel-portrait.wide {
  width: min(430px, 38vw);
}

.skel-frame {
  display: inline-flex;
  width: 100%;
  border: 1px solid var(--line-0);
  background: var(--bg-1);
  overflow: hidden;
}

.skel-frame .skel-fill {
  display: block;
  width: 100%;
  height: 100%;
}

.skel-compact-section {
  margin-bottom: calc(var(--pad-section) * 0.55);
}

.skel-lines {
  list-style: none;
  border-top: var(--rule);
}

.skel-line {
  display: flex;
  align-items: baseline;
  gap: 14px;
  padding: 12px 0;
  border-bottom: var(--rule);
}

.skel-line .line-k {
  width: 72px;
  height: 12px;
  flex: none;
}

.skel-line .line-v {
  width: 132px;
  height: 16px;
}

@media (max-width: 860px) {
  .skel-head {
    min-height: clamp(340px, 46vh, 520px);
  }

  .skel-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .skel-compact-head {
    flex-direction: column-reverse;
  }

  .skel-id {
    align-self: stretch;
  }

  .skel-portrait {
    width: 56vw;
  }

  .skel-portrait.wide {
    width: min(430px, 84vw);
  }
}
</style>
