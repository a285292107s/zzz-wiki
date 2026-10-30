<template>
  <ListPage>
    <header v-reveal class="page-head">
      <p class="eyebrow mono">System Atlas</p>
      <h1 class="page-title">项目架构</h1>
      <p class="page-sub">
        站外只有三块——源站接口、素材图库与代码仓库；它们在构建期被同步成「本地产物」，此后页面只读本地。整站按这条链自上而下分成六层，铺成六级台子。
      </p>
    </header>

    <p v-if="lang !== 'zh'" v-reveal="40" class="zh-only" role="note">
      <b class="mono">{{ t.longform.chineseOnly }}</b>
      <span>{{ t.longform.chineseOnlyNote }}</span>
    </p>

    <section v-reveal="60" class="figure" aria-labelledby="h-atlas">
      <div class="fig-head">
        <p class="fig-no mono">地图</p>
        <h2 id="h-atlas" class="fig-title">六层台子</h2>
        <span class="fig-leader" aria-hidden="true" />
        <p class="fig-spec mono">
          {{ ATLAS_LAYERS.length }} 层 · {{ ATLAS_MODULES.length }} 模块 · {{ ATLAS_EDGES.length }} 连线 ·
          {{ ATLAS_KINDS.length }} 类关系
        </p>
        <p class="fig-live mono">{{ versionLabel('LIVE') || 'LIVE ···' }}</p>
      </div>

      <div v-if="wide" class="journeys">
        <p class="journeys-lead mono">跟随一条路</p>
        <div class="journey-list">
          <button
            v-for="journey in ATLAS_JOURNEYS"
            :key="journey.id"
            type="button"
            class="journey"
            :class="{ 'is-on': activeJourney === journey.id }"
            :aria-pressed="activeJourney === journey.id"
            @click="toggleJourney(journey.id)"
          >
            <span class="jr-zh">{{ journey.zh }}</span>
            <span class="jr-en mono">{{ journey.en }}</span>
          </button>
        </div>
        <p v-if="activeJourneyHint" class="journey-hint mono">{{ activeJourneyHint }}</p>
      </div>

      <div class="toolbar">
        <ul v-if="wide" class="legend">
          <li v-for="kind in ATLAS_KINDS" :key="kind.id">
            <button
              type="button"
              class="legend-btn"
              :class="{ 'is-off': !kinds.includes(kind.id) }"
              :aria-pressed="kinds.includes(kind.id)"
              @click="toggleKind(kind.id)"
            >
              <span class="swatch" :class="`sw-${kind.id}`" aria-hidden="true" />
              <span>{{ kind.label }}</span>
              <span class="count mono">{{ kindCount(kind.id) }}</span>
            </button>
          </li>
        </ul>
        <label class="search">
          <span class="sr-only">定位模块</span>
          <input v-model="query" type="search" class="search-input mono" placeholder="定位模块或路径…" />
        </label>
      </div>

      <div class="stage">
        <div class="stage-main">
          <AtlasMap
            v-if="wide"
            :modules="ATLAS_MODULES"
            :edges="ATLAS_EDGES"
            :layer-count="ATLAS_LAYERS.length"
            :layers="ATLAS_LAYERS"
            :selected="selected"
            :kinds="kinds"
            :layer="activeLayer"
            :query="query"
            :journey="journeyChain"
            @select="select"
          />

          <ol v-else class="layer-list">
            <li v-for="(layer, index) in ATLAS_LAYERS" :key="layer.id" class="layer-item">
              <button
                type="button"
                class="layer-head"
                :class="{ 'is-on': activeLayer === index }"
                :aria-pressed="activeLayer === index"
                @click="toggleLayer(index)"
              >
                <span class="lh-no mono">{{ layer.no }}</span>
                <span class="lh-zh">{{ layer.zh }}</span>
                <span class="lh-en mono">{{ layer.en }}</span>
                <span class="lh-count mono">{{ modulesOf(index).length }}</span>
              </button>

              <ul v-if="activeLayer === null || activeLayer === index" class="mod-list">
                <li v-for="module in modulesOf(index)" :key="module.id" class="mod-item">
                  <button
                    type="button"
                    class="mod-row"
                    :class="{ 'is-on': selected === module.id }"
                    :aria-pressed="selected === module.id"
                    @click="select(module.id)"
                  >
                    <span class="mr-no mono">{{ module.no }}</span>
                    <span class="mr-zh">{{ module.zh }}</span>
                    <span class="mr-en mono">{{ module.en }}</span>
                  </button>
                  <AtlasDetail
                    v-if="selected === module.id"
                    :module="module"
                    :layer="layer"
                    :cluster="clusterOf(module)"
                    :floors="floorsOf(module)"
                    :weight="module.weight"
                    :up="upstreamOf(module.id)"
                    :down="downstreamOf(module.id)"
                    :show-back="false"
                    @select="select"
                  />
                </li>
              </ul>
            </li>
          </ol>
        </div>

        <aside v-if="wide" class="panel" aria-live="polite">
          <AtlasDetail
            v-if="wide && current"
            :module="current"
            :layer="currentLayer"
            :cluster="clusterOf(current)"
            :floors="floorsOf(current)"
            :weight="current.weight"
            :up="upstreamOf(current.id)"
            :down="downstreamOf(current.id)"
            :show-back="true"
            @select="select"
            @close="select('')"
          />
          <div v-else class="panel-cols">
            <div class="panel-col">
              <h3 class="panel-sub mono">读图</h3>
              <dl class="read-list">
                <div class="read-row">
                  <dt>宽</dt>
                  <dd>占地多宽，这一组代码的体量就有多少。</dd>
                </div>
                <div class="read-row">
                  <dt>高</dt>
                  <dd>楼层多高，它接进来的依赖线就有多少条。</dd>
                </div>
                <div class="read-row">
                  <dt>台</dt>
                  <dd>站在哪级台子上就是哪一层；核心那层三列并排，因为它们互相引用。</dd>
                </div>
                <div class="read-row">
                  <dt>线</dt>
                  <dd>四类关系用颜色与粗细区分，可以逐类关掉；指上去，线会亮起来朝对方流。</dd>
                </div>
                <div class="read-row">
                  <dt>操作</dt>
                  <dd>拖拽平移、Ctrl / ⌘ + 滚轮缩放、双击放大；「适应」回全图。</dd>
                </div>
              </dl>
            </div>

            <div class="panel-col">
              <h3 class="panel-sub mono">连着最多的</h3>
              <ul class="hubs">
                <li v-for="hub in hubs" :key="hub.id">
                  <button type="button" class="hub-row" @click="select(hub.id)">
                    <span class="hr-zh">{{ hub.zh }}</span>
                    <span class="hr-bar" aria-hidden="true"><span :style="{ width: `${hub.ratio}%` }" /></span>
                    <span class="hr-count mono">{{ hub.degree }}</span>
                  </button>
                </li>
              </ul>
            </div>

            <div class="panel-col">
              <h3 class="panel-sub mono">层分布</h3>
              <ul class="dist">
                <li v-for="(layer, index) in ATLAS_LAYERS" :key="layer.id">
                  <button
                    type="button"
                    class="dist-row"
                    :class="{ 'is-on': activeLayer === index }"
                    :aria-pressed="activeLayer === index"
                    @click="toggleLayer(index)"
                  >
                    <span class="dr-no mono">{{ layer.no }}</span>
                    <span class="dr-zh">{{ layer.zh }}</span>
                    <span class="dr-en mono">{{ layer.en }}</span>
                    <span class="dr-count mono">{{ modulesOf(index).length }}</span>
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </aside>
      </div>

      <p v-if="wide" class="fig-note">
        尺寸是量出来的，不是排出来的：占地看体量、楼层看依赖。所以「界面文案表」是图上最窄的一座，却和路由表一样高——它自己的代码最少，被三十五个组件引用。而这张图是读法图，不是调用图：一条线可能代表几十处 import。
      </p>
    </section>

    <p class="closing">
      本页只讲这楼怎么搭、路怎么走。收录范围、字段缺口与版权归属在
      <RouterLink to="/about" class="ext">数据说明</RouterLink> 里。
    </p>
  </ListPage>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import {
  ATLAS_CLUSTERS,
  ATLAS_EDGES,
  ATLAS_JOURNEYS,
  ATLAS_KINDS,
  ATLAS_LAYERS,
  ATLAS_MODULES,
  type AtlasEdgeKind,
  type AtlasLayer,
  type AtlasModule,
} from '@/domain/atlas'
import { usePageMeta } from '@/composables/usePageMeta'
import { useLocale, useChinesePageLang } from '@/composables/useLocale'
import { useUiText } from '@/composables/useUiText'
import { useDataVersion } from '@/composables/useDataVersion'
import { useMediaQuery } from '@/composables/useMediaQuery'
import { ListPage } from '@/components'
import AtlasDetail from '@/components/iso/AtlasDetail.vue'
import AtlasMap from '@/components/iso/AtlasMap.vue'
import { layoutAtlas } from '@/utils/isoAtlas'

