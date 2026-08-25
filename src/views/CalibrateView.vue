<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { rectFromParams, paramsFromRect, formatPos, ZOOM_MIN, ZOOM_MAX, type CameraRect } from '@/utils/cameraRect'
import type { CalibratedEntry, FeaturedPool, PoolItem } from '@/domain/featuredPool'

// —— 仅在开发环境可用：生产构建下路由被守卫重定向，这里再兜底显示提示 ——
const isDev = import.meta.env.DEV

const LOCAL_HERO = `${import.meta.env.BASE_URL ?? '/'}data/img/hero`

/** img/hero 下实际存在的角色号（与 download:icons 落地清单一致；缺 hero 图的如 1551/1611/1621 不在列）。 */
const HERO_IDS = [
  1011, 1021, 1031, 1041, 1051, 1061, 1071, 1081, 1091, 1101, 1111, 1121, 1131, 1141, 1151, 1161, 1171, 1181,
  1191, 1201, 1211, 1221, 1241, 1251, 1261, 1271, 1281, 1291, 1301, 1311, 1321, 1331, 1341, 1351, 1361, 1371,
  1381, 1391, 1401, 1411, 1421, 1431, 1441, 1451, 1461, 1471, 1481, 1491, 1501, 1511, 1521, 1531, 1541, 1561,
  1571, 1581, 1591,
]

const pool = ref<FeaturedPool>({ pool: [], calibrated: {} })
const currentId = ref<number | null>(null)
const params = ref({ pos: 50, zoom: 1, originY: 50 })
const inPool = ref(false)
const imgNat = ref({ W: 0, H: 0 })
const imgSrc = ref('')
const saving = ref(false)
const msg = ref('改动自动保存')
const panorEl = ref<HTMLDivElement | null>(null)
let saveTimer: number | undefined

// 拖拽 / 缩放
const dragMode = ref<'move' | 'resize' | null>(null)
const dragStart = ref({ x: 0, y: 0, cx: 0, cy: 0, w: 0, h: 0 })

const currentSrc = computed(() => imgSrc.value)
const heroSrc = (id: number) => `${LOCAL_HERO}/Mindscape_${id}_2.webp`

const rect = computed<CameraRect | null>(() =>
  imgNat.value.W ? rectFromParams(params.value.pos, params.value.zoom, params.value.originY, imgNat.value.W, imgNat.value.H) : null,
)

/** 水平滑杆可达范围（随缩放变化）：min/max = 左/右缘可达的 pos，拉到顶即贴到图片边缘。 */
const posBounds = computed(() => {
  const { W, H } = imgNat.value
  if (!W || !H) return { min: 0, max: 100 }
  const z = Math.max(params.value.zoom, ZOOM_MIN)
  const w = (9 / 16) * (H / z)
  const denom = W - (9 / 16) * H
  const c = (9 / 16) * 0.5 * H
  return {
    min: Math.round(((w / 2 - c) / denom) * 1000) / 10,
    max: Math.round(((W - w / 2 - c) / denom) * 1000) / 10,
  }
})

// 缩放/载图变化会让 pos 可达范围收窄，钳回范围内避免滑杆显示越界
watch(posBounds, (b) => {
  params.value.pos = Math.round(Math.min(Math.max(params.value.pos, b.min), b.max) * 10) / 10
})

async function loadPool() {
  try {
    const res = await fetch('/__calibrate')
    if (res.ok) pool.value = await res.json()
  } catch {
    pool.value = { pool: [], calibrated: {} }
  }
}

function loadImage(id: number): Promise<{ W: number; H: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.src = heroSrc(id)
    img.onload = () => resolve({ W: img.naturalWidth, H: img.naturalHeight })
    img.onerror = () => resolve({ W: 0, H: 0 })
  })
}

/** 对未校准图自动给一个起始构图：内容包围盒算 zoom/originY，pos 居中（之后再拖框精修）。
 *  显式接收 id（不读共享的 currentId，避免快速切换时对错图算包围盒）。 */
