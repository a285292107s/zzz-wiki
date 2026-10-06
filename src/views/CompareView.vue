<script setup lang="ts">
/* ============================================================
 * CompareView — 对照台：把同类目条目并排比对
 *
 * 与列表页的分工：列表页负责「找」（筛选/排序/检索），对照台负责「比」（并排看差异）。
 * 数据来源与名录页同源（listFor，api 层已缓存）——**零额外网络**。
 *
 * 状态两个来源，优先级明确：
 *   1) URL `?ids=1011,1021`：可分享的视图（「复制对照链接」生成它）
 *   2) 对照台（localStorage）：用户逐条「加入对照」积累的那一桌
 * 有 `?ids=` 时以 URL 为准（分享链接打开即所见）；两者不一致时把 URL 视为权威并同步回本桌。
 *
 * 无障碍：真 `<table>` + `<caption>` + `scope`；差异不只用颜色（行尾有「差异」文字标记）。
 * ============================================================ */
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { CATALOG, catalogEntry } from '@/domain/catalog'
import { buildComparison, MAX_COMPARE, type CompareEntryInput } from '@/domain/compare'
import { listFor } from '@/data/resources'
import { pickName } from '@/utils/names'
import { iconSources } from '@/data/icons'
import type { IconItem } from '@/data/icons'
import { useCompareBench } from '@/composables/useCompareBench'
import { usePageMeta } from '@/composables/usePageMeta'
import { ListPage } from '@/components'
import HollowImage from '@/components/HollowImage.vue'
import CopyLinkButton from '@/components/CopyLinkButton.vue'

usePageMeta(
  '对照台',
  '把同类目的档案并排放到一起，逐字段看差异——配装与取舍时不必来回翻页。',
)

const route = useRoute()
const router = useRouter()
const bench = useCompareBench()

const rows = ref<Record<string, unknown>[]>([])
const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')

/** 当前对照的类目：URL 未指定时用本桌的类目 */
const catPath = computed(() => bench.catPath.value)
const cat = computed(() => (catPath.value ? catalogEntry(catPath.value) : null))

/** URL 里的 ids（逗号分隔，最多 MAX_COMPARE 条；非法值一律丢弃） */
function parseIds(raw: unknown): number[] {
  if (typeof raw !== 'string') return []
  return raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n))
    .slice(0, MAX_COMPARE)
}

const urlIds = computed(() => parseIds(route.query.ids))

/** 生效的 id 列表：URL 优先，其次本桌 */
const activeIds = computed(() => (urlIds.value.length ? urlIds.value : bench.ids.value))

const entries = computed<CompareEntryInput[]>(() => {
  const path = catPath.value
  if (!path || !rows.value.length) return []
  const list = rows.value
  const byId = new Map(list.map((r) => [Number(r.Id), r]))
  const out: CompareEntryInput[] = []
  for (const id of activeIds.value) {
    const data = byId.get(id)
    if (!data) continue
    out.push({
      id,
      label: pickName(data) || String(id),
      no: String(id).padStart(3, '0'),
      to: `${path}/${id}`,
      srcs: iconSources(data as unknown as IconItem, cat.value?.iconCategory ?? 'character'),
      data,
    })
  }
  return out
})

const model = computed(() => (catPath.value ? buildComparison(catPath.value, entries.value) : null))

/** 未命中的 id（分享链接里可能有过期编号）——如实告知，不静默丢 */
const missingIds = computed(() => activeIds.value.filter((id) => !entries.value.some((e) => e.id === id)))

async function load(path: string) {
  const entry = catalogEntry(path)
  if (!entry) return
  status.value = 'loading'
  try {
    rows.value = await listFor<Record<string, unknown>>(entry)
    status.value = 'ready'
  } catch {
    status.value = 'error'
  }
}

/** URL 里的 ids 是权威视图 → 同步回本桌，保证「加入对照」的累积与所见一致 */
function syncBenchFromUrl() {
  const ids = urlIds.value
  if (!ids.length || !catPath.value) return
  if (ids.join() === bench.ids.value.join()) return
  bench.clear()
  for (const id of ids) bench.add(catPath.value, id)
}

onMounted(() => {
  // URL 里可能带类目（分享链接：?cat=/agents&ids=…）；缺省用本桌类目
  const urlCat = typeof route.query.cat === 'string' && catalogEntry(route.query.cat) ? route.query.cat : null
  if (urlCat && urlCat !== bench.catPath.value) {
    bench.clear()
    bench.add(urlCat, -1) // 占位后立刻移除：只为把类目落到本桌
    bench.remove(-1)
  }
  if (catPath.value) void load(catPath.value)
})

watch(catPath, (p) => {
  if (p) void load(p)
})

watch([urlIds, catPath], syncBenchFromUrl, { immediate: true })

