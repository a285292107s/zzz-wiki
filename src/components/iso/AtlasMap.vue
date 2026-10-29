<template>
  <div class="atlas" :class="{ 'is-zoomed': tier !== 'far', 'is-close': tier === 'close' }">
    <div
      ref="viewport"
      class="map"
      :class="{ 'is-dragging': dragging }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @dblclick="onDoubleClick"
    >
      <div class="world" :style="worldStyle">
        <svg
          class="scene"
          :width="layout.width"
          :height="layout.height"
          :viewBox="`0 0 ${layout.width} ${layout.height}`"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <radialGradient id="atlas-light" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#d8a35c" stop-opacity="0.16" />
              <stop offset="55%" stop-color="#d8a35c" stop-opacity="0.05" />
              <stop offset="100%" stop-color="#d8a35c" stop-opacity="0" />
            </radialGradient>
            <linearGradient id="grad-far" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#ffffff" stop-opacity="0.2" />
              <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
            </linearGradient>
            <linearGradient id="grad-near" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#ffffff" stop-opacity="0.34" />
              <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
            </linearGradient>
            <linearGradient id="grad-side-far" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#ffffff" stop-opacity="0.16" />
              <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
            </linearGradient>
            <linearGradient id="grad-side-near" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#ffffff" stop-opacity="0.28" />
              <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
            </linearGradient>
            <linearGradient id="floor-light" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#e8e2d6" stop-opacity="0" />
              <stop offset="62%" stop-color="#e8e2d6" stop-opacity="0.012" />
              <stop offset="100%" stop-color="#e8e2d6" stop-opacity="0.17" />
            </linearGradient>
          </defs>

          <g class="ground">
            <polygon class="floor" :points="layout.ground.top" />
            <polygon class="face floor-front" :points="layout.ground.front" />
            <polyline class="floor-lip" :points="layout.ground.lip" />
          </g>

          <ellipse class="glow" :cx="layout.width / 2" :cy="layout.height * 0.56" :rx="layout.width * 0.62" :ry="layout.height * 0.5" fill="url(#atlas-light)" />

          <g class="terraces">
            <g
              v-for="(terrace, i) in layout.terraces"
              :key="i"
              class="terrace"
              :class="[{ 'is-dim': layer !== null && layer !== i }, terraceStates[i]]"
            >
              <polygon class="face front" :points="terrace.front" />
              <polygon class="deck" :points="terrace.top" />
              <polygon class="face side" :points="terrace.side" />
            </g>
          </g>

          <g class="rails">
            <polygon
              v-for="(rail, i) in rails"
              :key="`rail-${i}`"
              class="face rail"
              :class="{ 'is-dim': layer !== null && layer !== rail.layer }"
              :points="rail.points"
            />
          </g>

          <g class="edges">
            <path
              v-for="(edge, i) in layout.edges"
              :key="i"
              class="edge"
              :class="[`kind-${edge.kind}`, edgeStates[i]]"
              :d="edge.d"
            />
          </g>

          <g class="leaders">
            <line
              v-for="(cube, i) in layout.cubes"
              :key="`l-${cube.id}`"
              class="leader"
              :class="cubeStates[i]"
              :x1="cube.anchor.x"
              :y1="cube.anchor.y"
              :x2="labelPoints[i]?.x ?? cube.label.x"
              :y2="labelPoints[i]?.y ?? cube.label.y"
            />
          </g>

          <g class="cubes">
            <g
              v-for="(cube, i) in layout.cubes"
              :key="cube.id"
              class="cube"
              :class="[cubeStates[i], { 'is-lit': hover === cube.id || selected === cube.id }]"
              @click="pick(cube.id)"
              @pointerenter="hover = cube.id"
              @pointerleave="hover = ''"
            >
              <polygon class="face side" :points="cube.side" />
              <polygon class="shine" :points="cube.side" fill="url(#grad-side-far)" />
              <polygon class="face front" :points="cube.front" />
              <polygon class="shine" :points="cube.front" fill="url(#grad-far)" />
              <template v-if="cube.tower">
                <polygon class="building-side" :points="cube.tower.plinthSide" />
                <polygon class="building-front" :points="cube.tower.plinthFront" />
              </template>
              <polygon class="face roof" :points="cube.roof" />
              <template v-if="cube.tower">
                <polygon class="face tower-side" :points="cube.tower.side" />
                <polygon class="shine" :points="cube.tower.side" fill="url(#grad-side-near)" />
                <polygon class="face tower-front" :points="cube.tower.front" />
                <polygon class="shine" :points="cube.tower.front" fill="url(#grad-near)" />
                <polygon class="face tower-roof" :points="cube.tower.roof" />
                <polygon class="building-side" :points="cube.tower.parapetSide" />
                <polygon class="building-front" :points="cube.tower.parapetFront" />
                <polyline class="ridge" :points="cube.tower.roofLine" />
              </template>
              <polygon
                v-for="(band, index) in floorBands(cube).front"
                :key="`bf-${index}`"
                class="glass-front"
                :class="`band-${index}`"
                :points="band"
              />
              <polygon
                v-for="(band, index) in floorBands(cube).side"
                :key="`bs-${index}`"
                class="glass-side"
                :class="`band-${index}`"
                :points="band"
              />
              <circle class="pin" :cx="cube.roofCenter.x" :cy="cube.roofCenter.y" r="1.8" />
            </g>
          </g>

          <g class="wires">
            <path
              v-for="edge in litEdges"
              :key="`glow-${edge.from}>${edge.to}`"
              class="current-glow"
              :d="edge.d"
            />
            <path
              v-for="edge in litEdges"
              :key="`wire-${edge.from}>${edge.to}`"
              class="wire"
              :d="edge.d"
            />
            <path
              v-for="edge in litEdges"
              :key="`core-${edge.from}>${edge.to}`"
              class="current-core"
              :d="edge.d"
            />
          </g>

          <g class="arrivals">
            <circle
              v-for="edge in litEdges"
              :key="`arr-${edge.from}>${edge.to}`"
              class="arrival"
              :cx="edge.end.x"
              :cy="edge.end.y"
              r="3.4"
            />
            <path
              v-for="edge in litEdges"
              :key="`head-${edge.from}>${edge.to}`"
              class="arrival-head"
              :d="edge.head"
            />
          </g>

          <g class="flags">
            <g
              v-for="(terrace, i) in layout.terraces"
              :key="`flag-${i}`"
              class="flag-pole"
              :class="[{ 'is-dim': layer !== null && layer !== i, 'is-away': journeyIds.size > 0 && !journeyLayers.has(i) }, terraceStates[i]]"
            >
              <polygon class="flag-pad" :points="terrace.flagPad" />
              <line
                :x1="terrace.flagBase.x"
                :y1="terrace.flagBase.y"
                :x2="terrace.flagTop.x"
                :y2="terrace.flagTop.y"
              />
              <circle class="flag-foot" :cx="terrace.flagBase.x" :cy="terrace.flagBase.y" r="1.7" />
              <circle class="flag-finial" :cx="terrace.flagTop.x" :cy="terrace.flagTop.y" r="2" />
            </g>
          </g>

          <g class="selectors">
            <g v-if="selectedCube" class="selector">
              <ellipse class="sel-ring" :cx="selectedCube.dot.x" :cy="selectedCube.bottom.y" :rx="selectedCube.width * 1.5" :ry="selectedCube.width * 0.62" />
              <line
                class="sel-plumb"
                :x1="selectedCube.dot.x"
                :y1="selectedCube.bottom.y"
                :x2="selectedCube.dot.x"
                :y2="selectedCube.dot.y - selectedCube.width * 1.4"
              />
              <line
                class="sel-cap"
                :x1="selectedCube.dot.x - 7"
                :y1="selectedCube.dot.y - selectedCube.width * 1.4"
                :x2="selectedCube.dot.x + 7"
                :y2="selectedCube.dot.y - selectedCube.width * 1.4"
              />
            </g>
            <g v-if="hoverCube && hoverCube.id !== selectedCube?.id" class="hover-mark">
              <polygon class="hover-arrow" :points="hoverArrowPoints" />
            </g>
          </g>
        </svg>

        <span
          v-for="(terrace, i) in layout.terraces"
          :key="`tl-${i}`"
          class="terrace-label"
          :class="[
            { 'is-dim': layer !== null && layer !== i, 'is-away': journeyIds.size > 0 && !journeyLayers.has(i) },
            terraceStates[i],
          ]"
          :style="{ left: `${terrace.flagTop.x}px`, top: `${terrace.flagTop.y + 15}px` }"
          aria-hidden="true"
        >
          <span class="tl-no mono">{{ layers[i]?.no }}</span>
          <span class="tl-zh">{{ layers[i]?.zh }}</span>
          <span v-if="tier !== 'far'" class="tl-en mono">{{ layers[i]?.en }}</span>
        </span>

        <button
          v-for="(cube, i) in layout.cubes"
          :key="`label-${cube.id}`"
          type="button"
          class="node-label"
          :class="cubeStates[i]"
          :style="{ left: `${labelBoxes[cube.id]?.x ?? cube.label.x}px`, top: `${labelBoxes[cube.id]?.y ?? cube.label.y}px` }"
          @pointerenter="hover = cube.id"
          @pointerleave="hover = ''"
          @click="pick(cube.id)"
        >
          <span v-if="journeyIds.has(cube.id)" class="nl-step mono">{{ journeyRank[cube.id] + 1 }}</span>
          <span v-else-if="tier === 'close'" class="nl-no mono">{{ moduleOf(cube.id).no }}</span>
          <span class="nl-zh">{{ moduleOf(cube.id).zh }}</span>
          <span v-if="tier !== 'far'" class="nl-en mono">{{ moduleOf(cube.id).en }}</span>
        </button>
      </div>
    </div>

    <div class="hint mono" aria-hidden="true">拖拽平移 · Ctrl / ⌘ + 滚轮缩放 · 双击放大</div>

    <div class="controls">
      <button type="button" class="ctl" aria-label="缩小" @click="zoomBy(1 / 1.25)">−</button>
      <span class="ctl-read mono">{{ Math.round(scale * 100) }}%</span>
      <button type="button" class="ctl" aria-label="放大" @click="zoomBy(1.25)">+</button>
      <button type="button" class="ctl ctl-wide" @click="fit(true)">适应</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { AtlasEdge, AtlasModule } from '@/domain/atlas'
