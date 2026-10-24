<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  DEFAULT_FRAMING,
  FRAMING_MODES,
  ZOOM_MAX,
  deriveFraming,
  deriveHeroFraming,
  framingFromRect,
  modeAspect,
  rectFromFraming,
  type CameraRect,
  type Framing,
  type FramingMode,
} from '@/utils/cameraRect'
import type { CalibratedEntry, FeaturedPool, PoolItem } from '@/domain/featuredPool'
import { heroIdsFromList } from '@/domain/heroCatalog'
import { heroImageFile } from '@/data/heroGenderVariants'
import { listFor } from '@/data/resources'
import { catalogEntry } from '@/domain/catalog'
import { DEFAULT_LANG } from '@/domain/lang'
import type { CharacterListItem } from '@/data/types'

/** 开发环境专属校准页：路由仅在 DEV 分支注册（见 router/index.ts），生产构建不可达。 */
const LOCAL_HERO = `${import.meta.env.BASE_URL ?? '/'}data/img/hero`

/** 模式中文副标签（hero 是版式画幅，其余是常规画幅）。 */
const MODE_LABELS: Record<FramingMode, string> = {
  '9:16': '卡片 / 竖屏',
  '3:4': '竖图',
  '1:1': '方图',
  '4:3': '横图',
  '16:9': '宽屏',
  hero: 'hero 画幅',
}

/** 按钮上显示的画幅比例（常规画幅与 mode key 同形；hero 显示版式实际比例）。 */
const MODE_RATIOS: Record<FramingMode, string> = {
  '9:16': '9:16',
  '3:4': '3:4',
  '1:1': '1:1',
  '4:3': '4:3',
  '16:9': '16:9',
  hero: '2.8:1',
}

const heroIds = ref<number[]>([])
const names = ref<Record<number, string>>({})
const pool = ref<FeaturedPool>({ pool: [], calibrated: {} })
const mode = ref<FramingMode>('9:16')
const currentId = ref<number | null>(null)
const params = ref<Framing>({ ...DEFAULT_FRAMING })
const inPool = ref(false)
const derivedNow = ref(false)
const dims = ref({ W: 0, H: 0 })
const dimsMap = ref<Record<number, { W: number; H: number }>>({})
const imgSrc = ref('')
const saving = ref(false)
const msg = ref('改动自动保存')
const panorEl = ref<HTMLDivElement | null>(null)
let saveTimer: number | undefined

const currentSrc = computed(() => imgSrc.value)
const heroSrc = (id: number) => `${LOCAL_HERO}/${heroImageFile(id)}.webp`
const aspect = computed(() => modeAspect(mode.value))
const isWide = computed(() => aspect.value >= 1)
const isHero = computed(() => mode.value === 'hero')

/** 横画幅成品预览的高度上限：预览是参照物，1:1 / 4:3 满列铺开会有近 840×840，
 *  把参数面板与网格挤到屏幕外；限高后按画幅比反推宽度并居中。 */
const PREVIEW_MAX_HEIGHT = 320

const rect = computed<CameraRect | null>(() =>
  dims.value.W ? rectFromFraming(params.value, dims.value.W, dims.value.H, mode.value) : null,
)

/* ---------- 取景框拖动 / 缩放 ---------- */

const dragMode = ref<'move' | 'resize' | null>(null)
const dragStart = ref({ x: 0, y: 0, rect: { cx: 0, cy: 0, w: 0, h: 0 } })

/** 拖框移动：把显示像素增量换算成源图像素，钳进源图后反推参数。 */
function onPointerDown(e: PointerEvent, kind: 'move' | 'resize') {
  const r = rect.value
  if (!r) return
  e.preventDefault()
  dragMode.value = kind
  dragStart.value = { x: e.clientX, y: e.clientY, rect: { ...r } }
  panorEl.value?.setPointerCapture?.(e.pointerId)
}

function toSourceDelta(px: number): number {
  const w = panorEl.value?.clientWidth ?? dims.value.W
  return (dims.value.W / Math.max(w, 1)) * px
}