const MODULE_LAYOUT = layoutAtlas({
  modules: ATLAS_MODULES,
  edges: ATLAS_EDGES,
  layers: ATLAS_LAYERS,
})

usePageMeta(
  '项目架构',
  '站外只有源站接口、素材图库与代码仓库三块，构建期同步成本地产物，运行时页面只读本地。整站按这条链分成六层、三十四个模块、五十五条连线的一张等距地图，点开任一格看它的路径与上下游。',
)

const { lang } = useLocale()
const { t } = useUiText()
const { versionLabel } = useDataVersion()
const wide = useMediaQuery('(min-width: 1024px)')

useChinesePageLang()

const selected = ref('')
const query = ref('')
const activeLayer = ref<number | null>(null)
const activeJourney = ref('')

function toggleJourney(id: string): void {
  activeJourney.value = activeJourney.value === id ? '' : id
  const journey = ATLAS_JOURNEYS.find((item) => item.id === activeJourney.value)
  selected.value = journey ? (journey.chain[journey.chain.length - 1] ?? '') : ''
}
const kinds = ref<AtlasEdgeKind[]>(ATLAS_KINDS.map((kind) => kind.id))

const moduleById = computed(() => {
  const map: Record<string, AtlasModule> = {}
  for (const module of ATLAS_MODULES) map[module.id] = module
  return map
})