async function autoInit(id: number, W: number, H: number): Promise<{ pos: number; zoom: number; originY: number }> {
  if (!W) return { pos: 50, zoom: 1, originY: 50 }
  try {
    const img = new Image()
    img.src = heroSrc(id)
    await new Promise<void>((r) => {
      img.onload = () => r()
      img.onerror = () => r()
    })
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const ctx = c.getContext('2d')
    if (!ctx) return { pos: 50, zoom: 1, originY: 50 }
    ctx.drawImage(img, 0, 0, W, H)
    const d = ctx.getImageData(0, 0, W, H).data
    let top = -1
    let bot = -1
    const step = Math.max(1, Math.floor(W / 120))
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x += step) {
        if (d[(y * W + x) * 4 + 3] >= 16) {
          if (top < 0) top = y
          bot = y
          break
        }
      }
    }
    if (top < 0) return { pos: 50, zoom: 1, originY: 50 }
    const ch = bot - top + 1
    const zoom = Math.min(Math.max(H / ch, 1.05), 1.7)
    const originY = Math.round((top / (top + (H - bot))) * 1000) / 10
    return { pos: 50, zoom, originY }
  } catch {
    return { pos: 50, zoom: 1, originY: 50 }
  }
}

async function selectId(id: number) {
  if (currentId.value === id) return
  currentId.value = id
  const size = await loadImage(id) // 预热缓存并取尺寸
  if (currentId.value !== id) return // await 期间已切到别的图，丢弃
  imgNat.value = size // 先更新容器比例，避免切图瞬间按旧比例跳动
  const entry = pool.value.calibrated[String(id)]
  if (entry) {
    params.value = { pos: parseFloat(entry.pos) || 50, zoom: entry.zoom, originY: entry.originY }
    inPool.value = entry.inPool
  } else {
    params.value = await autoInit(id, size.W, size.H)
    if (currentId.value !== id) return
    inPool.value = false
  }
  imgSrc.value = heroSrc(id) // 尺寸/参数就绪后再切显示图（已缓存，无闪）
  msg.value = '改动自动保存'
}

/** 拖框移动 / 缩放：把显示像素增量换算成源图像素。 */
function toSourceDelta(px: number): number {
  const w = panorEl.value?.clientWidth ?? imgNat.value.W
  return (imgNat.value.W / w) * px
}

function clampRect(target: CameraRect): CameraRect {
  const { W, H } = imgNat.value
  const w = Math.min(Math.max(target.w, (9 / 16) * H * (1 / ZOOM_MAX)), (9 / 16) * H * (1 / ZOOM_MIN))
  const h = w / (9 / 16)
  const halfW = w / 2
  const halfH = h / 2
  const cx = Math.min(Math.max(target.cx, halfW), W - halfW)
  const cy = Math.min(Math.max(target.cy, halfH), H - halfH)
  return { cx, cy, w, h }
}

function onPointerDown(e: PointerEvent, mode: 'move' | 'resize') {
  if (!rect.value) return
  e.preventDefault()
  dragMode.value = mode
  dragStart.value = { x: e.clientX, y: e.clientY, cx: rect.value.cx, cy: rect.value.cy, w: rect.value.w, h: rect.value.h }
  panorEl.value?.setPointerCapture?.(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (!dragMode.value) return
  const dx = toSourceDelta(e.clientX - dragStart.value.x)
  const dy = toSourceDelta(e.clientY - dragStart.value.y)
  let target: CameraRect
  if (dragMode.value === 'move') {
    target = { cx: dragStart.value.cx + dx, cy: dragStart.value.cy + dy, w: dragStart.value.w, h: dragStart.value.h }
  } else {
    target = { cx: dragStart.value.cx, cy: dragStart.value.cy, w: dragStart.value.w + dx, h: dragStart.value.h }
  }
  const c = clampRect(target)
  const next = paramsFromRect(c, imgNat.value.W, imgNat.value.H)
  params.value = next
  scheduleAutosave()
}

function onPointerUp(e: PointerEvent) {
  if (dragMode.value) panorEl.value?.releasePointerCapture?.(e.pointerId)
  dragMode.value = null
  window.clearTimeout(saveTimer)
  save() // 拖拽落定后立即落盘
}

function setInPool(v: boolean) {
  inPool.value = v
  scheduleAutosave()
}

/** 防抖自动保存：调整"落定"后写盘，避免拖拽每帧写文件。 */
function scheduleAutosave() {
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => save(), 500)
}

