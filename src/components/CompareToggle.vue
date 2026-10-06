<script setup lang="ts">
/* ============================================================
 * CompareToggle — 详情页的「加入对照」开关
 *
 * 为什么放在这里：对照台需要一个**就地**入口——用户在详情页读到一半想「跟另一个比」，
 * 不该被要求先跳去对照页再找条目。类目与编号直接从当前路由推出（`/agents/1011`），
 * 因此无需给 4 个详情视图逐个传参。
 *
 * 反馈分三种结果，各自给可读提示（role=status 播报）：
 *   added / removed → 常规切换
 *   full            → 对照台已满（3 条），提示先去对照台移出一条
 *   replaced        → 跨类目加入，已重开一桌（语义见 useCompareBench）
 * ============================================================ */
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { MAX_COMPARE } from '@/domain/compare'
import { useCompareBench } from '@/composables/useCompareBench'

const route = useRoute()
const bench = useCompareBench()

/** 当前类目与编号（路由形如 /agents/1011） */
const catPath = computed(() => `/${route.path.split('/').filter(Boolean)[0] ?? ''}`)
const id = computed(() => Number(route.path.split('/').filter(Boolean)[1] ?? ''))
const inBench = computed(() => Number.isFinite(id.value) && bench.has(id.value))
const count = computed(() => bench.count.value)

const note = ref('')
let noteTimer: ReturnType<typeof setTimeout> | null = null
function flash(msg: string) {
  note.value = msg
  if (noteTimer) clearTimeout(noteTimer)
  noteTimer = setTimeout(() => {
    note.value = ''
  }, 3200)
}

function toggle() {
  if (inBench.value) {
    bench.remove(id.value)
    flash('已移出对照')
    return
  }
  const r = bench.add(catPath.value, id.value)
  if (r === 'full') flash(`对照台已满（${MAX_COMPARE} 条）——去对照台移出一条再加`)
  else if (r === 'replaced') flash('已重开一桌（对照只在同类目内进行）')
  else flash('已加入对照')
}
</script>

<template>
  <span class="cmp">
    <button
      type="button"
      class="cmp-btn mono"
      :class="{ on: inBench }"
      :aria-pressed="inBench"
      @click="toggle"
    >
      {{ inBench ? '已加入对照' : '加入对照' }}
      <span v-if="count" class="cmp-count" aria-hidden="true">{{ count }}</span>
    </button>
    <RouterLink v-if="count" class="cmp-link mono" to="/compare">查看对照台 →</RouterLink>
    <span v-if="note" class="cmp-note mono" role="status">{{ note }}</span>
  </span>
</template>

<style scoped>
.cmp {
  display: inline-flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 10px;
}

.cmp-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: 1px solid var(--line-1);
  border-radius: 2px;
  padding: 5px 10px;
  font-size: var(--fs-nano);
  letter-spacing: 0.1em;
  color: var(--ink-2);
  cursor: pointer;
  transition: color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease);
}

.cmp-btn.on {
  color: var(--amber);
  border-color: var(--amber);
}

@media (hover: hover) {
  .cmp-btn:hover {
    color: var(--ink-0);
    border-color: var(--line-2);
  }
  .cmp-btn.on:hover {
    color: var(--amber-hi);
  }
}

.cmp-count {
  font-size: 0.9em;
  opacity: 0.8;
}

.cmp-link {
  font-size: var(--fs-nano);
  letter-spacing: 0.08em;
  color: var(--ink-2);
  border-bottom: 1px solid var(--line-1);
}

@media (hover: hover) {
  .cmp-link:hover {
    color: var(--amber-hi);
    border-color: var(--amber);
  }
}

.cmp-note {
  font-size: var(--fs-nano);
  color: var(--ink-2);
  letter-spacing: 0.06em;
}
</style>