import { layoutAtlas, type AtlasEdgeShape, type CubeShape } from '@/utils/isoAtlas'

const props = defineProps<{
  modules: readonly AtlasModule[]
  edges: readonly AtlasEdge[]
  layers: readonly { no: string; zh: string; en: string }[]
  selected: string
  kinds: readonly string[]
  layer: number | null
  query: string
  journey: readonly string[]
}>()

const emit = defineEmits<{ select: [id: string] }>()

const viewport = ref<HTMLElement | null>(null)
const hover = ref('')
const scale = ref(1)
const tx = ref(0)
const ty = ref(0)
const dragging = ref(false)
const dirty = ref(false)
let observer: ResizeObserver | null = null
let start = { x: 0, y: 0, tx: 0, ty: 0 }
let moved = 0

const layout = computed(() =>
  layoutAtlas({ modules: props.modules, edges: props.edges, layers: props.layers }),
)

const tier = computed(() => (scale.value < 0.55 ? 'far' : scale.value < 0.9 ? 'mid' : 'close'))

const rails = computed(() =>
  layout.value.terraces.flatMap((terrace, index) =>
    terrace.rails.map((rail) => ({ ...rail, layer: index })),
  ),
)

const moduleById = computed(() => {
  const map: Record<string, AtlasModule> = {}
  for (const module of props.modules) map[module.id] = module
  return map
})