/** 由 calibrated 派生 pool 数组（入池 = inPool）。 */
function derivePool(calibrated: Record<string, CalibratedEntry>): PoolItem[] {
  return Object.entries(calibrated)
    .filter(([, v]) => v.inPool)
    .map(([k, v]) => ({ id: Number(k), pos: v.pos, zoom: v.zoom, originY: v.originY }))
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

/** 保存当前选中图的构图/入池（读最新 params/inPool，串行入队）。 */
function save() {
  const id = currentId.value
  if (id == null) return
  queueWrite((cal) => ({
    ...cal,
    [String(id)]: { pos: formatPos(params.value.pos), zoom: params.value.zoom, originY: params.value.originY, inPool: inPool.value },
  }))
}

/** 未校准图在列表直接入池时：自动给一个内容包围盒的起点构图。 */
async function autoInitForId(id: number): Promise<{ pos: number; zoom: number; originY: number }> {
  const size = await loadImage(id)
  return autoInit(id, size.W, size.H)
}

/** 列表里逐图切换"入池"：当前图走实时 inPool，其余改已保存条目（未校准则自动给起点构图）。 */
async function togglePool(id: number) {
  if (id === currentId.value) {
    setInPool(!inPool.value)
    return
  }
  const key = String(id)
  const entry = pool.value.calibrated[key]
  let entryNew: CalibratedEntry
  if (entry) {
    entryNew = { ...entry, inPool: !entry.inPool }
  } else {
    const p = await autoInitForId(id)
    entryNew = { pos: formatPos(p.pos), zoom: p.zoom, originY: p.originY, inPool: true }
  }
  queueWrite((cal) => ({ ...cal, [key]: entryNew }))
}

onMounted(async () => {
  if (!isDev) return
  await loadPool()
  if (pool.value.pool.length) await selectId(pool.value.pool[0]!.id)
  else if (HERO_IDS.length) await selectId(HERO_IDS[0]!)
})

onUnmounted(() => {
  window.clearTimeout(saveTimer)
})

/** 某图当前应显示的构图/状态：当前选中图实时取 params/inPool，其余取已保存。 */
function entryFor(id: number): { pos: string; zoom: number; originY: number; inPool: boolean } | undefined {
  if (id === currentId.value) {
    return { pos: formatPos(params.value.pos), zoom: params.value.zoom, originY: params.value.originY, inPool: inPool.value }
  }
  return pool.value.calibrated[String(id)]
}

/** 缩略图套用与成品卡一致的取景（对象渲染匹配），调整时网格即时同步。 */
function thumbStyle(id: number): Record<string, string> | undefined {
  const e = entryFor(id)
  if (!e) return undefined
  return { objectPosition: e.pos, transformOrigin: `50% ${e.originY}%`, transform: `scale(${e.zoom})` }
}
</script>

<template>
  <div v-if="!isDev" class="calib">
    <div class="wrap"><p>校准工具仅开发环境可用。</p></div>
  </div>
  <div v-else class="calib">
    <div class="wrap">
      <header class="calib-head">
        <h1>图库校准 · 今日角色</h1>
      </header>

      <div class="calib-main">
        <!-- 示意取景框 + 滑动条（左列） -->
        <div class="pan-col">
          <div
            ref="panorEl"
            class="panorama"
            :style="{ aspectRatio: `${imgNat.W} / ${imgNat.H}` }"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
          >
            <img v-if="currentSrc" :src="currentSrc" alt="" draggable="false" @dragstart.prevent />
            <p class="save-note mono">{{ saving ? '保存中…' : msg }}</p>
            <div
              v-if="rect && imgNat.W"
              class="cam-rect"
              :style="{
                left: `${((rect.cx - rect.w / 2) / imgNat.W) * 100}%`,
                top: `${((rect.cy - rect.h / 2) / imgNat.H) * 100}%`,
                width: `${(rect.w / imgNat.W) * 100}%`,
                height: `${(rect.h / imgNat.H) * 100}%`,
              }"
              @pointerdown="onPointerDown($event, 'move')"
            >
              <span class="cam-handle" @pointerdown.stop="onPointerDown($event, 'resize')" />
            </div>
          </div>

          <!-- 滑动条：置于全景图下方，填满该列剩余高度 -->
          <div class="controls">
            <label>
              <span class="ctl-label">水平</span>
              <input v-model.number="params.pos" type="range" :min="posBounds.min" :max="posBounds.max" step="0.5" @change="scheduleAutosave" />
              <span class="ctl-val mono">{{ params.pos }}</span>
            </label>
            <label>
              <span class="ctl-label">垂直</span>
              <input v-model.number="params.originY" type="range" min="0" max="100" step="0.5" @change="scheduleAutosave" />
              <span class="ctl-val mono">{{ params.originY }}</span>
            </label>
            <label>
              <span class="ctl-label">大小</span>
              <input v-model.number="params.zoom" type="range" :min="ZOOM_MIN" :max="ZOOM_MAX" step="0.01" @change="scheduleAutosave" />
              <span class="ctl-val mono">{{ params.zoom.toFixed(2) }}</span>
            </label>
          </div>
        </div>

        <!-- 成品预览（右列） -->
        <div class="preview-figure">
          <img
            v-if="currentSrc"
            :src="currentSrc"
            alt=""
            :style="{ objectPosition: `${params.pos}%`, transformOrigin: `50% ${params.originY}%`, transform: `scale(${params.zoom})` }"
          />
        </div>
      </div>

      <!-- 网格 -->
      <ol class="grid">
        <li v-for="id in HERO_IDS" :key="id" class="grid-item" :class="{ 'is-current': id === currentId }">
          <button class="grid-cell" @click="selectId(id)">
            <img :src="heroSrc(id)" :alt="`${id}`" loading="lazy" :style="thumbStyle(id)" />
            <span class="gid mono">{{ id }}</span>
          </button>
          <button
            class="cell-toggle"
            :class="{ on: entryFor(id)?.inPool }"
            role="switch"
            :aria-checked="entryFor(id)?.inPool"
            @click.stop="togglePool(id)"
          >
            <span class="track"><span class="thumb" /></span>
            <span class="switch-label">入池</span>
          </button>
        </li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.calib { padding-bottom: var(--space-section); }
