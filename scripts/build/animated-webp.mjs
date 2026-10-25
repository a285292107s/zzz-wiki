import sharp from 'sharp'

function readChunks(buf) {
  if (buf.toString('ascii', 8, 12) !== 'WEBP') throw new Error('不是 WebP 数据')
  const chunks = []
  let offset = 12
  while (offset + 8 <= buf.length) {
    const fourcc = buf.toString('ascii', offset, offset + 4)
    const size = buf.readUInt32LE(offset + 4)
    const start = offset + 8
    chunks.push({ fourcc, payload: buf.subarray(start, start + size) })
    offset = start + size + (size % 2)
  }
  return chunks
}

function toChunk(fourcc, payload) {
  const header = Buffer.alloc(8)
  header.write(fourcc, 0, 'ascii')
  header.writeUInt32LE(payload.length, 4)
  const body = payload.length % 2 ? Buffer.concat([payload, Buffer.from([0])]) : payload
  return Buffer.concat([header, body])
}

function buildRiff(chunks) {
  const body = Buffer.concat([Buffer.from('WEBP', 'ascii'), ...chunks])
  const header = Buffer.alloc(8)
  header.write('RIFF', 0, 'ascii')
  header.writeUInt32LE(body.length, 4)
  return Buffer.concat([header, body])
}

function vp8x(width, height, alpha) {
  const payload = Buffer.alloc(10)
  payload[0] = 0x02 | (alpha ? 0x10 : 0)
  payload.writeUIntLE(width - 1, 4, 3)
  payload.writeUIntLE(height - 1, 7, 3)
  return toChunk('VP8X', payload)
}

function anim(loop) {
  const payload = Buffer.alloc(6)
  payload.writeUIntLE(loop, 4, 2)
  return toChunk('ANIM', payload)
}

function anmf(width, height, duration, frameData) {
  const header = Buffer.alloc(16)
  header.writeUIntLE(0, 0, 3)
  header.writeUIntLE(0, 3, 3)
  header.writeUIntLE(width - 1, 6, 3)
  header.writeUIntLE(height - 1, 9, 3)
  header.writeUIntLE(duration, 12, 3)
  header[15] = 0x02
  return toChunk('ANMF', Buffer.concat([header, frameData]))
}

export function sourceFps(delays) {
  const list = Array.isArray(delays) ? delays : [delays ?? 50]
  const avg = list.reduce((sum, d) => sum + (d || 50), 0) / list.length
  return 1000 / avg
}

export function sampleFrames({ pages, delays, posterFrame, targetFps }) {
  const list = Array.isArray(delays) ? delays : [delays ?? 50]
  const order = []
  for (let i = 0; i < pages; i++) order.push((posterFrame + i) % pages)
  const starts = []
  let total = 0
  for (const index of order) {
    starts.push(total)
    total += list[index] || 50
  }
  const frameMs = 1000 / Math.max(1, targetFps)
  const count = Math.max(2, Math.round(total / frameMs))
  const delay = Math.max(20, Math.round(total / count))
  const frames = []
  let cursor = 0
  for (let k = 0; k < count; k++) {
    const t = (k * total) / count
    while (cursor + 1 < pages && starts[cursor + 1] <= t) cursor++
    frames.push({ index: order[cursor], delay })
  }
  return frames
}

export async function downscale({ raw, width, height, pages, maxEdge }) {
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  if (scale >= 0.999) return { raw, width, height }
  const nw = Math.max(1, Math.round(width * scale))
  const nh = Math.max(1, Math.round(height * scale))
  const out = Buffer.allocUnsafe(nw * nh * pages * 4)
  for (let i = 0; i < pages; i++) {
    const frame = raw.subarray(i * width * height * 4, (i + 1) * width * height * 4)
    const resized = await sharp(frame, { raw: { width, height, channels: 4 } })
      .resize({ width: nw, height: nh, kernel: 'lanczos3' })
      .ensureAlpha()
      .raw()
      .toBuffer()
    resized.copy(out, i * nw * nh * 4)
  }
  return { raw: out, width: nw, height: nh }
}

export async function encodeAnimation({ raw, width, height, frames, quality, effort = 5, loop = 0 }) {
  const encoded = []
  let alpha = false
  for (const frame of frames) {
    const slice = raw.subarray(frame.index * width * height * 4, (frame.index + 1) * width * height * 4)
    const still = await sharp(slice, { raw: { width, height, channels: 4 } })
      .webp({ quality, effort, smartSubsample: false })
      .toBuffer()
    const chunks = readChunks(still).filter((chunk) => chunk.fourcc !== 'VP8X')
    if (chunks.some((chunk) => chunk.fourcc === 'ALPH')) alpha = true
    const data = Buffer.concat(chunks.map((c) => toChunk(c.fourcc, c.payload)))
    encoded.push(anmf(width, height, frame.delay, data))
  }
  return buildRiff([vp8x(width, height, alpha), anim(loop), ...encoded])
}
