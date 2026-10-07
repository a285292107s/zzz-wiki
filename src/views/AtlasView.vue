<script setup lang="ts">
/* ============================================================
 * AtlasView — 档案图谱：把「属性 × 职业」的分布摊平成一张可点开的格子表
 *
 * 为什么做这个：名录页能筛、能排，但看不出「分布」——哪些组合是空的、哪个属性偏科、
 * 哪个职业最稀缺。图谱把 60 条代理人压成 7×7 的格子：格子里是条目数，
 * **点任一格就跳到名录并带上对应筛选**（因此它既是可视化，也是导航，不是装饰画）。
 *
 * 语言：沿用「档案标本」——细线格、等宽数字、属性色只作极淡底纹与行首小方块；
 * 空格子用 `·`（装饰层，aria-hidden），并如实说明「源站如此，未补造」。
 * ============================================================ */
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ELEMENTS, PROFESSIONS } from '@/domain/enums'
import type { AttrCode, SpecCode } from '@/domain/enums'
import { catalogEntry } from '@/domain/catalog'
import { listFor } from '@/data/resources'
import { usePageMeta } from '@/composables/usePageMeta'
import { ListPage, DetailSection } from '@/components'

usePageMeta(
  '档案图谱',
  '把代理人档案按「属性 × 职业」摊平成一张格子表——每格是条目数，点开即筛出对应档案。',
)

/** 属性与职业的展示顺序（枚举里的键序即游戏内序号） */
const ATTRS = Object.keys(ELEMENTS).map(Number) as AttrCode[]
const PROFS = Object.keys(PROFESSIONS).map(Number) as SpecCode[]

const rows = ref<Record<string, unknown>[]>([])
const status = ref<'loading' | 'ready' | 'error'>('loading')

onMounted(() => {
  listFor<Record<string, unknown>>(catalogEntry('/agents'))
    .then((r) => {
      rows.value = r
      status.value = 'ready'
    })
    .catch(() => {
      status.value = 'error'
    })
})

/** 计数矩阵 + 行列合计（合计由同一份数据算出，图与账不会打架） */
const matrix = computed(() => {
  const cells: Record<number, Record<number, number>> = {}
  for (const a of ATTRS) {
    cells[a] = {}
    for (const p of PROFS) cells[a][p] = 0
  }
  for (const r of rows.value) {
    const a = Number(r.element)
    const p = Number(r.type)
    if (cells[a] && cells[a][p] !== undefined) cells[a][p] += 1
  }
  const rowTotals = Object.fromEntries(ATTRS.map((a) => [a, PROFS.reduce((n, p) => n + cells[a][p], 0)]))
  const colTotals = Object.fromEntries(PROFS.map((p) => [p, ATTRS.reduce((n, a) => n + cells[a][p], 0)]))
  const total = ATTRS.reduce((n, a) => n + rowTotals[a], 0)
  const max = Math.max(1, ...ATTRS.flatMap((a) => PROFS.map((p) => cells[a][p])))
  return { cells, rowTotals, colTotals, total, max }
})