/** 移出：同时从本桌与 URL 视图里去掉（否则刷新会「复活」） */
function removeEntry(id: number) {
  bench.remove(id)
  const next = activeIds.value.filter((x) => x !== id)
  void router.replace({
    query: next.length ? { ...route.query, ids: next.join(',') } : { ...route.query, ids: undefined },
  })
}

function clearAll() {
  bench.clear()
  void router.replace({ query: { ...route.query, ids: undefined } })
}

const emptyHint = computed(() =>
  status.value === 'ready' && !entries.value.length ? '对照台为空' : '',
)
</script>

<template>
  <ListPage>
    <header v-reveal class="page-head">
      <p class="eyebrow mono">Comparison Bench</p>
      <h1 class="page-title">对照台</h1>
      <p class="page-sub">
        把同类目的档案并排放到一起，逐字段看差异——最多 {{ MAX_COMPARE }} 条。
        在任意详情页点「加入对照」即可累积；这张桌子只存在你的浏览器里，
        而「复制对照链接」给出的是可分享的那一份视图。
      </p>
    </header>

    <section v-reveal="80" class="bench" aria-labelledby="bench-title">
      <h2 id="bench-title" class="sr-only">对照结果</h2>

      <!-- 空态：说清楚「怎么开始」，而不是只报空 -->
      <div v-if="!catPath || status === 'idle'" class="bench-empty">
        <p class="bench-empty-title mono">{{ emptyHint || '对照台为空' }}</p>
        <p class="bench-empty-hint">
          对照只在<strong>同类目内</strong>进行（不同类目字段不同）。先挑一个类目：
        </p>
        <ul class="bench-cats">
          <li v-for="c in CATALOG" :key="c.path">
            <RouterLink class="bench-cat" :to="c.path">
              <span class="no mono">{{ c.no }}</span>
              <span class="label">{{ c.label }}</span>
              <span class="en mono">{{ c.en }}</span>
            </RouterLink>
          </li>
        </ul>
        <p class="bench-empty-hint">
          进入任一条目详情后，点页头的「加入对照」；也可以从名录页逐条挑。
        </p>
      </div>

      <p v-else-if="status === 'loading'" class="bench-state mono">载入名录…</p>
      <p v-else-if="status === 'error'" class="bench-state mono">
        名录载入失败。请重新加载页面；若持续失败，稍后再试。
      </p>

      <template v-else-if="entries.length">
        <div class="bench-head">
          <p class="bench-summary mono">
            {{ cat?.label }} · {{ entries.length }} 条 ·
            <span :class="{ diff: (model?.diffCount ?? 0) > 0 }">
              {{ model?.diffCount ?? 0 }} 处差异
            </span>
          </p>
          <div class="bench-actions">
            <CopyLinkButton label="复制对照链接" />
            <button type="button" class="bench-clear mono" @click="clearAll">清空对照台</button>
          </div>
        </div>

        <p v-if="missingIds.length" class="bench-missing mono">
          链接中的 {{ missingIds.join('、') }} 不在名录内（可能已下架），已略过。
        </p>

        <div class="bench-scroll">
          <table class="bench-table">
            <caption class="sr-only">{{ cat?.label }}对照表：列为条目，行为字段，差异行以琥珀标记</caption>
            <thead>
              <tr>
                <th scope="col" class="th-field">字段</th>
                <th v-for="c in model?.columns ?? []" :key="c.id" scope="col" class="th-entry">
                  <span class="entry">
                    <!-- HollowImage 会填满父盒（没有 size 属性）：尺寸必须由父元素给定，
                         否则图标撑满整格、把相邻列的按钮盖住（走查实测「移出」点不到） -->
                    <span v-if="c.srcs.length" class="entry-ic">
                      <HollowImage :srcs="c.srcs" alt="" fit="contain" />
                    </span>
                    <RouterLink class="entry-link" :to="c.to">
                      <span class="entry-name">{{ c.label }}</span>
                      <span class="entry-no mono">NO.{{ c.no }}</span>
                    </RouterLink>
                    <button
                      type="button"
                      class="entry-remove mono"
                      :aria-label="`移出对照：${c.label}`"
                      @click="removeEntry(c.id)"
                    >
                      ×
                    </button>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in model?.rows ?? []" :key="r.label" :class="{ 'is-diff': r.differs }">
                <th scope="row" class="td-field">
                  {{ r.label }}
                  <span v-if="r.differs" class="diff-mark mono" aria-hidden="true">差异</span>
                </th>
                <td v-for="(v, i) in r.cells" :key="i" class="td-cell mono">{{ v }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p class="bench-note">
          差异行以琥珀标记，并在字段名旁标注「差异」——不单靠颜色传达信息。
          同值行保持墨色，把注意力留给真正的差别。
        </p>
      </template>
    </section>
  </ListPage>
</template>

<style scoped>
/* ---------- 空态 ---------- */
.bench-empty {
  border: var(--rule);
  border-radius: 2px;
  padding: 22px 20px;
}

.bench-empty-title {
  font-size: var(--fs-lead);
  color: var(--ink-0);
  letter-spacing: 0.06em;
}

/* 视觉隐藏的区块标题：字号也必须走令牌——浏览器默认 h2 尺寸（22.5px）会越轨，
   而 typography-audit 查的是实际渲染字号，不看是否可见 */
.bench > .sr-only {
  font-size: var(--fs-small);
}

.bench-empty-hint {
  margin-top: 10px;
  font-size: var(--fs-small);
  line-height: 1.9;
  color: var(--ink-1);
}

.bench-cats {
  list-style: none;
  margin: 16px 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0 var(--space-col);
}

.bench-cat {
  display: flex;
  align-items: baseline;
  gap: var(--space-inline);
  padding: 10px 2px;
  border-bottom: 1px solid var(--line-0);
  color: var(--ink-1);
  transition: color var(--t-fast) var(--ease);
}

.bench-cat .no {
  font-size: var(--fs-nano);
  color: var(--amber);
}

.bench-cat .label {
  font-size: var(--fs-small);
}

.bench-cat .en {
  margin-left: auto;
  font-size: var(--fs-nano);
  color: var(--ink-2);
  letter-spacing: 0.1em;
}

@media (hover: hover) {
  .bench-cat:hover {
    color: var(--ink-0);
  }
}

.bench-state {
  padding: 20px 0;
  color: var(--ink-2);
  font-size: var(--fs-small);
}

/* ---------- 对照头 ---------- */
.bench-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-head);
  padding-bottom: 14px;
  border-bottom: 1px solid var(--line-1);
}