function onPointerMove(e: PointerEvent) {
  if (!dragMode.value || !rect.value) return
  const { W, H } = dims.value
  const start = dragStart.value.rect
  const dx = toSourceDelta(e.clientX - dragStart.value.x)
  const dy = toSourceDelta(e.clientY - dragStart.value.y)
  let target: CameraRect
  if (dragMode.value === 'move') {
    target = {
      ...start,
      cx: Math.min(Math.max(start.cx + dx, start.w / 2), W - start.w / 2),
      cy: Math.min(Math.max(start.cy + dy, start.h / 2), H - start.h / 2),
    }
  } else {
    const grow = Math.abs(dx) >= Math.abs(dy * aspect.value) ? dx : dy * aspect.value
    const wMin = coverSize(W, H) / ZOOM_MAX
    const w = Math.min(Math.max(start.w + grow, wMin), coverSize(W, H))
    const h = w / aspect.value
    target = {
      cx: Math.min(Math.max(start.cx, w / 2), W - w / 2),
      cy: Math.min(Math.max(start.cy, h / 2), H - h / 2),
      w,
      h,
    }
  }
  params.value = framingFromRect(target, W, H, mode.value)
  scheduleAutosave()
}

/** 当前画幅下「cover 窗口」的宽度（zoom=1 时的取景窗宽度）。 */
function coverSize(W: number, H: number): number {
  if (!W || !H) return 0
  return W / H >= aspect.value ? aspect.value * H : W
}

function onPointerUp(e: PointerEvent) {
  if (dragMode.value) panorEl.value?.releasePointerCapture?.(e.pointerId)
  dragMode.value = null
  window.clearTimeout(saveTimer)
  save()
}

/* ---------- 读盘 / 写盘 ---------- */

async function loadPool() {
  try {
    const res = await fetch('/__calibrate')
    if (res.ok) pool.value = await res.json()
  } catch {
    pool.value = { pool: [], calibrated: {} }
  }
}

function loadImageSize(id: number): Promise<{ W: number; H: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.src = heroSrc(id)
    img.onload = () => resolve({ W: img.naturalWidth, H: img.naturalHeight })
    img.onerror = () => resolve({ W: 0, H: 0 })
  })
}

/** 未校准角色进入 9:16 时给一个内容包围盒起点（与旧版 autoInit 同一启发式）。 */
async function autoInit(id: number): Promise<Framing> {
  const size = dimsMap.value[id] ?? (await loadImageSize(id))
  if (!size.W) return { ...DEFAULT_FRAMING }
  try {
    const img = new Image()
    img.src = heroSrc(id)
    await new Promise<void>((r) => {
      img.onload = () => r()
      img.onerror = () => r()
    })
    const c = document.createElement('canvas')
    c.width = size.W
    c.height = size.H
    const ctx = c.getContext('2d')
    if (!ctx) return { ...DEFAULT_FRAMING }
    ctx.drawImage(img, 0, 0, size.W, size.H)
    const d = ctx.getImageData(0, 0, size.W, size.H).data
    let top = -1
    let bot = -1
    const step = Math.max(1, Math.floor(size.W / 120))
    for (let y = 0; y < size.H; y++) {
      for (let x = 0; x < size.W; x += step) {
        if (d[(y * size.W + x) * 4 + 3] >= 16) {
          if (top < 0) top = y
          bot = y
          break
        }
      }
    }
    if (top < 0) return { ...DEFAULT_FRAMING }
    const ch = bot - top + 1
    const zoom = Math.min(Math.max(size.H / ch, 1), 1.7)
    const originY = Math.round((top / (top + (size.H - bot))) * 1000) / 10
    return { pos: '50%', posY: '50%', zoom, originY }
  } catch {
    return { ...DEFAULT_FRAMING }
  }
}

/** 9:16 母版取景（显式存了就有；没有就按内容包围盒给起点）。 */
async function masterFraming(id: number): Promise<Framing | null> {
  const explicit = pool.value.calibrated[String(id)]?.modes?.['9:16']
  return explicit ?? (await autoInit(id))
}

