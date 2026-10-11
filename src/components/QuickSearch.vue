<script setup lang="ts">
/**
 * QuickSearch — 全局快速检索面板（Ctrl/⌘+K；站头检索钮）。
 * 终端语言：染墨遮罩 + 单一 hairline 框 + 等宽编号陈列；无投影卡片堆叠。
 * 键盘完整可用：↑/↓ 移动、Enter 直达、Esc 关闭；aria-combobox 语义。
 * 结果按类目分组陈列（类目徽标 = catalog no）。空查询只列「最近访问」与检索提示——
 * **不列类目导航**：站头本身就有入口（≥980 主排导航、≤979 ☰ 菜单），面板再列一遍
 * 就是两个入口指同一批目的地。检索面板只做检索，导航归导航。
 */
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { CATALOG } from '@/domain/catalog'
import { highlightSegments } from '@/domain/search'
import { useQuickSearch, useQuickSearchResults, useRecentItems } from '@/composables/useQuickSearch'
import HollowImage from '@/components/HollowImage.vue'

const router = useRouter()
const { phase, query, close } = useQuickSearch()
const { results, overflow } = useQuickSearchResults()
const recent = useRecentItems()

const active = ref(0)
const listEl = ref<HTMLElement | null>(null)
const panelEl = ref<HTMLElement | null>(null)

const visible = computed(() => phase.value === 'open')
const loading = computed(() => phase.value === 'loading')

/** 高亮分段（缓存于条目，避免模板内重复计算） */
const hlCache = computed(() => {
  const map = new Map<string, Array<{ text: string; hit: boolean }>>()
  for (const r of results.value) map.set(r.to, highlightSegments(r.label, query.value))
  return map
})

function segs(label: string, to: string) {
  return hlCache.value.get(to) ?? [{ text: label, hit: false }]
}

/** 类目分组陈列：保持 catalog 顺序。空查询（快速入口态）不分组陈列全部条目——
 *  展示「最近访问 + 提示」，键入后才进入结果态。 */
const groups = computed(() => {
  if (!query.value.trim()) return []
  const byCat = new Map<string, typeof results.value>()
  for (const r of results.value) {
    const arr = byCat.get(r.catPath)
    if (arr) arr.push(r)
    else byCat.set(r.catPath, [r])
  }
  return CATALOG.filter((c) => byCat.has(c.path)).map((c) => ({
    no: c.no,
    label: c.label,
    en: c.en,
    items: byCat.get(c.path)!,
  }))
})

/** 空态「检索范围」说明：只在**无「最近访问」**时出现——那正是面板只剩一行字的时候
 *  （新访客 / 清过缓存的回访）。内容逐条按实测写，不写实际搜不到的字段：
 *    名称 ✓ 四语均可（安比 / Anby / アンビー / 엔비 各命中 2 条）——但界面文字**不逐语罗列**：
 *      「韩」字不在已子集化的 CJK 分片里，写了会让 `pnpm run verify:fonts:cjk` 失败
 *      （实测；补字要重下重切字体，与本改动的目的不成比例），故用「含外文原名」概括。
 *    编号 ✓（1011 → 1 条；14162 → 1 条）
 *    空格分词 AND ✓（「零号 安比」命中，「安比 零号」同）
 *    大小写 / 全角无关 ✓（ANBY、ＡＮＢＹ 同）
 *    ✗ 阵营名（狡兔屋 0 条）、职业名（强攻 0 条）、类目名（代理人 0 条）——
 *      `domain/search.ts` 头部注释曾称索引含阵营名，与实现不符（已就地订正），故此处不列。 */
const scopeRows = [
  { k: '名称', v: '档案名，含外文原名' },
  { k: '编号', v: '如 1011、14162' },
  { k: '多词', v: '空格分隔，需全部命中' },
]

/** 「检索范围」是否显示：只在与「最近访问」二者必居其一时——面板空查询下总有一块内容，
 *  不再出现「只有一行提示语」的空面板。 */
const scopeShown = computed(() => !recent.value.length)