.calib-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; padding: 22px 0 18px; }
.calib-head h1 { font-family: var(--serif); font-size: var(--fs-display); margin: 0; }
.calib-main { display: grid; grid-template-columns: 1fr minmax(230px, 330px); gap: 12px; }

.pan-col { display: flex; flex-direction: column; gap: 12px; min-width: 0; }

.panorama { position: relative; overflow: hidden; border: 1px solid var(--line-1); border-radius: 2px; background: var(--bg-0); touch-action: none; }
.panorama > img { width: 100%; height: 100%; object-fit: contain; display: block; user-select: none; }
.cam-rect { position: absolute; border: 1px solid var(--amber); box-shadow: 0 0 0 1px rgba(0,0,0,.35); cursor: move; }
.cam-handle { position: absolute; right: -6px; bottom: -6px; width: 12px; height: 12px; background: var(--amber); border: 1px solid var(--bg-0); cursor: nwse-resize; }

.preview-figure { width: 100%; align-self: start; aspect-ratio: 9 / 16; overflow: hidden; border: 1px solid var(--line-1); border-radius: 2px; background: var(--bg-0); }
.preview-figure img { width: 100%; height: 100%; object-fit: cover; display: block; }

.controls { flex: 1; display: flex; flex-direction: column; gap: 10px; border: 1px solid var(--line-1); border-radius: 2px; padding: 14px; }
.controls label { display: grid; grid-template-columns: 60px 1fr 50px; align-items: center; gap: 10px; font-size: var(--fs-caption); }
.ctl-label { color: var(--ink-2); letter-spacing: .1em; }
.ctl-val { color: var(--ink-1); text-align: right; }
.controls input[type='range'] { width: 100%; }
.save-note { position: absolute; top: 8px; left: 10px; z-index: 2; margin: 0; font-size: var(--fs-nano); letter-spacing: .04em; color: var(--ink-0); background: rgba(0,0,0,.45); padding: 2px 6px; border-radius: 2px; pointer-events: none; }

.grid { list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px 10px; margin-top: 20px; padding: 0; }
.grid-item { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.grid-cell { position: relative; width: 100%; aspect-ratio: 9 / 16; overflow: hidden; border: 1px solid var(--line-1); border-radius: 2px; background: var(--bg-0); cursor: pointer; padding: 0; }
.grid-item.is-current .grid-cell { outline: 1px solid var(--amber); }
.grid-cell img { width: 100%; height: 100%; object-fit: cover; display: block; }
.gid { position: absolute; left: 4px; bottom: 2px; font-size: var(--fs-nano); color: var(--ink-2); }
/* 每格下方的小号"入池"开关 */
.cell-toggle { display: inline-flex; align-items: center; justify-content: center; gap: 6px; width: 100%; background: none; border: 0; padding: 0; cursor: pointer; font-family: var(--sans); font-size: var(--fs-nano); color: var(--ink-2); }
.cell-toggle:hover { color: var(--ink-0); }
.cell-toggle .track { position: relative; width: 28px; height: 15px; border: 1px solid var(--line-1); border-radius: 2px; background: var(--bg-1); transition: background var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease); }
.cell-toggle .thumb { position: absolute; top: 1px; left: 1px; width: 11px; height: 11px; border-radius: 2px; background: var(--ink-2); transition: left var(--t-fast) var(--ease), background var(--t-fast) var(--ease); }
.cell-toggle.on .track { border-color: var(--amber); background: var(--amber-dim); }
.cell-toggle.on .thumb { left: 14px; background: var(--amber); }
.cell-toggle.on .switch-label { color: var(--amber-hi); }

@media (max-width: 860px) {
  .calib-main { grid-template-columns: 1fr; }
}
</style>