function moduleOf(id: string): AtlasModule {
  return (
    moduleById.value[id] ?? { id, no: '', zh: id, en: '', layer: 0, weight: 1, paths: [], note: '' }
  )
}

const visible = computed(() => {
  const query = props.query.trim().toLowerCase()
  const set = new Set<string>()
  for (const cube of layout.value.cubes) {
    const module = moduleOf(cube.id)
    if (props.layer !== null && module.layer !== props.layer) continue
    if (query) {
      const hay = `${module.zh} ${module.en} ${module.paths.join(' ')} ${module.note}`.toLowerCase()
      if (!hay.includes(query)) continue
    }
    set.add(cube.id)
  }
  return set
})

const activeKinds = computed(() => new Set(props.kinds))

const journeyIds = computed(() => new Set(props.journey))

const journeyEdges = computed(() => {
  const set = new Set<string>()
  const chain = props.journey
  for (let i = 0; i < chain.length - 1; i += 1) set.add(chain[i] + '>' + chain[i + 1])
  return set
})

const journeyLayers = computed(() => {
  const set = new Set<number>()
  for (const id of props.journey) {
    const module = moduleById.value[id]
    if (module) set.add(module.layer)
  }
  return set
})

const journeyRank = computed(() => {
  const map: Record<string, number> = {}
  props.journey.forEach((id, index) => {
    map[id] = index
  })
  return map
})

const focus = computed(() => props.selected || hover.value)

const hoverCube = computed(() => layout.value.cubes.find((cube) => cube.id === hover.value) ?? null)

const selectedCube = computed(
  () => layout.value.cubes.find((cube) => cube.id === props.selected) ?? null,
)

const hoverArrowPoints = computed(() => {
  const cube = hoverCube.value
  if (!cube) return ''
  const tip = cube.dot.y - cube.width * 0.5 - 8
  const half = Math.min(9, Math.max(6, cube.width * 0.14))
  const height = half * 1.9
  return `${cube.dot.x},${tip} ${cube.dot.x - half},${tip - height} ${cube.dot.x + half},${tip - height}`
})