/** 任意画幅取景：显式校准优先；否则由 9:16 母版派生（hero 画幅用只平移的派生）。 */
async function framingFor(id: number, m: FramingMode): Promise<{ framing: Framing; derived: boolean }> {
  const explicit = pool.value.calibrated[String(id)]?.modes?.[m]
  if (explicit) return { framing: { ...explicit }, derived: false }
  const size = dimsMap.value[id] ?? (await loadImageSize(id))
  if (!size.W) return { framing: { ...DEFAULT_FRAMING }, derived: true }
  const master = await masterFraming(id)
  if (!master) return { framing: { ...DEFAULT_FRAMING }, derived: true }
  const mrect = rectFromFraming(master, size.W, size.H, '9:16')
  const framing =
    m === 'hero' ? deriveHeroFraming(mrect, size.W, size.H) : deriveFraming(mrect, size.W, size.H, m)
  return { framing, derived: true }
}

async function selectId(id: number) {
  if (currentId.value === id) return
  currentId.value = id
  const size = dimsMap.value[id] ?? (await loadImageSize(id))
  dimsMap.value = { ...dimsMap.value, [id]: size }
  if (currentId.value !== id) return
  dims.value = size
  const { framing, derived } = await framingFor(id, mode.value)
  if (currentId.value !== id) return
  params.value = framing
  derivedNow.value = derived
  inPool.value = pool.value.calibrated[String(id)]?.inPool ?? false
  imgSrc.value = heroSrc(id)
  msg.value = '改动自动保存'
}

/** 切换画幅：不换图，只换当前图在该画幅下的取景。 */
async function selectMode(m: FramingMode) {
  if (mode.value === m) return
  mode.value = m
  const id = currentId.value
  if (id == null) return
  const { framing, derived } = await framingFor(id, m)
  if (currentId.value !== id || mode.value !== m) return
  params.value = framing
  derivedNow.value = derived
  msg.value = '改动自动保存'
}

function setInPool(v: boolean) {
  inPool.value = v
  scheduleAutosave()
}

/** 网格里逐图切换「入池」（仅 9:16 模式下出现）：未校准角色先选中再校准。 */
function togglePool(id: number) {
  if (id === currentId.value) {
    setInPool(!inPool.value)
    return
  }
  const key = String(id)
  const entry = pool.value.calibrated[key]
  if (!entry) return
  queueWrite((cal) => ({ ...cal, [key]: { ...entry, inPool: !entry.inPool } }))
}

/** 由 calibrated 派生 pool 数组（入池 = inPool，取景取 9:16 母版）。 */
function derivePool(cal: Record<string, CalibratedEntry>): PoolItem[] {
  return Object.entries(cal)
    .filter(([, e]) => e.inPool && e.modes['9:16'])
    .map(([k, e]) => {
      const f = e.modes['9:16']!
      return { id: Number(k), pos: f.pos, zoom: f.zoom, originY: f.originY }
    })
    .sort((a, b) => a.id - b.id)
}

/** 写盘：串行化（队列 + 单飞）。每次写从**当前** pool.value 计算目标再 PUT，杜绝并发 PUT 互相覆盖丢改动。 */
let writing = Promise.resolve()
let pendingWrites = 0

function queueWrite(mutate: (cal: Record<string, CalibratedEntry>) => Record<string, CalibratedEntry>) {
  pendingWrites++
  writing = writing
    .then(async () => {
      saving.value = true
      const calibrated = mutate(pool.value.calibrated)
      const next: FeaturedPool = { pool: derivePool(calibrated), calibrated }
      try {
        const res = await fetch('/__calibrate', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(next),
        })
        if (res.ok) {
          pool.value = next
          msg.value = '已自动保存'
        } else {
          msg.value = '保存失败'
        }
      } catch {
        msg.value = '保存失败'
      }
    })
    .finally(() => {
      pendingWrites--
      if (pendingWrites === 0) saving.value = false
    })
}

/** 保存当前图当前画幅的取景（读最新 params/inPool，串行入队）。 */
function save() {
  const id = currentId.value
  if (id == null) return
  const key = String(id)
  const prev = pool.value.calibrated[key]
  const modes = { ...(prev?.modes ?? {}), [mode.value]: { ...params.value } }
  queueWrite((cal) => ({ ...cal, [key]: { inPool: inPool.value, modes } }))
  derivedNow.value = false
}

