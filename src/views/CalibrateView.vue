<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { rectFromParams, paramsFromRect, formatPos, ZOOM_MIN, ZOOM_MAX, type CameraRect } from '@/utils/cameraRect'
import type { CalibratedStatus, FeaturedPool } from '@/domain/featuredPool'

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
const status = ref<CalibratedStatus>('calibrated')
const imgNat = ref({ W: 0, H: 0 })
const imgSrc = ref('')
const dirty = ref(false)
const saving = ref(false)
const msg = ref('')
const panorEl = ref<HTMLDivElement | null>(null)

// 拖拽 / 缩放
const dragMode = ref<'move' | 'resize' | null>(null)
const dragStart = ref({ x: 0, y: 0, cx: 0, cy: 0, w: 0 })

const currentSrc = computed(() => imgSrc.value)
const heroSrc = (id: number) => `${LOCAL_HERO}/Mindscape_${id}_2.webp`

const currentEntry = computed(() =>
  currentId.value != null ? pool.value.calibrated[String(currentId.value)] : undefined,
)

const rect = computed<CameraRect | null>(() =>
  imgNat.value.W ? rectFromParams(params.value.pos, params.value.zoom, params.value.originY, imgNat.value.W, imgNat.value.H) : null,
)

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
  imgSrc.value = heroSrc(id)
  const size = await loadImage(id)
  if (currentId.value !== id) return // await 期间已切到别的图，丢弃
  imgNat.value = size
  const entry = pool.value.calibrated[String(id)]
  if (entry) {
    params.value = { pos: parseFloat(entry.pos) || 50, zoom: entry.zoom, originY: entry.originY }
    status.value = entry.status
  } else {
    params.value = await autoInit(id, size.W, size.H)
    if (currentId.value !== id) return // autoInit 期间已切换
    status.value = 'calibrated'
  }
  dirty.value = false
  msg.value = ''
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
  dragMode.value = mode
  dragStart.value = { x: e.clientX, y: e.clientY, cx: rect.value.cx, cy: rect.value.cy, w: rect.value.w }
  const el = panorEl.value
  el?.setPointerCapture?.(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (!dragMode.value || !rect.value) return
  const dx = toSourceDelta(e.clientX - dragStart.value.x)
  const dy = toSourceDelta(e.clientY - dragStart.value.y)
  let target: CameraRect
  if (dragMode.value === 'move') {
    target = { cx: dragStart.value.cx + dx, cy: dragStart.value.cy + dy, w: rect.value.w, h: rect.value.h }
  } else {
    target = { cx: dragStart.value.cx, cy: dragStart.value.cy, w: dragStart.value.w + dx * (9 / 16), h: rect.value.h }
  }
  const c = clampRect(target)
  const next = paramsFromRect(c, imgNat.value.W, imgNat.value.H)
  params.value = next
  dirty.value = true
}

function onPointerUp() {
  dragMode.value = null
}

function setStatus(s: CalibratedStatus) {
  status.value = s
  dirty.value = true
}

function resetParams() {
  if (currentId.value == null) return
  params.value = currentEntry.value
    ? { pos: parseFloat(currentEntry.value.pos) || 50, zoom: currentEntry.value.zoom, originY: currentEntry.value.originY }
    : { pos: 50, zoom: 1, originY: 50 }
  dirty.value = false
}

async function save() {
  const id = currentId.value
  if (id == null) return
  const key = String(id)
  const calibrated = {
    ...pool.value.calibrated,
    [key]: { pos: formatPos(params.value.pos), zoom: params.value.zoom, originY: params.value.originY, status: status.value },
  }
  const poolArr = Object.entries(calibrated)
    .filter(([, v]) => v.status === 'pool')
    .map(([k, v]) => ({ id: Number(k), pos: v.pos, zoom: v.zoom, originY: v.originY }))
    .sort((a, b) => a.id - b.id)
  const next: FeaturedPool = { pool: poolArr, calibrated }
  saving.value = true
  try {
    const res = await fetch('/__calibrate', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    })
    if (res.ok) {
      pool.value = next
      dirty.value = false
      msg.value = '已保存'
    } else {
      msg.value = '保存失败'
    }
  } catch {
    msg.value = '保存失败'
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  if (!isDev) return
  await loadPool()
  if (pool.value.pool.length) await selectId(pool.value.pool[0]!.id)
  else if (HERO_IDS.length) await selectId(HERO_IDS[0]!)
})