.bench-summary {
  font-size: var(--fs-small);
  color: var(--ink-1);
  letter-spacing: 0.06em;
}

.bench-summary .diff {
  color: var(--amber);
}

.bench-actions {
  display: flex;
  align-items: center;
  gap: var(--space-inline);
}

.bench-clear {
  background: none;
  border: 1px solid var(--line-1);
  border-radius: 2px;
  padding: 6px 12px;
  font-size: var(--fs-nano);
  letter-spacing: 0.1em;
  color: var(--ink-2);
  cursor: pointer;
  transition: color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease);
}

@media (hover: hover) {
  .bench-clear:hover {
    color: var(--ink-0);
    border-color: var(--line-2);
  }
}

.bench-missing {
  margin-top: 12px;
  font-size: var(--fs-nano);
  color: var(--ink-2);
}

/* ---------- 对照表 ---------- */
.bench-scroll {
  overflow-x: auto;
  margin-top: 18px;
}

.bench-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 480px;
}

.th-field,
.th-entry {
  text-align: left;
  vertical-align: bottom;
  padding: 0 14px 10px 0;
  border-bottom: 1px solid var(--line-1);
  font-weight: 400;
}

.th-field {
  font-size: var(--fs-nano);
  color: var(--ink-2);
  letter-spacing: 0.12em;
  width: 96px;
}

.entry {
  display: flex;
  align-items: center;
  gap: var(--space-inline);
}

.entry-ic {
  flex: none;
  /* 定尺寸 + 裁切：HollowImage 会填满父盒，尺寸只能由父元素给（见模板注释） */
  width: 36px;
  height: 36px;
  overflow: hidden;
  border: 1px solid var(--line-0);
  border-radius: 2px;
}

.entry-link {
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: var(--ink-0);
}

.entry-name {
  font-size: var(--fs-small);
}

.entry-no {
  font-size: var(--fs-nano);
  color: var(--ink-2);
  letter-spacing: 0.1em;
}

.entry-remove {
  margin-left: auto;
  width: 24px;
  height: 24px;
  line-height: 1;
  background: none;
  border: 1px solid var(--line-1);
  border-radius: 2px;
  color: var(--ink-2);
  cursor: pointer;
  transition: color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease);
}

@media (hover: hover) {
  .entry-remove:hover {
    color: var(--amber);
    border-color: var(--amber);
  }
  .entry-link:hover .entry-name {
    color: var(--amber-hi);
  }
}

.td-field,
.td-cell {
  padding: 12px 14px 12px 0;
  border-bottom: 1px solid var(--line-0);
  text-align: left;
  font-weight: 400;
  vertical-align: baseline;
}

.td-field {
  font-size: var(--fs-small);
  color: var(--ink-1);
}

.td-cell {
  font-size: var(--fs-small);
  color: var(--ink-0);
  letter-spacing: 0.04em;
}

.diff-mark {
  margin-left: 8px;
  font-size: var(--fs-nano);
  color: var(--amber);
  letter-spacing: 0.1em;
}

/* 差异行：字段名与数值转琥珀——配合「差异」文字标记，不单靠颜色 */
.is-diff .td-field,
.is-diff .td-cell {
  color: var(--amber);
}

.bench-note {
  margin-top: 16px;
  font-size: var(--fs-nano);
  line-height: 1.9;
  color: var(--ink-2);
}
</style>