const clusterNames = computed(() => {
  const map: Record<string, string> = {}
  for (const cluster of ATLAS_CLUSTERS) map[cluster.id] = cluster.zh
  return map
})

function floorsOf(module: AtlasModule): number {
  const degree = ATLAS_EDGES.filter((edge) => edge.from === module.id || edge.to === module.id).length
  return MODULE_LAYOUT.cubes.find((cube) => cube.id === module.id)?.floors ?? degree
}

function clusterOf(module: AtlasModule): string | undefined {
  return module.cluster ? clusterNames.value[module.cluster] : undefined
}

const activeJourneyHint = computed(
  () => ATLAS_JOURNEYS.find((item) => item.id === activeJourney.value)?.hint ?? '',
)

const journeyChain = computed<readonly string[]>(
  () => ATLAS_JOURNEYS.find((item) => item.id === activeJourney.value)?.chain ?? [],
)

const current = computed(() => (selected.value ? (moduleById.value[selected.value] ?? null) : null))
const currentLayer = computed<AtlasLayer>(
  () => ATLAS_LAYERS[current.value?.layer ?? 0] ?? ATLAS_LAYERS[0],
)

function select(id: string): void {
  selected.value = id
  activeJourney.value = ''
}

function modulesOf(layerIndex: number): readonly AtlasModule[] {
  const needle = query.value.trim().toLowerCase()
  return ATLAS_MODULES.filter((module) => {
    if (module.layer !== layerIndex) return false
    if (!needle) return true
    const hay = `${module.zh} ${module.en} ${module.paths.join(' ')} ${module.note}`.toLowerCase()
    return hay.includes(needle)
  })
}

function linked(id: string, direction: 'up' | 'down'): readonly AtlasModule[] {
  const ids = ATLAS_EDGES.filter((edge) =>
    direction === 'up' ? edge.to === id : edge.from === id,
  ).map((edge) => (direction === 'up' ? edge.from : edge.to))
  return [...new Set(ids)]
    .map((source) => moduleById.value[source])
    .filter((module): module is AtlasModule => Boolean(module))
}

function upstreamOf(id: string): readonly AtlasModule[] {
  return linked(id, 'up')
}

function downstreamOf(id: string): readonly AtlasModule[] {
  return linked(id, 'down')
}

function kindCount(kind: AtlasEdgeKind): number {
  return ATLAS_EDGES.filter((edge) => edge.kind === kind).length
}

function toggleKind(kind: AtlasEdgeKind): void {
  const next = kinds.value.includes(kind)
    ? kinds.value.filter((item) => item !== kind)
    : [...kinds.value, kind]
  kinds.value = next.length ? next : [kind]
}

function toggleLayer(index: number): void {
  activeLayer.value = activeLayer.value === index ? null : index
}

const hubs = computed(() => {
  const rows = ATLAS_MODULES.map((module) => ({
    id: module.id,
    zh: module.zh,
    degree: ATLAS_EDGES.filter((edge) => edge.from === module.id || edge.to === module.id).length,
  }))
  rows.sort((a, b) => b.degree - a.degree)
  const top = rows.slice(0, 6)
  const max = top[0]?.degree ?? 1
  return top.map((row) => ({ ...row, ratio: Math.round((row.degree / max) * 100) }))
})
</script>