/** 扁平顺序（键盘导航序 = 视觉序） */
const flat = computed(() => groups.value.flatMap((g) => g.items))

/** 可移动项总数（= 脚注能否承诺 ↑↓·ENTER 的依据）。
 *  与 move() 的算法同源：结果态是结果行，空态是最近访问行；两处都空则没有可移动项。
 *  ⚠ 空态判据必须与模板一致用 `!query.trim()`：用 query 真值判断时，输入纯空格会分歧——
 *  模板走空态分支（最近访问行照常渲染），这里却算出 0，于是脚注只剩「ESC」、
 *  方向键静默失效，而鼠标点同一行还能跳（实测）。 */
const movable = computed(
  () => flat.value.length + (query.value.trim() ? 0 : recent.value.length),
)

watch(
  () => query.value,
  () => {
    active.value = 0
    scrollActiveIntoView()
  },
)

/** 唤起元素：关闭时归还焦点（面板可从站头按钮或 Ctrl+K 打开） */
let opener: HTMLElement | null = null

/** 焦点圈定 + Esc 归属：面板是文档级模态（锁滚动、圈定 Tab），故两者都在 document 上。
 *  ⚠ Esc **不能**只挂在输入框上（旧写法）：Tab 走到结果行或 ESC 钮之后 Esc 就失效了——
 *  而 `aria-modal="true"` 的对话框本该随时可 Esc 关闭（实测旧写法下 3 / 4 个焦点位置关不掉）。 */
function onDocKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault()
    close()
    return
  }
  if (e.key !== 'Tab') return
  const panel = panelEl.value
  if (!panel) return
  const focusables = Array.from(
    panel.querySelectorAll<HTMLElement>('input, button:not([disabled]), [href]'),
  ).filter((el) => el.offsetParent !== null)
  if (!focusables.length) return
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  const cur = document.activeElement
  if (e.shiftKey && (cur === first || !panel.contains(cur))) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && (cur === last || !panel.contains(cur))) {
    e.preventDefault()
    first.focus()
  }
}

watch(visible, (v) => {
  if (v) {
    opener = document.activeElement as HTMLElement | null
    document.documentElement.style.overflow = 'hidden'
    document.addEventListener('keydown', onDocKeydown, true)
    void nextTick(() => document.getElementById('quick-search-input')?.focus())
  } else {
    document.documentElement.style.overflow = ''
    document.removeEventListener('keydown', onDocKeydown, true)
    query.value = ''
    active.value = 0
    // 焦点归还：唤起时记录的元素仍在文档中才归还（路由跳转后 opener 已卸载则跳过）
    if (opener && document.contains(opener)) opener.focus()
    opener = null
  }
})