/** 防抖自动保存：调整「落定」后写盘，避免拖拽每帧写文件。 */
function scheduleAutosave() {
  derivedNow.value = false
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => save(), 500)
}

/** 按 9:16 母版重派生本画幅（换图或重调母版后刷新起点，落盘即成为显式校准）。 */
async function rederive() {
  const id = currentId.value
  if (id == null || mode.value === '9:16') return
  const size = dims.value
  const master = await masterFraming(id)
  if (!master || !size.W) return
  const mrect = rectFromFraming(master, size.W, size.H, '9:16')
  params.value =
    mode.value === 'hero'
      ? deriveHeroFraming(mrect, size.W, size.H)
      : deriveFraming(mrect, size.W, size.H, mode.value)
  save()
}

/** 网格缩略图：与右侧取景同一套参数（显式优先，否则由母版派生）。 */
function thumbFraming(id: number): Framing | null {
  const entry = pool.value.calibrated[String(id)]
  if (id === currentId.value) return params.value
  const explicit = entry?.modes?.[mode.value]
  if (explicit) return explicit
  const master = entry?.modes?.['9:16']
  const size = dimsMap.value[id]
  if (!master || !size) return null
  const mrect = rectFromFraming(master, size.W, size.H, '9:16')
  return mode.value === 'hero'
    ? deriveHeroFraming(mrect, size.W, size.H)
    : deriveFraming(mrect, size.W, size.H, mode.value)
}

function thumbStyle(id: number): Record<string, string> | undefined {
  const f = thumbFraming(id)
  if (!f) return undefined
  return {
    objectPosition: `${f.pos} ${f.posY}`,
    transformOrigin: `50% ${f.originY}%`,
    transform: `scale(${f.zoom})`,
  }
}

function onGridLoad(id: number, e: Event) {
  const img = e.target as HTMLImageElement
  if (!img?.naturalWidth || dimsMap.value[id]) return
  dimsMap.value = { ...dimsMap.value, [id]: { W: img.naturalWidth, H: img.naturalHeight } }
}

function modeExplicit(m: FramingMode): boolean {
  const id = currentId.value
  return id != null && !!pool.value.calibrated[String(id)]?.modes?.[m]
}

const hint = computed(() =>
  isHero.value
    ? '六个画幅各存一组取景 · 拖动取景框平移（hero 画幅由版式定死，只平移不缩放）'
    : '六个画幅各存一组取景 · 拖动取景框移动，拖右下角手柄缩放',
)

const paramJson = computed(() =>
  JSON.stringify(
    { pos: params.value.pos, posY: params.value.posY, zoom: params.value.zoom, originY: params.value.originY },
    null,
    2,
  ),
)

const currentNodeName = computed(() =>
  currentId.value == null ? '' : (names.value[currentId.value] ?? String(currentId.value)),
)

/** 网格格子比例跟随当前画幅（9:16 是竖格、hero 是宽格）。 */
const gridStyle = computed<Record<string, string>>(() => ({ '--cell-aspect': String(aspect.value) }))

onMounted(async () => {
  await loadPool()
  try {
    const list = await listFor<CharacterListItem>(catalogEntry('/agents'), DEFAULT_LANG)
    heroIds.value = heroIdsFromList(list)
    names.value = Object.fromEntries(
      list.map((x) => [Number(x.Id), x.zh || x.en || String(x.Id)]),
    )
  } catch {
    heroIds.value = []
  }
  if (heroIds.value.length) await selectId(heroIds.value[0]!)
})

onUnmounted(() => {
  window.clearTimeout(saveTimer)
})
</script>