<style scoped>
.zh-only {
  margin-top: 18px;
  padding: 10px 12px;
  border-left: 2px solid var(--amber);
  background: var(--bg-1);
  font-size: var(--fs-caption);
  line-height: 1.7;
  color: var(--ink-2);
}

.zh-only b {
  display: block;
  color: var(--amber-hi);
  letter-spacing: 0.08em;
}

.figure {
  margin-bottom: var(--space-section);
}

.fig-head {
  display: flex;
  align-items: baseline;
  gap: var(--space-head);
  padding-top: var(--space-group);
  border-top: 1px solid var(--line-1);
}

.fig-no {
  margin: 0;
  font-size: var(--fs-nano);
  letter-spacing: 0.16em;
  color: var(--ink-2);
}

.fig-title {
  margin: 0;
  font-family: var(--serif);
  font-weight: 500;
  font-size: var(--fs-subhead);
  letter-spacing: 0.02em;
  color: var(--ink-0);
}

.fig-leader {
  flex: 1;
  height: 1px;
  border-bottom: 1px dotted color-mix(in srgb, var(--ink-2) 72%, transparent);
}

.fig-spec {
  margin: 0;
  font-size: var(--fs-nano);
  letter-spacing: 0.14em;
  color: var(--ink-2);
  white-space: nowrap;
}

.fig-live {
  margin: 0;
  font-size: var(--fs-nano);
  letter-spacing: 0.16em;
  color: var(--amber);
}

.journeys {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px var(--space-group);
  padding: 10px 0 12px;
  border-bottom: 1px solid var(--line-0);
}

.journeys-lead {
  margin: 0;
  font-size: var(--fs-nano);
  letter-spacing: 0.18em;
  color: var(--ink-2);
}

.journey-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.journey {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 8px;
  padding: 4px 10px;
  border: 1px solid var(--line-1);
  border-radius: 2px;
  text-align: left;
  transition: border-color var(--t-fast) var(--ease), background var(--t-fast) var(--ease);
}

.journey:hover {
  border-color: color-mix(in srgb, var(--amber) 55%, var(--line-1));
}

.journey.is-on {
  border-color: var(--amber);
  background: var(--amber-dim);
}

.jr-zh {
  font-family: var(--serif);
  font-size: var(--fs-small);
  color: var(--ink-0);
}

.jr-en {
  font-size: var(--fs-nano);
  letter-spacing: 0.16em;
  color: var(--ink-2);
}

.journey-hint {
  flex-basis: 100%;
  margin: 2px 0 0;
  font-size: var(--fs-caption);
  letter-spacing: 0.03em;
  color: var(--amber-hi);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px var(--space-group);
  margin: 12px 0;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.legend-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 3px 6px;
  font-size: var(--fs-nano);
  letter-spacing: 0.1em;
  color: var(--ink-1);
  border-radius: 2px;
  transition: color var(--t-fast) var(--ease), opacity var(--t-fast) var(--ease);
}

.legend-btn.is-off {
  opacity: 0.42;
}

.legend-btn:hover {
  color: var(--amber-hi);
}

.swatch {
  width: 20px;
  height: 1px;
  flex: none;
}

.sw-assemble {
  background: color-mix(in srgb, var(--ink-1) 62%, transparent);
}

.sw-load {
  background: color-mix(in srgb, var(--amber) 82%, transparent);
}

.sw-source {
  background: color-mix(in srgb, var(--ink-2) 48%, transparent);
}

.sw-build {
  height: 2px;
  background: color-mix(in srgb, var(--ink-0) 60%, transparent);
}

.count {
  font-size: var(--fs-nano);
  color: var(--ink-2);
}

.search {
  flex: none;
}

.search-input {
  width: 200px;
  padding: 4px 8px;
  font-size: var(--fs-caption);
  color: var(--ink-0);
  background: transparent;
  border: 1px solid var(--line-1);
  border-radius: 2px;
}

.search-input::placeholder {
  color: var(--ink-2);
}

.stage-main {
  min-width: 0;
}

.panel {
  margin-top: var(--space-group);
  padding: 14px 18px 18px;
  border: 1px solid var(--line-1);
  border-radius: 2px;
  background: var(--bg-1);
}

.panel-cols {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr) minmax(0, 1fr);
  gap: 6px 32px;
}

.panel-col {
  border-top: 1px solid var(--line-0);
  padding-top: 12px;
}

.panel-sub {
  margin: 0 0 6px;
  font-weight: 400;
  font-size: var(--fs-nano);
  letter-spacing: 0.18em;
  color: var(--ink-2);
}