const linkedIds = computed(() => {
  const id = focus.value
  if (!id) return new Set<string>()
  const set = new Set<string>()
  for (const edge of props.edges) {
    if (edge.from === id) set.add(edge.to)
    if (edge.to === id) set.add(edge.from)
  }
  return set
})

const cubeStates = computed(() =>
  layout.value.cubes.map((cube) => ({
    'is-dim':
      !visible.value.has(cube.id) ||
      (journeyIds.value.size > 0
        ? !journeyIds.value.has(cube.id)
        : focus.value !== '' && cube.id !== focus.value && !linkedIds.value.has(cube.id)),
    'is-selected': props.selected === cube.id,
    'is-hover': hover.value === cube.id,
    'is-linked': linkedIds.value.has(cube.id),
  })),
)

function edgeTouches(edge: AtlasEdgeShape, id: string): boolean {
  return edge.from === id || edge.to === id
}

const litEdges = computed(() => {
  if (journeyEdges.value.size > 0) {
    return layout.value.edges.filter(
      (edge) => journeyEdges.value.has(edge.from + '>' + edge.to) && activeKinds.value.has(edge.kind),
    )
  }
  const id = focus.value
  if (!id) return [] as readonly AtlasEdgeShape[]
  return layout.value.edges.filter((edge) => edgeTouches(edge, id) && activeKinds.value.has(edge.kind))
})

const litKeys = computed(() => new Set(litEdges.value.map((edge) => edge.from + '>' + edge.to)))

const edgeStates = computed(() =>
  layout.value.edges.map((edge) => {
    const id = focus.value
    const onJourney = journeyEdges.value.has(edge.from + '>' + edge.to)
    const journeyMode = journeyIds.value.size > 0
    const related = (id !== '' && edgeTouches(edge, id) && activeKinds.value.has(edge.kind)) || onJourney
    return {
      'is-hidden': !activeKinds.value.has(edge.kind) || (journeyMode && !onJourney),
      'is-dim': !visible.value.has(edge.from) || !visible.value.has(edge.to) || (id !== '' && !related),
      'is-muted': id === '' && !journeyMode,
      'is-lifted': litKeys.value.has(edge.from + '>' + edge.to),
    }
  }),
)

const terraceStates = computed(() =>
  layout.value.terraces.map((_, index) => ({
    'is-focus': focus.value !== '' && moduleOf(focus.value).layer === index,
  })),
)

function floorBands(cube: CubeShape): { front: readonly string[]; side: readonly string[] } {
  return { front: cube.bandsFront, side: cube.bandsSide }
}

const labelBoxes = computed(() => {
  const placed: { l: number; r: number; t: number; b: number }[] = []
  const result: Record<string, { x: number; y: number }> = {}
  const fitK = Math.min(1, Math.max(0.6, scale.value * 1.12))
  const lane = layout.value.lane
  const zoomed = scale.value >= 0.9
  const offsets: [number, number][] = []
  for (const du of [0, 18, -18, 36, -36, 54, -54, 72, -72]) {
    for (const row of [0, 1]) {
      offsets.push([
        du * 0.866 + row * lane.x * (zoomed ? 1.5 : 1),
        du * 0.5 + row * lane.y * (zoomed ? 1.5 : 1),
      ])
    }
  }
  for (const cube of layout.value.cubes) {
    const module = moduleOf(cube.id)
    const width = Math.max(module.zh.length * 13 * fitK + 10, zoomed ? module.en.length * 6.6 * fitK + 10 : 0)
    const height = (zoomed ? 30 : 18) * Math.min(1, fitK + 0.18)
    let placedY = cube.label.y
    let placedX = cube.label.x
    for (const [dx, dy] of offsets) {
      const x = cube.label.x + dx
      const y = cube.label.y + dy
      const box = { l: x - width / 2, r: x + width / 2, t: y - height / 2, b: y + height / 2 }
      const hit = placed.some((p) => box.l < p.r - 0.5 && p.l < box.r - 0.5 && box.t < p.b - 0.5 && p.t < box.b - 0.5)
      if (hit) continue
      placed.push(box)
      placedX = x
      placedY = y
      break
    }
    result[cube.id] = { x: placedX, y: placedY }
  }
  return result
})

const labelPoints = computed(() =>
  layout.value.cubes.map((cube) => {
    const box = labelBoxes.value[cube.id] ?? cube.label
    return { x: box.x, y: box.y - 9 }
  }),
)

const worldStyle = computed(() => ({
  transform: `translate(${tx.value}px, ${ty.value}px) scale(${scale.value})`,
  width: `${layout.value.width}px`,
  height: `${layout.value.height}px`,
}))