function statusLabel(s: CalibratedStatus | undefined): string {
  if (s === 'pool') return '已入池'
  if (s === 'calibrated') return '已校准'
  if (s === 'unsuitable') return '不合适'
  return '未校准'
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
        <div class="head-actions">
          <span class="hint">拖动全景图上的取景框定位，拖右下角缩放；右侧为该图最终 9:16 效果</span>
          <button :disabled="saving || !dirty" @click="save">保存</button>
        </div>
      </header>

      <div class="calib-main">
        <!-- 示意取景框 (tone) -->
        <div
          ref="panorEl"
          class="panorama"
          :style="{ aspectRatio: `${imgNat.W} / ${imgNat.H}` }"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointerleave="onPointerUp"
        >
          <img v-if="currentSrc" :src="currentSrc" alt="" draggable="false" @dragstart.prevent />
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

        <!-- 成品预览 + 控制 -->
        <div class="side">
          <div class="preview-figure">
            <img
              v-if="currentSrc"
              :src="currentSrc"
              alt=""
              :style="{ objectPosition: `${params.pos}%`, transformOrigin: `50% ${params.originY}%`, transform: `scale(${params.zoom})` }"
            />
          </div>

          <div class="controls">
            <label>
              <span class="ctl-label mono">pos</span>
              <input v-model.number="params.pos" type="range" min="0" max="100" step="0.5" @input="dirty = true" />
              <span class="ctl-val mono">{{ params.pos }}</span>
            </label>
            <label>
              <span class="ctl-label mono">zoom</span>
              <input v-model.number="params.zoom" type="range" :min="ZOOM_MIN" :max="ZOOM_MAX" step="0.01" @input="dirty = true" />
              <span class="ctl-val mono">{{ params.zoom.toFixed(2) }}</span>
            </label>
            <label>
              <span class="ctl-label mono">originY</span>
              <input v-model.number="params.originY" type="range" min="0" max="100" step="0.5" @input="dirty = true" />
              <span class="ctl-val mono">{{ params.originY }}</span>
            </label>
            <div class="status-row">
              <button :class="{ active: status === 'unsuitable' }" @click="setStatus('unsuitable')">不合适</button>
              <button :class="{ active: status === 'calibrated' }" @click="setStatus('calibrated')">已校准</button>
              <button :class="{ active: status === 'pool' }" @click="setStatus('pool')">入池</button>
              <button @click="resetParams">复位</button>
            </div>
            <p class="msg mono">{{ msg }}</p>
          </div>
        </div>
      </div>

      <!-- 网格 -->
      <ol class="grid">
        <li v-for="id in HERO_IDS" :key="id" :class="{ 'is-current': id === currentId }">
          <button class="grid-cell" @click="selectId(id)">
            <img :src="heroSrc(id)" :alt="`${id}`" loading="lazy" />
            <span class="badge mono">{{ statusLabel(pool.calibrated[String(id)]?.status) }}</span>
            <span class="gid mono">{{ id }}</span>
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
.head-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
.hint { font-size: var(--fs-caption); color: var(--ink-2); max-width: 46ch; text-align: right; }
.calib-main { display: grid; grid-template-columns: 1.4fr 1fr; gap: 16px; }

.panorama { position: relative; overflow: hidden; border: 1px solid var(--line-1); border-radius: 2px; background: var(--bg-0); touch-action: none; }
.panorama > img { width: 100%; height: 100%; object-fit: contain; display: block; user-select: none; }
.cam-rect { position: absolute; border: 1px solid var(--amber); box-shadow: 0 0 0 1px rgba(0,0,0,.35); cursor: move; }
.cam-handle { position: absolute; right: -6px; bottom: -6px; width: 12px; height: 12px; background: var(--amber); border: 1px solid var(--bg-0); cursor: nwse-resize; }

.side { display: flex; flex-direction: column; gap: 14px; }
.preview-figure { width: 100%; aspect-ratio: 9 / 16; overflow: hidden; border: 1px solid var(--line-1); border-radius: 2px; background: var(--bg-0); }
.preview-figure img { width: 100%; height: 100%; object-fit: cover; display: block; }

.controls { display: flex; flex-direction: column; gap: 10px; border: 1px solid var(--line-1); border-radius: 2px; padding: 14px; }
.controls label { display: grid; grid-template-columns: 60px 1fr 50px; align-items: center; gap: 10px; font-size: var(--fs-caption); }
.ctl-label { color: var(--ink-2); letter-spacing: .1em; }
.ctl-val { color: var(--ink-1); text-align: right; }
.controls input[type='range'] { width: 100%; }
.status-row { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px; }
.status-row button, .head-actions button { background: var(--bg-1); color: var(--ink-1); border: 1px solid var(--line-1); border-radius: 2px; padding: 5px 10px; font-size: var(--fs-caption); cursor: pointer; font-family: var(--sans); }
.status-row button:hover, .head-actions button:hover { border-color: var(--line-2); color: var(--ink-0); }
.status-row button.active { border-color: var(--amber); color: var(--amber-hi); }
.head-actions button:disabled { opacity: .4; cursor: default; }
.msg { color: var(--ink-2); font-size: var(--fs-caption); margin: 0; }

.grid { list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; margin-top: 20px; padding: 0; }
.grid-cell { position: relative; width: 100%; aspect-ratio: 9 / 18; overflow: hidden; border: 1px solid var(--line-1); border-radius: 2px; background: var(--bg-0); cursor: pointer; padding: 0; }
.grid-cell img { width: 100%; height: 100%; object-fit: cover; display: block; }
.grid-cell.is-current { outline: 1px solid var(--amber); }
.badge { position: absolute; left: 4px; top: 4px; font-size: var(--fs-nano); color: var(--ink-0); background: rgba(0,0,0,.55); padding: 1px 4px; border-radius: 2px; }
.gid { position: absolute; left: 4px; bottom: 2px; font-size: var(--fs-nano); color: var(--ink-2); }

@media (max-width: 860px) {
  .calib-main { grid-template-columns: 1fr; }
}
</style>