<template>
  <div class="calib" :class="{ 'is-wide': isWide }">
    <div class="wrap">
      <header class="calib-head">
        <h1>图库校准</h1>
        <p class="calib-hint">{{ hint }}</p>
      </header>

      <nav class="modes" aria-label="取景画幅">
        <button
          v-for="m in FRAMING_MODES"
          :key="m.key"
          class="mode-btn"
          :class="{ on: mode === m.key }"
          :aria-pressed="mode === m.key"
          @click="selectMode(m.key)"
        >
          <span class="mode-key mono">{{ MODE_RATIOS[m.key] }}</span>
          <span class="mode-label">{{ MODE_LABELS[m.key] }}</span>
          <span v-if="modeExplicit(m.key)" class="mode-dot" aria-label="已单独校准" />
        </button>
      </nav>

      <div class="calib-main">
        <section class="picker" aria-label="角色列表">
          <p class="panel-head mono"><span>角色</span><span>{{ heroIds.length }}</span></p>
          <ol class="grid" :class="{ 'is-single': isHero }" :style="gridStyle">
            <li v-for="id in heroIds" :key="id" class="grid-item" :class="{ 'is-current': id === currentId }">
              <button class="grid-cell" @click="selectId(id)">
                <img
                  :src="heroSrc(id)"
                  :alt="`角色 ${id}`"
                  loading="lazy"
                  :style="thumbStyle(id)"
                  @load="onGridLoad(id, $event)"
                />
                <span class="gid mono">{{ id }}</span>
              </button>
              <button
                v-if="mode === '9:16'"
                class="cell-toggle"
                :class="{ on: id === currentId ? inPool : pool.calibrated[String(id)]?.inPool }"
                role="switch"
                :aria-checked="id === currentId ? inPool : pool.calibrated[String(id)]?.inPool"
                :disabled="id !== currentId && !pool.calibrated[String(id)]"
                @click.stop="togglePool(id)"
              >
                <span class="track"><span class="thumb" /></span>
                <span class="switch-label">入池</span>
              </button>
            </li>
          </ol>
        </section>

        <div class="pan-col">
          <div
            ref="panorEl"
            class="panorama"
            :style="{ aspectRatio: `${dims.W} / ${dims.H}` }"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
          >
            <img v-if="currentSrc" :src="currentSrc" alt="" draggable="false" @dragstart.prevent />
            <p class="save-note mono">{{ saving ? '保存中…' : msg }}</p>
            <div
              v-if="rect && dims.W"
              class="cam-rect"
              :style="{
                left: `${((rect.cx - rect.w / 2) / dims.W) * 100}%`,
                top: `${((rect.cy - rect.h / 2) / dims.H) * 100}%`,
                width: `${(rect.w / dims.W) * 100}%`,
                height: `${(rect.h / dims.H) * 100}%`,
              }"
              @pointerdown="onPointerDown($event, 'move')"
            >
              <span v-if="!isHero" class="cam-handle" @pointerdown.stop="onPointerDown($event, 'resize')" />
            </div>
          </div>

          <div v-if="isWide" class="preview-wide">
            <p class="panel-head mono"><span>成品预览 · {{ MODE_RATIOS[mode] }}</span><span>{{ currentSrc ? currentNodeName : '—' }}</span></p>
            <div
              class="preview-band"
              :style="{ aspectRatio: String(aspect), maxWidth: `${Math.round(PREVIEW_MAX_HEIGHT * aspect)}px` }"
            >
              <img
                v-if="currentSrc"
                :src="currentSrc"
                alt=""
                :style="{
                  objectPosition: `${params.pos} ${params.posY}`,
                  transformOrigin: `50% ${params.originY}%`,
                  transform: `scale(${params.zoom})`,
                }"
              />
              <span v-if="isHero" class="preview-scrim" aria-hidden="true" />
              <span v-if="isHero" class="preview-copy" aria-hidden="true">
                <span class="mono">AGENT FILE · NO.{{ String(currentId ?? '').padStart(4, '0') }}</span>
                <strong>{{ currentNodeName }}</strong>
              </span>
            </div>
          </div>

          <div class="tools">
            <p class="state mono">
              <span>{{ MODE_RATIOS[mode] }}</span>
              <span class="state-badge">{{ derivedNow ? '派生值（未落盘）' : '显式校准' }}</span>
              <span v-if="currentSrc">{{ dims.W }}×{{ dims.H }}</span>
            </p>
            <div class="tool-actions">
              <button v-if="mode !== '9:16'" class="tool-btn" @click="rederive">按 9:16 母版重派生</button>
              <button v-if="derivedNow" class="tool-btn" @click="save">写入当前画幅</button>
            </div>
          </div>

          <pre class="param-json mono" aria-label="当前画幅参数">{{ paramJson }}</pre>
          <p class="call-hint mono">
            其他页面调用：getFraming({{ currentId ?? '—' }}, '{{ mode }}')
          </p>
        </div>

        <div v-if="!isWide" class="preview-col">
          <p class="panel-head mono"><span>成品预览</span><span>{{ currentId ?? '—' }} · {{ MODE_RATIOS[mode] }}</span></p>
          <div class="preview-figure" :style="{ aspectRatio: String(aspect) }">
            <img
              v-if="currentSrc"
              :src="currentSrc"
              alt=""
              :style="{
                objectPosition: `${params.pos} ${params.posY}`,
                transformOrigin: `50% ${params.originY}%`,
                transform: `scale(${params.zoom})`,
              }"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.calib { padding-bottom: var(--space-section); }