function fit(markDirty = false): void {
  const el = viewport.value
  if (!el) return
  const w = el.clientWidth
  const h = el.clientHeight
  if (!w || !h) return
  scale.value = Math.min(w / layout.value.width, h / layout.value.height) * 0.97
  tx.value = (w - layout.value.width * scale.value) / 2
  ty.value = (h - layout.value.height * scale.value) / 2
  dirty.value = dirty.value || markDirty
}

function zoomAt(factor: number, px: number, py: number): void {
  const next = Math.min(3, Math.max(0.3, scale.value * factor))
  const wx = (px - tx.value) / scale.value
  const wy = (py - ty.value) / scale.value
  scale.value = next
  tx.value = px - wx * next
  ty.value = py - wy * next
  dirty.value = true
}

function frameOn(ids: readonly string[]): void {
  const el = viewport.value
  if (!el || !ids.length) return
  const boxes = layout.value.cubes.filter((cube) => ids.includes(cube.id))
  if (!boxes.length) return
  const xs: number[] = []
  const ys: number[] = []
  for (const cube of boxes) {
    xs.push(cube.roofCenter.x, cube.bottom.x)
    ys.push(cube.roofCenter.y, cube.bottom.y)
  }
  const engaged = new Set(boxes.map((cube) => cube.layer))
  layout.value.terraces.forEach((terrace, index) => {
    if (!engaged.has(index)) return
    xs.push(terrace.flagTop.x - 150, terrace.flagBase.x)
    ys.push(terrace.flagTop.y, terrace.flagBase.y)
  })
  const minX = Math.min(...xs) - 150
  const maxX = Math.max(...xs) + 150
  const minY = Math.min(...ys) - 150
  const maxY = Math.max(...ys) + 150
  const w = el.clientWidth
  const h = el.clientHeight
  if (!w || !h) return
  const floor = Math.min(w / layout.value.width, h / layout.value.height) * 0.97
  const next = Math.max(
    floor,
    Math.min(1.12, Math.max(0.34, Math.min(w / (maxX - minX), h / (maxY - minY)) * 0.82)),
  )
  scale.value = next
  tx.value = w / 2 - ((minX + maxX) / 2) * next
  ty.value = h / 2 - ((minY + maxY) / 2) * next
  dirty.value = true
}

function zoomBy(factor: number): void {
  const el = viewport.value
  if (!el) return
  zoomAt(factor, el.clientWidth / 2, el.clientHeight / 2)
}

function pick(id: string): void {
  if (moved > 6) return
  emit('select', id)
}

function onPointerDown(event: PointerEvent): void {
  moved = 0
  if ((event.target as Element).closest('button')) return
  dragging.value = true
  start = { x: event.clientX, y: event.clientY, tx: tx.value, ty: ty.value }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent): void {
  if (!dragging.value) return
  const dx = event.clientX - start.x
  const dy = event.clientY - start.y
  moved = Math.max(moved, Math.abs(dx) + Math.abs(dy))
  tx.value = start.tx + dx
  ty.value = start.ty + dy
  dirty.value = true
}

function onPointerUp(event: PointerEvent): void {
  if (!dragging.value) return
  dragging.value = false
  ;(event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId)
}

function onDoubleClick(event: MouseEvent): void {
  const el = viewport.value
  if (!el || (event.target as Element).closest('button')) return
  const rect = el.getBoundingClientRect()
  zoomAt(1.3, event.clientX - rect.left, event.clientY - rect.top)
}

function onWheel(event: WheelEvent): void {
  if (!event.ctrlKey && !event.metaKey) return
  event.preventDefault()
  const el = viewport.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  zoomAt(event.deltaY < 0 ? 1.12 : 1 / 1.12, event.clientX - rect.left, event.clientY - rect.top)
}

watch(
  () => props.journey,
  (chain) => {
    if (chain.length) frameOn(chain)
    else fit()
  },
)

onMounted(() => {
  const el = viewport.value
  if (!el) return
  fit()
  observer = new ResizeObserver(() => {
    if (!dirty.value) fit()
  })
  observer.observe(el)
  el.addEventListener('wheel', onWheel, { passive: false })
})

onBeforeUnmount(() => {
  observer?.disconnect()
  viewport.value?.removeEventListener('wheel', onWheel)
})
</script>

<style scoped>
.atlas {
  position: relative;
}

.map {
  position: relative;
  height: clamp(620px, 86vh, 920px);
  overflow: hidden;
  border: 1px solid var(--line-1);
  border-radius: 2px;
  cursor: grab;
  touch-action: none;
  overscroll-behavior: contain;
  user-select: none;
  -webkit-user-select: none;
  background:
    radial-gradient(120% 90% at 50% 42%, color-mix(in srgb, var(--bg-2) 70%, transparent) 0%, transparent 62%),
    var(--bg-0);
}