function scrollActiveIntoView(): void {
  void nextTick(() => {
    listEl.value
      ?.querySelector(`[data-idx="${active.value}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  })
}

function move(delta: number): void {
  // 扁平导航序 = [recent(负序，仅空查询时) ...] + results；wrap 环形移动。
  // 总数取 movable（与脚注提示同一处算法），不在这里另算一份
  const nRes = flat.value.length
  const total = movable.value
  if (!total) return
  const pos = active.value < 0 ? nRes + (-1 - active.value) : active.value
  const next = (pos + delta + total) % total
  active.value = next < nRes ? next : -1 - (next - nRes)
  scrollActiveIntoView()
}

function go(): void {
  // 键盘 Enter：负数索引命中 recent 区
  if (active.value < 0) {
    const r = recent.value[-1 - active.value]
    if (r) goRecent(r)
    return
  }
  const target = flat.value[active.value]
  if (!target) return
  close()
  router.push(target.to)
}

/** 最近访问行导航（active 负数索引 = recent 区，键盘与指针同路） */
function goRecent(r: { to: string }): void {
  close()
  router.push(r.to)
}

/** 输入框上的按键：↑↓ 移动、Enter 直达。
 *  Esc 不在这里——它归 onDocKeydown（文档级），否则焦点一离开输入框就关不掉面板。 */
function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    move(1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    move(-1)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    go()
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="qs-scrim" @pointerdown.self="close()">
      <div
        ref="panelEl"
        class="qs-panel"
        role="dialog"
        aria-modal="true"
        aria-label="快速检索"
        aria-controls="quick-search-listbox"
      >
        <div class="qs-bar">
          <span class="mono qs-mark">⌕</span>
          <input
            id="quick-search-input"
            v-model="query"
            type="text"
            class="qs-input"
            placeholder="检索代理人 / 音擎 / 邦布 / 驱动盘…"
            aria-label="检索档案"
            autocomplete="off"
            spellcheck="false"
            @keydown="onKeydown"
          />
          <button type="button" class="qs-esc mono" @click="close()">
        ESC<span class="sr-only">，关闭检索</span>
      </button>
        </div>

        <!-- 命中规模实时提示（aria-live 让辅助技术感知结果集变化） -->
        <p v-if="!loading && query.trim() && results.length" class="qs-count mono" aria-live="polite">
          {{ results.length }} 条档案
        </p>

        <div v-if="loading" class="qs-state mono" role="status">索引构建中…</div>

        <!-- role=listbox 只在**确有 option 子项**时挂：空态下 listbox 没有合法子项，
             会触发 axe aria-required-children（critical）。空态文案改为 role=status 播报。 -->
        <div
          v-else
          id="quick-search-listbox"
          ref="listEl"
          class="qs-list"
          :role="flat.length ? 'listbox' : undefined"
          :aria-label="flat.length ? '检索结果' : undefined"
        >
          <template v-if="flat.length">
            <div v-for="g in groups" :key="g.en" class="qs-group">
              <p class="qs-group-head mono">
                <span class="g-no">{{ g.no }}</span>
                <span class="g-label">{{ g.label }}</span>
                <span class="g-en">{{ g.en }}</span>
              </p>
              <button
                v-for="r in g.items"
                :key="r.to"
                type="button"
                role="option"
                class="qs-row"
                :class="{ on: flat[active]?.to === r.to }"
                :data-idx="flat.indexOf(r)"
                :aria-selected="flat[active]?.to === r.to"
                @pointerenter="active = flat.indexOf(r)"
                @click="go()"
              >
                <span class="qs-ic">
                  <!-- 图标是装饰：名称就在紧邻的 .qs-name 里，重复 alt 会让读屏念两遍
                       （axe image-redundant-alt，交互展开态审计发现） -->
                  <HollowImage :srcs="r.srcs" alt="" :fallback="r.label" fit="contain" />
                </span>
                <span class="qs-name">
                  <template v-for="(s, si) in segs(r.label, r.to)" :key="si">
                    <mark v-if="s.hit" class="qs-hit">{{ s.text }}</mark>
                    <template v-else>{{ s.text }}</template>
                  </template>
                </span>
                <span class="qs-no mono" aria-hidden="true">{{ r.no }}</span>
              </button>
            </div>
          </template>
          <template v-else-if="!query.trim()">
            <div v-if="recent.length" class="qs-group">
              <p class="qs-group-head mono">
                <span class="g-no">↺</span>
                <span class="g-label">最近访问</span>
                <span class="g-en">RECENT</span>
              </p>
              <button
                v-for="(r, ri) in recent"
                :key="r.to"
                type="button"
                class="qs-row"
                :class="{ on: active === -1 - ri }"
                :data-idx="-1 - ri"
                @pointerenter="active = -1 - ri"
                @click="goRecent(r)"
              >
                <span class="qs-ic qs-ic-blank mono">↺</span>
                <span class="qs-name">{{ r.label }}</span>
                <span class="qs-no mono" aria-hidden="true">{{ r.catNo }}</span>
              </button>
            </div>
            <p class="qs-state qs-state-quiet mono" :class="{ 'qs-state-left': scopeShown }">
              输入关键词检索全部档案
            </p>
            <!-- 无「最近访问」时（新访客 / 清过缓存的回访）补一份「检索范围」：
                 面板空查询下总有一块内容，不再出现只挂一行字的空面板。
                 组头与「最近访问 RECENT」同构（.qs-group / .qs-group-head 复用），
                 两块内容在同一套语法里互为替补。有最近访问时不显示——那时面板已有内容，
                 窄屏再多几行会把列表挤到折叠线以下（面板高度有上限）。 -->
            <div v-if="scopeShown" class="qs-group">
              <p class="qs-group-head mono">
                <span class="g-no">⌕</span>
                <span class="g-label">检索范围</span>
                <span class="g-en">SCOPE</span>
              </p>
              <dl class="qs-scope">
                <div v-for="row in scopeRows" :key="row.k" class="qs-scope-row">
                  <dt class="mono">{{ row.k }}</dt>
                  <dd>{{ row.v }}</dd>
                </div>
              </dl>
            </div>
          </template>
          <p v-else-if="!query" class="qs-state mono">输入关键词检索全部档案</p>
          <p v-else class="qs-state mono" role="status">无匹配档案 — 调整关键词再试</p>
        </div>

        <p class="qs-foot mono" aria-hidden="true">
          <!-- 截断提示只在**结果态**出现：空查询时 overflow 按「全部条目」算出 171 条，
               但空态一行结果都没列，提示会变成「共 231 条命中，仅列前 60」而无处对照 -->
          <template v-if="query.trim() && overflow > 0">
            <span class="foot-overflow">共 {{ overflow + results.length }} 条命中，仅列前 {{ results.length }} — 精确关键词</span>
            <span class="sep" aria-hidden="true">·</span>
          </template>
          <!-- 移动/直达提示只在**确有可移动项**时给：空态无最近访问时没有任何一行，
               承诺 ↑↓·ENTER 是空头支票（ESC 仍然有效，故它常驻） -->
          <template v-if="movable > 0">
            <span>↑↓ 移动</span><span class="sep" aria-hidden="true">·</span>
            <span>ENTER 直达</span><span class="sep" aria-hidden="true">·</span>
          </template>
          <span>ESC 关闭</span>
        </p>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.qs-scrim {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  background: color-mix(in srgb, var(--bg-0) 78%, transparent);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: clamp(48px, 12vh, 140px) var(--pad-page) 24px;
}

.qs-panel {
  width: min(640px, 100%);
  background: var(--bg-1);
  background-image: var(--paper-noise);
  border: 1px solid var(--line-2);
  border-radius: 2px;
  box-shadow: var(--shadow-pop);
  display: flex;
  flex-direction: column;
  max-height: min(560px, calc(100vh - 140px));
  overflow: hidden;
}

/* ---------- 输入条 ---------- */

.qs-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: var(--rule);
}

.qs-mark {
  color: var(--amber);
  font-size: var(--fs-lead);
}

.qs-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: var(--ink-0);
  font-size: var(--fs-lead);
  font-family: var(--sans);
  letter-spacing: 0.02em;
  min-width: 0;
}

.qs-input::placeholder {
  color: var(--ink-2);
}

.qs-esc {
  flex: none;
  font-size: var(--fs-nano);
  letter-spacing: 0.14em;
  color: var(--ink-2);
  border: 1px solid var(--line-1);
  border-radius: 2px;
  padding: 3px 7px;
  background: none;
  cursor: pointer;
  transition: color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease);
}

/* 命中规模：检索条下缘的等宽小字，档案终端的「命中 N 条」读数 */
.qs-count {
  padding: 7px 14px 0;
  font-size: var(--fs-nano);
  letter-spacing: 0.2em;
  color: var(--ink-2);
}

@media (hover: hover) {
  .qs-esc:hover {
    color: var(--ink-1);
    border-color: var(--line-2);
  }
}

/* ---------- 结果陈列 ---------- */

.qs-list {
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 6px 0 10px;
}

.qs-group + .qs-group {
  margin-top: 10px;
}

.qs-group-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 8px 14px 5px;
  font-size: var(--fs-nano);
  letter-spacing: 0.18em;
}

.qs-group-head .g-no {
  color: var(--amber);
}

.qs-group-head .g-label {
  color: var(--ink-1);
  letter-spacing: 0.3em;
}

.qs-group-head .g-en {
  color: var(--ink-2);
  letter-spacing: 0.22em;
}

.qs-row {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  padding: 7px 14px;
  border: none;
  background: none;
  color: inherit;
  text-align: left;
  cursor: pointer;
  font: inherit;
}

/* 激活行：bg-3 + 左缘琥珀标线（与名录行/伤害表 hover 同力道） */
.qs-row.on {
  background: var(--bg-3);
}

.qs-row.on .qs-name {
  color: var(--amber-hi);
}

.qs-ic {
  width: 30px;
  height: 30px;
  flex: none;
}

.qs-ic :deep(.frame) {
  border-radius: 2px;
}

.qs-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--fs-md);
  color: var(--ink-0);
  transition: color var(--t-fast) var(--ease);
}

.qs-no {
  flex: none;
  font-size: var(--fs-nano);
  letter-spacing: 0.16em;
  /* ink-2（在 bg-1/bg-2 上 4.87:1）而非 ink-3（2.28:1）：检索序号是可见文本，须过 AA */
  color: var(--ink-2);
}

/* 当前行底色更亮（--bg-3），ink-2 在此仅 ~4.07:1 —— 提到 ink-1（~6.46:1） */
.qs-row.on .qs-no {
  color: var(--ink-1);
}

/* 命中标记：琥珀细线下注（无浏览器默认 mark 黄底），终端「命中高亮」语义 */
mark.qs-hit {
  background: none;
  color: var(--amber-hi);
  border-bottom: 1px solid var(--amber);
  padding: 0 0 1px;
}

/* recent 行的图标占位（无图标资产，等宽符号保持行律） */
.qs-ic-blank {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--line-0);
  border-radius: 2px;
  color: var(--ink-3);
  font-size: var(--fs-caption);
}

.qs-state-quiet {
  padding-top: 18px;
  padding-bottom: 10px;
  color: var(--ink-2);
}

/* 空态提示语：下面若跟着「检索范围」组，提示语就**左对齐**与它成一条轴——
   居中会让它悬在两块内容之间，读起来像两段无关的话。
   没有说明区时（有「最近访问」）它仍是居中收尾的题注。 */
.qs-state-quiet.qs-state-left {
  padding: 14px 14px 8px;
  text-align: left;
}

/* 空态「检索范围」：细线行 + 等宽键名（与「最近访问」组同一套标本语法，无卡片）。
   左列定宽使「名称 / 编号 / 多词」对齐，右列是给玩家看的说明。
   左右内边距与 .qs-group-head 取同一值（14）：键名与组头首元素（⌕ 符号）左缘对齐，
   两块内容读起来是同一条竖线上的两段。 */
.qs-scope {
  margin: 0;
  padding: 0 14px 12px;
}

.qs-scope-row {
  display: flex;
  align-items: baseline;
  gap: var(--space-inline);
  padding: 7px 0;
  border-bottom: 1px solid var(--line-0);
}

/* 末端收口只画一次：末行的下边线归面板脚注那条（.qs-foot 的 border-top） */
.qs-scope-row:last-child {
  border-bottom: none;
}

.qs-scope-row dt {
  flex: none;
  width: 3.2em;
  font-size: var(--fs-nano);
  letter-spacing: 0.24em;
  color: var(--amber);
}

.qs-scope-row dd {
  margin: 0;
  font-size: var(--fs-caption);
  letter-spacing: 0.06em;
  color: var(--ink-2);
}

/* ---------- 状态与脚注 ---------- */

.qs-state {
  padding: 34px 14px;
  text-align: center;
  font-size: var(--fs-caption);
  letter-spacing: 0.18em;
  color: var(--ink-2);
}

.qs-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 8px 14px;
  border-top: var(--rule);
  font-size: var(--fs-nano);
  letter-spacing: 0.16em;
  color: var(--ink-2);
}

.qs-foot .sep {
  color: var(--amber);
}

.foot-overflow {
  color: var(--ink-2);
}

@media (max-width: 640px) {
  .qs-foot {
    display: none;
  }

  .qs-panel {
    max-height: calc(100vh - 120px);
  }
}
</style>