.calib-head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-head); padding: 14px 0 12px; }
.calib-head h1 { font-family: var(--serif); font-size: var(--fs-title); letter-spacing: .04em; margin: 0; }
.calib-hint { margin: 0; font-size: var(--fs-caption); letter-spacing: .06em; color: var(--ink-2); }

.modes { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 0 14px; }
.mode-btn { display: inline-flex; align-items: baseline; gap: 7px; padding: 6px 10px; background: var(--bg-1); border: 1px solid var(--line-1); border-radius: 2px; color: var(--ink-1); cursor: pointer; }
.mode-btn:hover { border-color: var(--line-2); color: var(--ink-0); }
.mode-btn.on { border-color: var(--amber); color: var(--amber-hi); }
.mode-key { font-size: var(--fs-small); letter-spacing: .04em; }
.mode-label { font-size: var(--fs-nano); letter-spacing: .08em; color: var(--ink-2); }
.mode-btn.on .mode-label { color: var(--amber); }
.mode-dot { width: 4px; height: 4px; border-radius: 50%; background: var(--amber); align-self: center; }

.calib-main { display: grid; grid-template-columns: minmax(250px, 360px) minmax(0, 1fr) minmax(150px, 200px); gap: var(--space-col); align-items: start; }
.calib.is-wide .calib-main { grid-template-columns: minmax(270px, 390px) minmax(0, 1fr); }

.panel-head { display: flex; justify-content: space-between; gap: 8px; margin: 0 0 10px; font-size: var(--fs-nano); letter-spacing: .12em; color: var(--ink-2); }

.picker { position: sticky; top: 74px; display: flex; flex-direction: column; max-height: calc(100dvh - 124px); min-height: 0; }
.grid { list-style: none; flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); align-content: start; gap: 10px 8px; margin: 0; padding: 0 6px 0 0; overflow-y: auto; overscroll-behavior: contain; }
/* hero 画幅的格子是宽幅，一行一张才看得清（按 104px 最小列算只会得到 37px 高） */
.grid.is-single { grid-template-columns: 1fr; }
.grid-item { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.grid-cell { position: relative; width: 100%; aspect-ratio: var(--cell-aspect, 0.5625); overflow: hidden; border: 1px solid var(--line-1); border-radius: 2px; background: var(--bg-0); cursor: pointer; padding: 0; }
.grid-item.is-current .grid-cell { outline: 1px solid var(--amber); }
.grid-cell img { width: 100%; height: 100%; object-fit: cover; display: block; }
.gid { position: absolute; left: 4px; bottom: 2px; font-size: var(--fs-nano); color: var(--ink-2); text-shadow: 0 0 4px var(--bg-0); }
.cell-toggle { display: inline-flex; align-items: center; justify-content: center; gap: 6px; width: 100%; background: none; border: 0; padding: 0; cursor: pointer; font-family: var(--sans); font-size: var(--fs-nano); color: var(--ink-2); }
.cell-toggle:hover { color: var(--ink-0); }
.cell-toggle:disabled { opacity: .4; cursor: default; }
.cell-toggle .track { position: relative; width: 28px; height: 15px; border: 1px solid var(--line-1); border-radius: 2px; background: var(--bg-1); transition: background var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease); }
.cell-toggle .thumb { position: absolute; top: 1px; left: 1px; width: 11px; height: 11px; border-radius: 2px; background: var(--ink-2); transition: left var(--t-fast) var(--ease), background var(--t-fast) var(--ease); }
.cell-toggle.on .track { border-color: var(--amber); background: var(--amber-dim); }
.cell-toggle.on .thumb { left: 14px; background: var(--amber); }
.cell-toggle.on .switch-label { color: var(--amber-hi); }