.read-list {
  display: grid;
  gap: 6px;
  margin: 0;
}

.read-row {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 10px;
  align-items: baseline;
}

.read-row dt {
  font-size: var(--fs-nano);
  letter-spacing: 0.1em;
  color: var(--ink-2);
}

.read-row dd {
  margin: 0;
  font-size: var(--fs-caption);
  line-height: 1.7;
  color: var(--ink-1);
}

.hubs {
  margin: 0 0 14px;
  padding: 0;
  list-style: none;
}

.hub-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 52px 20px;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 4px 2px;
  text-align: left;
  color: var(--ink-1);
  transition: color var(--t-fast) var(--ease);
}

.hub-row:hover {
  color: var(--amber-hi);
}

.hr-zh {
  font-size: var(--fs-small);
  color: var(--ink-0);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hr-bar {
  height: 4px;
  background: color-mix(in srgb, var(--line-1) 80%, transparent);
}

.hr-bar span {
  display: block;
  height: 100%;
  background: var(--amber);
}

.hr-count {
  font-size: var(--fs-caption);
  color: var(--ink-1);
  text-align: right;
}

.dist {
  margin: 0;
  padding: 0;
  list-style: none;
}

.dist-row {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto auto;
  align-items: baseline;
  gap: 8px;
  width: 100%;
  padding: 5px 2px;
  border-top: 1px solid var(--line-0);
  text-align: left;
  color: var(--ink-1);
  transition: color var(--t-fast) var(--ease);
}

.dist-row:hover,
.dist-row.is-on {
  color: var(--amber-hi);
}

.dr-no {
  font-size: var(--fs-nano);
  color: var(--amber);
}

.dr-zh {
  font-size: var(--fs-small);
  color: var(--ink-0);
}

.dr-en {
  font-size: var(--fs-nano);
  letter-spacing: 0.16em;
  color: var(--ink-2);
}

.dr-count {
  font-size: var(--fs-caption);
  color: var(--ink-1);
}

.layer-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.layer-item {
  border-top: 1px solid var(--line-1);
}

.layer-item:last-child {
  border-bottom: 1px solid var(--line-1);
}

.layer-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  width: 100%;
  padding: 11px 2px;
  text-align: left;
  color: var(--ink-1);
}

.layer-head.is-on {
  color: var(--amber-hi);
}

.lh-no {
  font-size: var(--fs-caption);
  color: var(--amber);
}

.lh-zh {
  font-family: var(--serif);
  font-size: var(--fs-lead);
  color: var(--ink-0);
}

.lh-en {
  font-size: var(--fs-nano);
  letter-spacing: 0.18em;
  color: var(--ink-2);
}

.lh-count {
  margin-left: auto;
  font-size: var(--fs-caption);
  color: var(--ink-1);
}

.mod-list {
  margin: 0 0 10px;
  padding: 0;
  list-style: none;
}

.mod-item {
  padding: 0 0 8px 14px;
  border-top: 1px solid var(--line-0);
}

.mod-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  width: 100%;
  padding: 8px 2px;
  text-align: left;
  color: var(--ink-1);
}

.mod-row.is-on {
  color: var(--amber-hi);
}

.mr-no {
  font-size: var(--fs-nano);
  color: var(--ink-2);
}

.mr-zh {
  font-size: var(--fs-small);
  color: var(--ink-0);
}

.mr-en {
  font-size: var(--fs-badge);
  letter-spacing: 0.16em;
  color: var(--ink-2);
}

.fig-note {
  max-width: 72ch;
  margin: var(--space-group) 0 0;
  font-size: var(--fs-small);
  line-height: 1.85;
  color: var(--ink-2);
}

.closing {
  max-width: 68ch;
  margin: var(--space-group) 0 0;
  font-size: var(--fs-md);
  line-height: 1.95;
  color: var(--ink-1);
}

.ext {
  color: var(--ink-0);
  border-bottom: 1px solid var(--line-1);
  transition: color var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease);
}

@media (hover: hover) {
  .ext:hover {
    color: var(--amber-hi);
    border-color: var(--amber);
  }
}

@media (max-width: 1023px) {
  .panel-cols {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }

  .search {
    flex: 1;
    min-width: 200px;
  }

  .search-input {
    width: 100%;
  }
}

@media (max-width: 520px) {
  .fig-head {
    flex-wrap: wrap;
  }

  .fig-leader,
  .fig-live {
    display: none;
  }

  .fig-spec {
    white-space: normal;
  }
}
</style>