.map::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(115% 95% at 50% 46%, transparent 46%, color-mix(in srgb, var(--bg-0) 72%, transparent) 100%);
}

.map.is-dragging {
  cursor: grabbing;
}

.world {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
}

.scene {
  position: absolute;
  top: 0;
  left: 0;
  display: block;
  overflow: visible;
}

.glow {
  opacity: 0.9;
}

.floor {
  fill: url(#floor-light);
}

.floor-front {
  fill: color-mix(in srgb, var(--bg-0) 84%, var(--bg-1));
}

.floor-lip {
  fill: none;
  stroke: color-mix(in srgb, var(--amber) 30%, var(--line-1));
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.face {
  stroke: var(--line-2);
  stroke-width: 1;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.terrace {
  transition: opacity var(--t-med) var(--ease);
}

.terrace .front {
  fill: color-mix(in srgb, var(--bg-1) 78%, var(--bg-2));
}

.terrace .side {
  fill: color-mix(in srgb, var(--bg-0) 86%, var(--bg-2));
}

.deck {
  fill: color-mix(in srgb, var(--bg-2) 55%, var(--bg-3));
  transition: fill var(--t-med) var(--ease);
}

.terrace.is-focus .deck {
  fill: color-mix(in srgb, var(--bg-2) 62%, var(--bg-3));
}

.terrace.is-dim {
  opacity: 0.35;
}

.terrace.is-focus .front {
  fill: color-mix(in srgb, var(--bg-1) 82%, var(--bg-3));
}

.rail {
  fill: var(--bg-1);
  stroke: color-mix(in srgb, var(--line-1) 90%, transparent);
  transition: opacity var(--t-med) var(--ease);
}

.rail.is-dim {
  opacity: 0.35;
}

.flag-pad {
  fill: color-mix(in srgb, var(--bg-2) 52%, var(--bg-3));
  stroke: color-mix(in srgb, var(--amber) 26%, var(--line-1));
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
  transition: opacity var(--t-med) var(--ease);
}

.flag-pole line {
  stroke: color-mix(in srgb, var(--amber) 62%, var(--line-2));
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
  transition: opacity var(--t-med) var(--ease), stroke var(--t-fast) var(--ease);
}

.flag-foot {
  fill: color-mix(in srgb, var(--amber) 55%, transparent);
}

.flag-finial {
  fill: var(--amber-hi);
}

.flag-pole circle {
  transition: opacity var(--t-med) var(--ease);
}

.flag-pole.is-dim {
  opacity: 0.4;
}

.flag-pole.is-away {
  opacity: 0;
}

.flag-pole.is-focus line {
  stroke: var(--amber-hi);
}

.terrace-label {
  position: absolute;
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  gap: 7px;
  padding: 4px 10px 4px 12px;
  pointer-events: none;
  white-space: nowrap;
  transform: translate(-100%, -50%);
  text-align: right;
  background: color-mix(in srgb, var(--bg-1) 92%, var(--amber) 8%);
  border-top: 1px solid color-mix(in srgb, var(--amber) 34%, var(--line-1));
  border-bottom: 1px solid color-mix(in srgb, var(--amber) 34%, var(--line-1));
  clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%, 9px 50%);
  transition: background var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease);
}

.terrace-label::after {
  content: '';
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: color-mix(in srgb, var(--amber) 62%, transparent);
}

.tl-no {
  font-size: var(--fs-badge);
  letter-spacing: 0.08em;
  color: var(--amber);
}

.tl-zh {
  font-family: var(--serif);
  font-size: 13px;
  color: var(--ink-0);
  letter-spacing: 0.06em;
}

.tl-en {
  font-size: var(--fs-nano);
  letter-spacing: 0.16em;
  color: color-mix(in srgb, var(--ink-2) 90%, transparent);
}

.terrace-label.is-dim {
  opacity: 0.42;
}

.terrace-label.is-focus::after {
  background: var(--amber-hi);
}

.terrace-label.is-away {
  opacity: 0;
}

.terrace-label.is-focus {
  border-right-color: var(--amber-hi);
}


.terrace-label.is-focus .tl-no {
  color: var(--amber-hi);
}

.cube {
  cursor: pointer;
  transition: opacity var(--t-med) var(--ease), filter var(--t-med) var(--ease);
}

.cube .face,
.cube .shine,
.cube .building-front,
.cube .building-side,
.cube .glass-front,
.cube .glass-side {
  transition: fill var(--t-fast) var(--ease), stroke var(--t-fast) var(--ease), opacity var(--t-fast) var(--ease);
}

.cube .roof {
  fill: color-mix(in srgb, var(--ink-3) 54%, var(--bg-3));
}

.cube .front {
  fill: color-mix(in srgb, var(--bg-0) 26%, var(--bg-2));
}

.cube .side {
  fill: color-mix(in srgb, var(--bg-0) 60%, var(--bg-2));
}

.cube .tower-front {
  fill: color-mix(in srgb, var(--bg-1) 34%, var(--bg-3));
}

.cube .tower-side {
  fill: color-mix(in srgb, var(--bg-0) 48%, var(--bg-2));
}

.cube .tower-roof {
  fill: color-mix(in srgb, var(--ink-3) 68%, var(--bg-3));
}

.cube .shine {
  opacity: 0;
  transition: opacity var(--t-slow) var(--ease);
}

.cube.is-lit .shine {
  opacity: 1;
}

.building-front {
  fill: color-mix(in srgb, var(--ink-3) 40%, var(--bg-1));
}

.building-side {
  fill: color-mix(in srgb, var(--bg-0) 72%, var(--ink-3));
}

.atlas.is-close .building-front {
  fill: color-mix(in srgb, var(--ink-3) 52%, var(--bg-1));
}

.glass-front,
.glass-side {
  fill: color-mix(in srgb, var(--ink-2) 12%, var(--bg-0));
  stroke: none;
  opacity: 0;
}

.glass-front {
  fill: color-mix(in srgb, var(--ink-2) 18%, var(--bg-1));
}

.cube.is-lit .glass-front,
.cube.is-lit .glass-side {
  opacity: 1;
  fill: color-mix(in srgb, var(--amber) 34%, var(--bg-1));
}

.glass-front.band-0,
.glass-side.band-0 {
  fill: color-mix(in srgb, var(--ink-2) 22%, var(--bg-1));
}

.atlas.is-close .glass-front,
.atlas.is-close .glass-side {
  opacity: 0.55;
}

.atlas.is-close .cube.is-lit .glass-front,
.atlas.is-close .cube.is-lit .glass-side {
  opacity: 1;
}

.ridge {
  fill: none;
  stroke: var(--line-2);
  stroke-width: 1;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.cube.is-dim {
  opacity: 0.22;
}

.cube.is-hover .roof,
.cube.is-selected .roof,
.cube.is-hover .tower-roof,
.cube.is-selected .tower-roof {
  fill: color-mix(in srgb, var(--bg-3) 62%, var(--amber) 38%);
}

.cube.is-hover .face,
.cube.is-selected .face,
.cube.is-hover .building-front,
.cube.is-selected .building-front,
.cube.is-hover .building-side,
.cube.is-selected .building-side {
  stroke: color-mix(in srgb, var(--amber) 62%, var(--line-2));
}

.cube.is-linked .face {
  stroke: color-mix(in srgb, var(--amber) 30%, var(--line-2));
}

.pin {
  fill: var(--ink-2);
}

.cube.is-selected .pin,
.cube.is-hover .pin {
  fill: var(--amber-hi);
}

.selector {
  pointer-events: none;
}

.sel-ring {
  fill: color-mix(in srgb, var(--amber) 8%, transparent);
  stroke: var(--amber);
  stroke-width: 1.2;
  vector-effect: non-scaling-stroke;
  animation: sel-pulse 2.6s var(--ease) infinite;
}

.sel-plumb,
.sel-cap {
  fill: none;
  stroke: color-mix(in srgb, var(--amber) 78%, transparent);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.hover-mark {
  pointer-events: none;
}

.hover-arrow {
  fill: var(--amber-hi);
  transform-box: fill-box;
  transform-origin: 50% 100%;
  animation: hover-bob 1.9s var(--ease) infinite;
}

@keyframes hover-bob {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-3px);
  }
}

@keyframes sel-pulse {
  0%,
  100% {
    opacity: 0.9;
  }
  50% {
    opacity: 0.45;
  }
}

.edge {
  fill: none;
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
  stroke-linecap: round;
  transition: opacity var(--t-med) var(--ease), stroke var(--t-fast) var(--ease), stroke-width var(--t-fast) var(--ease);
}

.kind-assemble {
  stroke: color-mix(in srgb, var(--ink-2) 52%, transparent);
  --edge-muted: 0.46;
}

.kind-load {
  stroke: color-mix(in srgb, var(--amber) 70%, transparent);
  --edge-muted: 0.72;
}

.kind-source {
  stroke: color-mix(in srgb, var(--ink-2) 34%, transparent);
  --edge-muted: 0.5;
}

.kind-build {
  stroke: color-mix(in srgb, var(--ink-0) 34%, transparent);
  stroke-width: 1.6;
  --edge-muted: 0.44;
}

.edge.is-muted {
  opacity: var(--edge-muted, 0.5);
}

.edge.is-hidden {
  opacity: 0;
}

.edge.is-dim {
  opacity: 0.1;
  stroke-dasharray: 1 5;
}

.edge.is-lifted {
  opacity: 0;
}

.wires,
.arrivals {
  pointer-events: none;
}

.wire {
  fill: none;
  stroke: var(--amber-hi);
  stroke-width: 1.4;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
  opacity: 0.82;
}

.current-core,
.current-glow {
  fill: none;
  vector-effect: non-scaling-stroke;
  stroke-linecap: round;
  animation: cable-flow 0.36s linear infinite;
}

.current-core {
  stroke: color-mix(in srgb, var(--amber-hi) 42%, #fff);
  stroke-width: 2.1;
  stroke-dasharray: 2.4 25.6;
}

.current-glow {
  stroke: var(--amber-hi);
  stroke-width: 6;
  stroke-dasharray: 8 20;
  opacity: 0.5;
  filter: blur(3px);
}

@keyframes cable-flow {
  to {
    stroke-dashoffset: -28;
  }
}

.arrival {
  fill: none;
  stroke: var(--amber-hi);
  stroke-width: 1.1;
  vector-effect: non-scaling-stroke;
  opacity: 0.85;
}

.arrival-head {
  fill: none;
  stroke: var(--amber-hi);
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
  opacity: 0.9;
}

@media (prefers-reduced-motion: reduce) {
  .current-core,
  .current-glow {
    animation: none;
  }

  .hover-arrow {
    animation: none;
  }

  .current-core {
    stroke-dasharray: none;
    stroke-width: 1.5;
  }

  .current-glow {
    display: none;
  }
}

.leader {
  stroke: color-mix(in srgb, var(--ink-2) 30%, transparent);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
  transition: stroke var(--t-fast) var(--ease), opacity var(--t-med) var(--ease);
}

.leader.is-dim {
  opacity: 0;
}

.leader.is-hover,
.leader.is-selected,
.leader.is-linked {
  stroke: color-mix(in srgb, var(--amber) 66%, transparent);
}

.node-label {
  position: absolute;
  display: flex;
  flex-direction: column;
  line-height: 1.25;
  align-items: center;
  gap: 1px;
  padding: 1px 3px;
  color: var(--ink-0);
  white-space: nowrap;
  transform: translate(-50%, -50%);
  transition: color var(--t-fast) var(--ease), opacity var(--t-med) var(--ease);
}

.nl-step {
  font-size: 8px;
  letter-spacing: 0.1em;
  color: var(--amber-hi);
  border: 1px solid color-mix(in srgb, var(--amber) 55%, transparent);
  border-radius: 50%;
  width: 12px;
  height: 12px;
  line-height: 10px;
  text-align: center;
}

.nl-no {
  font-size: 8px;
  letter-spacing: 0.12em;
  color: var(--ink-2);
}

.nl-zh {
  font-family: var(--serif);
  font-size: 13px;
  line-height: 1.2;
  color: inherit;
}

.nl-en {
  display: none;
  font-size: 9.5px;
  letter-spacing: 0.16em;
  color: var(--ink-2);
}

.atlas.is-zoomed .nl-en {
  display: block;
}

.atlas.is-zoomed .nl-zh {
  font-size: 13px;
}

.node-label:hover,
.node-label.is-hover,
.node-label.is-selected {
  color: var(--amber-hi);
}

.node-label.is-linked {
  color: var(--ink-0);
}

.node-label.is-dim {
  opacity: 0.2;
}

.hint {
  position: absolute;
  left: 12px;
  bottom: 10px;
  font-size: var(--fs-nano);
  letter-spacing: 0.1em;
  color: var(--ink-2);
  pointer-events: none;
}

.controls {
  position: absolute;
  right: 12px;
  bottom: 10px;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px 4px;
  border: 1px solid var(--line-1);
  border-radius: 2px;
  background: color-mix(in srgb, var(--bg-0) 82%, transparent);
}

.ctl {
  min-width: 24px;
  height: 22px;
  padding: 0 6px;
  font-size: var(--fs-caption);
  color: var(--ink-1);
  border-radius: 1px;
  transition: color var(--t-fast) var(--ease), background var(--t-fast) var(--ease);
}

.ctl:hover {
  color: var(--amber-hi);
  background: var(--amber-dim);
}

.ctl-wide {
  font-size: var(--fs-nano);
  letter-spacing: 0.1em;
}

.ctl-read {
  min-width: 42px;
  font-size: var(--fs-nano);
  color: var(--ink-2);
  text-align: center;
}

@media (max-width: 640px) {
  .map {
    height: clamp(380px, 64vh, 520px);
  }

  .hint {
    display: none;
  }
}
</style>