.pan-col { display: flex; flex-direction: column; gap: var(--space-inline); min-width: 0; }

.panorama { position: relative; overflow: hidden; border: 1px solid var(--line-1); border-radius: 2px; background: var(--bg-0); touch-action: none; }
.panorama > img { width: 100%; height: 100%; object-fit: contain; display: block; user-select: none; }
.cam-rect { position: absolute; border: 1px solid var(--amber); box-shadow: 0 0 0 1px rgba(0,0,0,.35); cursor: move; }
.cam-handle { position: absolute; right: -6px; bottom: -6px; width: 12px; height: 12px; background: var(--amber); border: 1px solid var(--bg-0); cursor: nwse-resize; }

.save-note { position: absolute; top: 8px; left: 10px; z-index: 2; margin: 0; font-size: var(--fs-nano); letter-spacing: .04em; color: var(--ink-0); background: rgba(0,0,0,.45); padding: 2px 6px; border-radius: 2px; pointer-events: none; }

.preview-col { position: sticky; top: 74px; }
.preview-figure { width: 100%; overflow: hidden; border: 1px solid var(--line-1); border-radius: 2px; background: var(--bg-0); }
.preview-figure img { width: 100%; height: 100%; object-fit: cover; display: block; }

.preview-wide { display: flex; flex-direction: column; }
.preview-band { position: relative; align-self: center; width: 100%; overflow: hidden; border: 1px solid var(--line-1); border-radius: 2px; background: var(--bg-0); }
.preview-band img { width: 100%; height: 100%; object-fit: cover; display: block; }
.preview-scrim { position: absolute; inset: 0; background: linear-gradient(90deg, var(--bg-0) 0%, color-mix(in srgb, var(--bg-0) 62%, transparent) 42%, transparent 72%), linear-gradient(180deg, var(--scrim-2) 0%, transparent 60%); pointer-events: none; }
.preview-copy { position: absolute; left: 22px; bottom: 20px; display: flex; flex-direction: column; gap: 6px; pointer-events: none; }
.preview-copy .mono { font-size: var(--fs-nano); letter-spacing: .16em; color: var(--ink-2); }
.preview-copy strong { font-family: var(--serif); font-size: var(--fs-lead); font-weight: 500; color: var(--ink-0); letter-spacing: .02em; }

.tools { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.state { display: flex; align-items: center; gap: 10px; margin: 0; font-size: var(--fs-nano); letter-spacing: .06em; color: var(--ink-2); }
.state-badge { color: var(--amber-hi); }
.tool-actions { display: flex; gap: 8px; }
.tool-btn { padding: 4px 10px; background: var(--bg-1); border: 1px solid var(--line-1); border-radius: 2px; color: var(--ink-1); font-size: var(--fs-nano); letter-spacing: .04em; cursor: pointer; }
.tool-btn:hover { border-color: var(--amber); color: var(--amber-hi); }
.param-json { margin: 0; padding: 12px 14px; background: var(--bg-1); border: 1px solid var(--line-1); border-radius: 2px; font-size: var(--fs-nano); color: var(--ink-1); overflow-x: auto; }
.call-hint { margin: 0; font-size: var(--fs-nano); color: var(--ink-2); }

@media (max-width: 900px) {
  .calib-main, .calib.is-wide .calib-main { grid-template-columns: 1fr; }
  .picker { position: static; order: 2; max-height: 52vh; }
  .pan-col { order: 1; }
  .preview-col { display: none; }
  .grid { grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); }
  .calib-head { flex-direction: column; align-items: flex-start; gap: 6px; }
}
</style>
