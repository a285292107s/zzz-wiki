const COS30 = Math.sqrt(3) / 2
const SIN30 = 0.5

const BAR_MIN_LENGTH = 16
const BAR_PER_WEIGHT = 11
const BAR_DEPTH = 32
const BAR_GAP = 16
const RACK_GAP = 22
const BAR_MIN_HEIGHT = 28
const BAR_HEIGHT_PER_DEGREE = 7
const BAR_MAX_HEIGHT = 68
const BAR_MIN_FLOORS = 2
const FLOOR_HEIGHT = 26
const BANDS_PER_FACADE = 4
const PLINTH_HEIGHT = 3
const LOBE_MIN_WIDTH = 22
const LOBE_INSET = 5
const LOBE_TOP_STEP = 8
const GUTTER_PAD = 20
const PLATE_HEAD = 46
const GUTTER_PER_CHAR = 13.5
const RACK_GUTTER = 28
const PLATE_PAD_BACK = 30
const RAIL_DEPTH = 52
const PLATE_PAD_FRONT = 2
const PLATE_GAP = 24
const PLATE_THICKNESS = 10
const STEP_H = 30
const MARGIN = 22
const LABEL_LEFT = 152
const LABEL_LANE_V = 24
const FLAG_POLE = 62
const FLAG_INSET_U = 12
const FLAG_PAD_HALF_U = 7
const FLAG_PAD_HALF_V = 4.5
const GROUND_MARGIN = 8
const GROUND_FRONT = 48
const GROUND_THICKNESS = 12
const CABLE_RISE_MIN = 26
const CABLE_RISE_PER_SPAN = 0.13
const CABLE_RISE_MAX = 62
const CABLE_RISE_SPAN_CAP = 1.1
const CABLE_RISE_SPAN_FLOOR = 12
const CABLE_HEAD_DROP = 5
const CABLE_HEAD_SPAN = 12
const CABLE_HEAD_HALF = 3.4

export interface Point {
  x: number
  y: number
}

interface Vec {
  u: number
  v: number
  h: number
}

export interface RailShape {
  points: string
  cluster: string
  tag: Point
}

export interface TerraceShape {
  no: string
  width: number
  top: string
  front: string
  side: string
  label: Point
  flagBase: Point
  flagTop: Point
  flagPad: string
  rails: readonly RailShape[]
}

export interface BuildingShape {
  front: string
  side: string
  roof: string
  parapetFront: string
  parapetSide: string
  plinthFront: string
  plinthSide: string
  roofLine: string
}

export interface CubeShape {
  id: string
  layer: number
  roof: string
  front: string
  side: string
  bandsFront: readonly string[]
  bandsSide: readonly string[]
  tower: BuildingShape | null
  height: number
  width: number
  floors: number
  dot: Point
  roofCenter: Point
  label: Point
  anchor: Point
  bottom: Point
}

export interface AtlasEdgeShape {
  from: string
  to: string
  kind: string
  d: string
  head: string
  start: Point
  end: Point
  depth: number
}

export interface GroundShape {
  top: string
  front: string
  lip: string
}

export interface AtlasLayout {
  width: number
  height: number
  ground: GroundShape
  terraces: readonly TerraceShape[]
  cubes: readonly CubeShape[]
  edges: readonly AtlasEdgeShape[]
  degrees: Record<string, number>
  lane: Point
}

function project(p: Vec): Point {
  return { x: (p.u - p.v) * COS30, y: (p.u + p.v) * SIN30 - p.h }
}

function round(n: number): number {
  return Math.round(n * 10) / 10
}

export function barLength(weight: number): number {
  return BAR_MIN_LENGTH + weight * BAR_PER_WEIGHT
}

export function barHeight(degree: number): number {
  return Math.min(BAR_MAX_HEIGHT, BAR_MIN_HEIGHT + degree * BAR_HEIGHT_PER_DEGREE)
}

interface Slot {
  uc: number
  vc: number
  length: number
  layer: number
}

interface Rack {
  start: number
  end: number
  cluster: string
}