/** 底纹强度随计数线性递增（上限 22%：保证格内数字仍达 AA，见 color-audit） */
function tint(color: string, n: number): string {
  if (!n) return 'transparent'
  const pct = Math.round(6 + (n / matrix.value.max) * 16)
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`
}
</script>

<template>
  <ListPage>
    <header v-reveal class="page-head">
      <p class="eyebrow mono">Atlas</p>
      <h1 class="page-title">档案图谱</h1>
      <p class="page-sub">
        把代理人档案按<strong>属性 × 职业</strong>摊平成一张格子表——每格是条目数，
        <strong>点开即筛出对应档案</strong>。空格子表示该组合暂无收录，源站如此、未补造。
      </p>
    </header>

    <DetailSection v-reveal id="matrix" no="01" title="属性 × 职业" en="Matrix">
      <p v-if="status === 'loading'" class="atlas-state mono">载入名录…</p>
      <p v-else-if="status === 'error'" class="atlas-state mono">
        名录载入失败。请重新加载页面；若持续失败，稍后再试。
      </p>

      <div v-else class="atlas-scroll">
        <table class="atlas">
          <caption class="sr-only">
            代理人档案的「属性 × 职业」分布：行为属性、列为职业，格内数字为条目数，可点击进入对应筛选
          </caption>
          <thead>
            <tr>
              <th scope="col" class="ax-corner">属性 \ 职业</th>
              <th v-for="p in PROFS" :key="p" scope="col" class="ax-col mono">{{ PROFESSIONS[p].zh }}</th>
              <th scope="col" class="ax-total mono">合计</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in ATTRS" :key="a">
              <th scope="row" class="ax-row">
                <!-- 行首内容放在**内层** flex 容器里：直接把 th 设为 flex 会破坏表格单元格布局，
                     属性名与枚举码会重叠（实测踩过） -->
                <span class="ax-row-inner">
                  <span
                    class="ax-swatch"
                    :style="{ '--ax-swatch': ELEMENTS[a].color }"
                    aria-hidden="true"
                  />
                  <span class="ax-name">{{ ELEMENTS[a].zh }}</span>
                </span>
              </th>
              <td
                v-for="p in PROFS"
                :key="p"
                class="ax-cell"
                :style="{ '--ax-tint': tint(ELEMENTS[a].color, matrix.cells[a][p]) }"
              >
                <RouterLink
                  v-if="matrix.cells[a][p]"
                  class="ax-link mono"
                  :to="{ path: '/agents', query: { attr: String(a), prof: String(p) } }"
                  :aria-label="`${ELEMENTS[a].zh} × ${PROFESSIONS[p].zh}：${matrix.cells[a][p]} 条，进入名录并筛选`"
                >
                  {{ matrix.cells[a][p] }}
                </RouterLink>
                <span v-else class="ax-empty mono" aria-hidden="true">·</span>
              </td>
              <td class="ax-total mono">{{ matrix.rowTotals[a] }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" class="ax-row ax-foot">合计</th>
              <td v-for="p in PROFS" :key="p" class="ax-total mono">{{ matrix.colTotals[p] }}</td>
              <td class="ax-total mono ax-grand">{{ matrix.total }}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p class="atlas-note">
        行列合计由同一份名录算出（图与账同源）。格内数字为可点击链接，键盘
        <kbd class="kbd mono">Tab</kbd> 可逐格走查、回车即进入对应筛选后的名录。
      </p>
    </DetailSection>
  </ListPage>
</template>

<style scoped>
.atlas-state {
  padding: 20px 0;
  font-size: var(--fs-small);
  color: var(--ink-2);
}

.atlas-scroll {
  overflow-x: auto;
}

.atlas {
  border-collapse: collapse;
  width: 100%;
  min-width: 620px;
  /* 固定布局：不固定时表格会把剩余宽度全塞给首列，行首标签与第一格之间留出空档（实测踩过） */
  table-layout: fixed;
}

.atlas th,
.atlas td {
  border-bottom: 1px solid var(--line-0);
  text-align: left;
  font-weight: 400;
  padding: 0;
}

/* 表头：职业列 */
.ax-corner,
.ax-col {
  font-size: var(--fs-nano);
  letter-spacing: 0.12em;
  color: var(--ink-2);
  padding: 0 10px 8px 0;
  border-bottom: 1px solid var(--line-1);
}

.ax-corner {
  width: 140px;
}

.ax-col {
  text-align: center;
  width: 72px;
}

/* 行首：属性小方块 + 名称 + 枚举码（flex 在内层 span 上，th 保持表格单元格语义） */
.ax-row {
  width: 130px;
  padding: 9px 10px 9px 0;
  font-size: var(--fs-small);
  color: var(--ink-0);
  vertical-align: middle;
}

.ax-row-inner {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ax-swatch {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 1px;
  /* 属性色经自定义属性传入（同 .ax-cell 的理由） */
  background: var(--ax-swatch, var(--ink-2));
}

.ax-name {
  min-width: 2.4em;
}

.ax-code {
  margin-left: auto;
  font-size: var(--fs-nano);
  color: var(--ink-2);
  letter-spacing: 0.08em;
}

.ax-cell {
  text-align: center;
  height: 38px;
  /* 数据驱动的底纹经自定义属性传入（不是内联 background）：color-audit 把内联
     color/自定义属性视为数据驱动、内联 background 视为越轨——按它的语义走，
     样式逻辑也留在样式表里 */
  background: var(--ax-tint, transparent);
}

.ax-link {
  display: block;
  padding: 9px 0;
  font-size: var(--fs-small);
  color: var(--ink-0);
  letter-spacing: 0.06em;
  border-radius: 2px;
  transition: background var(--t-fast) var(--ease), color var(--t-fast) var(--ease);
}

@media (hover: hover) {
  .ax-link:hover {
    background: var(--bg-2);
    color: var(--amber-hi);
  }
}

.ax-link:focus-visible {
  outline: 2px solid var(--amber);
  outline-offset: -2px;
}

/* 空格子：装饰层（aria-hidden），用线色即可 */
.ax-empty {
  color: var(--line-2);
}

.ax-total {
  width: 90px;
  font-size: var(--fs-small);
  color: var(--ink-1);
  text-align: center;
  letter-spacing: 0.06em;
  padding: 9px 0;
  border-left: 1px solid var(--line-0);
}

.ax-foot {
  border-bottom: none;
}

.ax-grand {
  color: var(--amber);
}

.atlas-note {
  margin-top: 16px;
  font-size: var(--fs-nano);
  line-height: 1.9;
  color: var(--ink-2);
}
</style>