export function layoutAtlas(args: {
  modules: readonly { id: string; layer: number; weight: number; cluster?: string }[]
  edges: readonly { from: string; to: string; kind: string }[]
  layers: readonly { zh: string }[]
}): AtlasLayout {
  const degrees: Record<string, number> = {}
  for (const module of args.modules) degrees[module.id] = 0
  for (const edge of args.edges) {
    degrees[edge.from] = (degrees[edge.from] ?? 0) + 1
    degrees[edge.to] = (degrees[edge.to] ?? 0) + 1
  }

  const grouped: { id: string; layer: number; weight: number; cluster?: string }[][] = Array.from(
    { length: args.layers.length },
    () => [],
  )
  for (const module of args.modules) grouped[module.layer]?.push(module)

  const plateDepth = PLATE_PAD_BACK + BAR_DEPTH + RAIL_DEPTH + PLATE_PAD_FRONT
  const plateStep = plateDepth + PLATE_GAP
  const railV0 = PLATE_PAD_BACK + BAR_DEPTH

  const slots = new Map<string, Slot>()
  const rawTerraces = grouped.map((modules, layer) => {
    const racks: Rack[] = []
    const gutterWidth = GUTTER_PAD * 2 + args.layers[layer]!.zh.length * GUTTER_PER_CHAR
    const headWidth = gutterWidth + PLATE_HEAD
    let cursor = headWidth
    for (const module of modules) {
      const cluster = module.cluster ?? ''
      let rack = racks[racks.length - 1]
      if (!rack || rack.cluster !== cluster) {
        if (rack) cursor += RACK_GUTTER + RACK_GAP
        rack = { start: cursor, end: cursor, cluster }
        racks.push(rack)
      }
      const length = barLength(module.weight)
      slots.set(module.id, {
        uc: cursor + length / 2,
        vc: layer * plateStep + PLATE_PAD_BACK + BAR_DEPTH / 2,
        length,
        layer,
      })
      cursor += length + BAR_GAP
      rack.end = cursor - BAR_GAP
    }
    const last = racks[racks.length - 1]
    const width = last ? last.end + RACK_GUTTER : headWidth
    const v0 = layer * plateStep
    const h = -layer * STEP_H
    const top: Vec[] = [
      { u: 0, v: v0, h },
      { u: width, v: v0, h },
      { u: width, v: v0 + plateDepth, h },
      { u: 0, v: v0 + plateDepth, h },
    ]
    const front: Vec[] = [
      { u: 0, v: v0 + plateDepth, h },
      { u: width, v: v0 + plateDepth, h },
      { u: width, v: v0 + plateDepth, h: h - PLATE_THICKNESS },
      { u: 0, v: v0 + plateDepth, h: h - PLATE_THICKNESS },
    ]
    const side: Vec[] = [
      { u: width, v: v0, h },
      { u: width, v: v0 + plateDepth, h },
      { u: width, v: v0 + plateDepth, h: h - PLATE_THICKNESS },
      { u: width, v: v0, h: h - PLATE_THICKNESS },
    ]
    const railTop = v0 + railV0
    const railBottom = v0 + plateDepth - PLATE_PAD_FRONT
    const railMid = railTop + RAIL_DEPTH / 2
    const gutter: Vec[] = [
      { u: 0, v: railTop, h },
      { u: gutterWidth - 12, v: railTop, h },
      { u: gutterWidth - 12, v: railBottom, h },
      { u: 0, v: railBottom, h },
    ]
    const rackRails = racks.map((rack) => ({
      rack,
      quad: [
        { u: rack.start - BAR_GAP / 2, v: railTop, h },
        { u: rack.end + RACK_GUTTER, v: railTop, h },
        { u: rack.end + RACK_GUTTER, v: railBottom, h },
        { u: rack.start - BAR_GAP / 2, v: railBottom, h },
      ] as Vec[],
    }))
    const flagV = v0 + PLATE_PAD_BACK + BAR_DEPTH + RAIL_DEPTH / 2
    const flagPad: Vec[] = [
      { u: FLAG_INSET_U - FLAG_PAD_HALF_U, v: flagV - FLAG_PAD_HALF_V, h },
      { u: FLAG_INSET_U + FLAG_PAD_HALF_U, v: flagV - FLAG_PAD_HALF_V, h },
      { u: FLAG_INSET_U + FLAG_PAD_HALF_U, v: flagV + FLAG_PAD_HALF_V, h },
      { u: FLAG_INSET_U - FLAG_PAD_HALF_U, v: flagV + FLAG_PAD_HALF_V, h },
    ]
    return {
      layer,
      width,
      v0,
      h,
      top,
      front,
      side,
      gutter,
      rackRails,
      railMid,
      label: { u: FLAG_INSET_U, v: flagV, h } as Vec,
      flag: { u: FLAG_INSET_U, v: flagV, h: h + FLAG_POLE } as Vec,
      flagPad,
    }
  })

  const rawBars = args.modules.map((module) => {
    const slot = slots.get(module.id)!
    const height = barHeight(degrees[module.id] ?? 0)
    const vc = slot.vc
    const uc = slot.uc
    const halfU = slot.length / 2
    const halfV = BAR_DEPTH / 2
    const base = -slot.layer * STEP_H
    const floors = Math.max(BAR_MIN_FLOORS, Math.round(height / FLOOR_HEIGHT))
    const plinth = Math.min(PLINTH_HEIGHT, height / 5)
    const bodyBottom = base + plinth
    const bodyTop = base + height
    const frontV = vc + halfV
    const sideU = uc + halfU
    const roof: Vec[] = [
      { u: uc - halfU, v: vc - halfV, h: bodyTop },
      { u: uc + halfU, v: vc - halfV, h: bodyTop },
      { u: uc + halfU, v: vc + halfV, h: bodyTop },
      { u: uc - halfU, v: vc + halfV, h: bodyTop },
    ]
    const front: Vec[] = [
      { u: uc - halfU, v: frontV, h: bodyTop },
      { u: uc + halfU, v: frontV, h: bodyTop },
      { u: uc + halfU, v: frontV, h: bodyBottom },
      { u: uc - halfU, v: frontV, h: bodyBottom },
    ]
    const side: Vec[] = [
      { u: sideU, v: vc - halfV, h: bodyTop },
      { u: sideU, v: vc + halfV, h: bodyTop },
      { u: sideU, v: vc + halfV, h: bodyBottom },
      { u: sideU, v: vc - halfV, h: bodyBottom },
    ]
    const bandsFront: Vec[][] = []
    const bandsSide: Vec[][] = []
    for (let i = 1; i <= BANDS_PER_FACADE; i += 1) {
      const h = bodyBottom + ((bodyTop - bodyBottom) * i) / (BANDS_PER_FACADE + 1)
      bandsFront.push(
        [
          { u: uc - halfU + 2, v: frontV, h },
          { u: uc + halfU - 2, v: frontV, h },
          { u: uc + halfU - 2, v: frontV, h: h - 1.4 },
          { u: uc - halfU + 2, v: frontV, h: h - 1.4 },
        ] as Vec[],
      )
      bandsSide.push(
        [
          { u: sideU, v: vc - halfV + 2, h },
          { u: sideU, v: vc + halfV - 2, h },
          { u: sideU, v: vc + halfV - 2, h: h - 1.4 },
          { u: sideU, v: vc - halfV + 2, h: h - 1.4 },
        ] as Vec[],
      )
    }
    const parapetFront: Vec[] = [
      { u: uc - halfU, v: frontV, h: bodyTop + 1.6 },
      { u: uc + halfU, v: frontV, h: bodyTop + 1.6 },
      { u: uc + halfU, v: frontV, h: bodyTop },
      { u: uc - halfU, v: frontV, h: bodyTop },
    ]
    const parapetSide: Vec[] = [
      { u: sideU, v: vc - halfV, h: bodyTop + 1.6 },
      { u: sideU, v: vc + halfV, h: bodyTop + 1.6 },
      { u: sideU, v: vc + halfV, h: bodyTop },
      { u: sideU, v: vc - halfV, h: bodyTop },
    ]
    const plinthFront: Vec[] = [
      { u: uc - halfU - 1, v: frontV + 1, h: bodyBottom },
      { u: uc + halfU + 1, v: frontV + 1, h: bodyBottom },
      { u: uc + halfU + 1, v: frontV + 1, h: base },
      { u: uc - halfU - 1, v: frontV + 1, h: base },
    ]
    const plinthSide: Vec[] = [
      { u: sideU + 1, v: vc - halfV - 1, h: bodyBottom },
      { u: sideU + 1, v: vc + halfV + 1, h: bodyBottom },
      { u: sideU + 1, v: vc + halfV + 1, h: base },
      { u: sideU + 1, v: vc - halfV - 1, h: base },
    ]
    const roofLine: Vec[] = [
      { u: uc + halfU, v: frontV, h: bodyTop + 1.6 },
      { u: uc + halfU, v: vc - halfV, h: bodyTop + 1.6 },
      { u: uc - halfU, v: vc - halfV, h: bodyTop + 1.6 },
    ]
    const lobe = slot.length >= LOBE_MIN_WIDTH ? { uc, vc, halfU: halfU - LOBE_INSET, halfV } : null
    const tower = lobe
      ? (() => {
          const towerTop = bodyTop + LOBE_TOP_STEP
          return {
            front: [
              { u: lobe.uc - lobe.halfU, v: lobe.vc + lobe.halfV, h: towerTop },
              { u: lobe.uc + lobe.halfU, v: lobe.vc + lobe.halfV, h: towerTop },
              { u: lobe.uc + lobe.halfU, v: lobe.vc + lobe.halfV, h: bodyTop },
              { u: lobe.uc - lobe.halfU, v: lobe.vc + lobe.halfV, h: bodyTop },
            ] as Vec[],
            side: [
              { u: lobe.uc + lobe.halfU, v: lobe.vc - lobe.halfV, h: towerTop },
              { u: lobe.uc + lobe.halfU, v: lobe.vc + lobe.halfV, h: towerTop },
              { u: lobe.uc + lobe.halfU, v: lobe.vc + lobe.halfV, h: bodyTop },
              { u: lobe.uc + lobe.halfU, v: lobe.vc - lobe.halfV, h: bodyTop },
            ] as Vec[],
            roof: [
              { u: lobe.uc - lobe.halfU, v: lobe.vc - lobe.halfV, h: towerTop },
              { u: lobe.uc + lobe.halfU, v: lobe.vc - lobe.halfV, h: towerTop },
              { u: lobe.uc + lobe.halfU, v: lobe.vc + lobe.halfV, h: towerTop },
              { u: lobe.uc - lobe.halfU, v: lobe.vc + lobe.halfV, h: towerTop },
            ] as Vec[],
          }
        })()
      : null
    const railMid = slot.layer * plateStep + PLATE_PAD_BACK + BAR_DEPTH + 10
    return {
      id: module.id,
      layer: slot.layer,
      width: slot.length,
      height,
      floors,
      roof,
      front,
      side,
      bandsFront,
      bandsSide,
      parapetFront,
      parapetSide,
      plinthFront,
      plinthSide,
      roofLine,
      tower,
      center: { u: uc, v: vc, h: bodyTop + (tower ? LOBE_TOP_STEP : 0) } as Vec,
      apex: { u: uc, v: vc, h: bodyTop + (tower ? LOBE_TOP_STEP : 0) } as Vec,
      label: { u: uc, v: railMid, h: base } as Vec,
      anchor: { u: uc, v: vc + halfV, h: base } as Vec,
      bottom: { u: uc - halfU, v: vc + halfV, h: base } as Vec,
    }
  })

  const all: Vec[] = []
  for (const terrace of rawTerraces) {
    all.push(...terrace.top, ...terrace.front, ...terrace.side, terrace.label, terrace.flag)
  }
  for (const bar of rawBars) {
    all.push(...bar.roof, ...bar.front, ...bar.side)
    if (bar.tower) all.push(...bar.tower.roof)
  }

  const lastTerrace = rawTerraces[rawTerraces.length - 1]!
  const lastV = (args.layers.length - 1) * plateStep + plateDepth
  const groundH = -(args.layers.length - 1) * STEP_H - PLATE_THICKNESS
  const groundFront = lastV + GROUND_FRONT
  const groundTop: Vec[] = [{ u: -GROUND_MARGIN, v: -GROUND_MARGIN, h: groundH }]
  for (const terrace of rawTerraces) {
    const isLast = terrace.layer === args.layers.length - 1
    groundTop.push({
      u: terrace.width + GROUND_MARGIN,
      v: terrace.layer === 0 ? -GROUND_MARGIN : terrace.v0 - PLATE_GAP / 2,
      h: groundH,
    })
    groundTop.push({
      u: terrace.width + GROUND_MARGIN,
      v: isLast ? groundFront : terrace.v0 + plateDepth + PLATE_GAP / 2,
      h: groundH,
    })
  }
  groundTop.push({ u: -GROUND_MARGIN, v: groundFront, h: groundH })
  const groundFace: Vec[] = [
    { u: lastTerrace.width + GROUND_MARGIN, v: groundFront, h: groundH },
    { u: -GROUND_MARGIN, v: groundFront, h: groundH },
    { u: -GROUND_MARGIN, v: groundFront, h: groundH - GROUND_THICKNESS },
    { u: lastTerrace.width + GROUND_MARGIN, v: groundFront, h: groundH - GROUND_THICKNESS },
  ]
  all.push(...groundTop, ...groundFace)
  const groundLip: Vec[] = [
    { u: lastTerrace.width + GROUND_MARGIN, v: groundFront, h: groundH },
    { u: -GROUND_MARGIN, v: groundFront, h: groundH },
  ]

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of all) {
    const q = project(p)
    minX = Math.min(minX, q.x)
    minY = Math.min(minY, q.y)
    maxX = Math.max(maxX, q.x)
    maxY = Math.max(maxY, q.y)
  }

  const offset = { x: -minX + LABEL_LEFT, y: -minY + MARGIN }
  const at = (p: Vec): Point => {
    const q = project(p)
    return { x: round(q.x + offset.x), y: round(q.y + offset.y) }
  }
  const poly = (points: readonly Vec[]): string =>
    points.map((p) => `${at(p).x},${at(p).y}`).join(' ')

  const terraces: TerraceShape[] = rawTerraces.map((terrace) => ({
    no: String(terrace.layer + 1).padStart(2, '0'),
    width: round(terrace.width),
    top: poly(terrace.top),
    front: poly(terrace.front),
    side: poly(terrace.side),
    label: at(terrace.label),
    flagBase: at(terrace.label),
    flagTop: at(terrace.flag),
    flagPad: poly(terrace.flagPad),
    rails: [
      { points: poly(terrace.gutter), cluster: '', tag: at(terrace.label) },
      ...terrace.rackRails.map((rail) => ({
        points: poly(rail.quad),
        cluster: rail.rack.cluster,
        tag: at({
          u: rail.rack.end + 10,
          v: terrace.v0 + PLATE_PAD_BACK + BAR_DEPTH / 2,
          h: terrace.h,
        }),
      })),
    ],
  }))

  const cubes: CubeShape[] = rawBars.map((bar) => ({
    id: bar.id,
    layer: bar.layer,
    roof: poly(bar.roof),
    front: poly(bar.front),
    side: poly(bar.side),
    bandsFront: bar.bandsFront.map(poly),
    bandsSide: bar.bandsSide.map(poly),
    tower: bar.tower
      ? {
          front: poly(bar.tower.front),
          side: poly(bar.tower.side),
          roof: poly(bar.tower.roof),
          parapetFront: poly(bar.parapetFront),
          parapetSide: poly(bar.parapetSide),
          plinthFront: poly(bar.plinthFront),
          plinthSide: poly(bar.plinthSide),
          roofLine: poly(bar.roofLine),
        }
      : null,
    height: bar.height,
    width: bar.width,
    floors: bar.floors,
    dot: at(bar.center),
    roofCenter: at(bar.apex),
    label: at(bar.label),
    anchor: at(bar.anchor),
    bottom: at(bar.bottom),
  }))

  const byId = new Map(cubes.map((cube) => [cube.id, cube]))
  const edges: AtlasEdgeShape[] = []
  for (const edge of args.edges) {
    const a = byId.get(edge.from)
    const b = byId.get(edge.to)
    if (!a || !b) continue
    const start = { x: a.roofCenter.x, y: a.roofCenter.y }
    const end = { x: b.roofCenter.x, y: b.roofCenter.y }
    const span = Math.hypot(end.x - start.x, end.y - start.y)
    const rise = round(
      Math.min(
        CABLE_RISE_MAX,
        Math.max(CABLE_RISE_MIN, span * CABLE_RISE_PER_SPAN),
        span * CABLE_RISE_SPAN_CAP + CABLE_RISE_SPAN_FLOOR,
      ),
    )
    const liftStart = round(start.y - rise)
    const liftEnd = round(end.y - rise)
    edges.push({
      from: edge.from,
      to: edge.to,
      kind: edge.kind,
      d: `M${start.x} ${start.y} C${start.x} ${liftStart} ${end.x} ${liftEnd} ${end.x} ${end.y}`,
      head: `M${round(end.x - CABLE_HEAD_HALF)} ${round(end.y - CABLE_HEAD_SPAN)} L${end.x} ${round(end.y - CABLE_HEAD_DROP)} L${round(end.x + CABLE_HEAD_HALF)} ${round(end.y - CABLE_HEAD_SPAN)}`,
      start,
      end,
      depth: round(a.roofCenter.y + a.height + b.roofCenter.y + b.height),
    })
  }
  edges.sort((left, right) => left.depth - right.depth)

  const laneShift = project({ u: 0, v: LABEL_LANE_V, h: 0 })

  const width = round(maxX - minX + LABEL_LEFT + MARGIN)
  const height = round(maxY - minY + MARGIN * 2)

  return {
    width,
    height,
    ground: { top: poly(groundTop), front: poly(groundFace), lip: poly(groundLip) },
    terraces,
    cubes,
    edges,
    degrees,
    lane: { x: round(laneShift.x), y: round(laneShift.y) },
  }
}
