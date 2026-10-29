import { describe, expect, it } from 'vitest'
import { ATLAS_EDGES, ATLAS_JOURNEYS, ATLAS_LAYERS, ATLAS_MODULES } from '../src/domain/atlas'
import { barLength, layoutAtlas } from '../src/utils/isoAtlas'

const layout = layoutAtlas({
  modules: ATLAS_MODULES,
  edges: ATLAS_EDGES,
  layers: ATLAS_LAYERS,
})

function values(sequence: string): number[] {
  return sequence.split(/\s+/).flatMap((pair) => pair.split(',').map(Number))
}

function corners(sequence: string): { x: number; y: number }[] {
  const nums = values(sequence)
  const points: { x: number; y: number }[] = []
  for (let i = 0; i + 1 < nums.length; i += 2) points.push({ x: nums[i]!, y: nums[i + 1]! })
  return points
}

function inside(sequence: string, point: { x: number; y: number }): boolean {
  const points = corners(sequence)
  let hit = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]!
    const b = points[j]!
    if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      hit = !hit
    }
  }
  return hit
}

describe('atlas 数据', () => {
  it('每层都有模块，且模块编号唯一', () => {
    for (let layer = 0; layer < ATLAS_LAYERS.length; layer++) {
      expect(ATLAS_MODULES.filter((module) => module.layer === layer).length).toBeGreaterThan(0)
    }
    const ids = new Set(ATLAS_MODULES.map((module) => module.id))
    expect(ids.size).toBe(ATLAS_MODULES.length)
    const numbers = new Set(ATLAS_MODULES.map((module) => module.no))
    expect(numbers.size).toBe(ATLAS_MODULES.length)
  })

  it('每条连线两端都是已登记的模块', () => {
    const ids = new Set(ATLAS_MODULES.map((module) => module.id))
    for (const edge of ATLAS_EDGES) {
      expect(ids.has(edge.from)).toBe(true)
      expect(ids.has(edge.to)).toBe(true)
      expect(edge.from).not.toBe(edge.to)
    }
  })

  it('体量分四档，且没有孤立模块', () => {
    for (const module of ATLAS_MODULES) {
      expect(module.weight).toBeGreaterThanOrEqual(1)
      expect(module.weight).toBeLessThanOrEqual(4)
      expect(module.paths.length).toBeGreaterThan(0)
    }
    const linked = new Set(ATLAS_EDGES.flatMap((edge) => [edge.from, edge.to]))
    for (const module of ATLAS_MODULES) expect(linked.has(module.id)).toBe(true)
  })
})

describe('atlas 导览', () => {
  it('每条导览的相邻两站之间真有连线', () => {
    const ids = new Set(ATLAS_MODULES.map((module) => module.id))
    const keys = new Set(ATLAS_EDGES.map((edge) => edge.from + '>' + edge.to))
    expect(ATLAS_JOURNEYS.length).toBeGreaterThan(0)
    for (const journey of ATLAS_JOURNEYS) {
      expect(journey.chain.length).toBeGreaterThan(2)
      for (const id of journey.chain) expect(ids.has(id)).toBe(true)
      for (let i = 0; i < journey.chain.length - 1; i += 1) {
        expect(keys.has(journey.chain[i] + '>' + journey.chain[i + 1])).toBe(true)
      }
    }
    const starts = new Set(ATLAS_JOURNEYS.map((journey) => journey.id))
    expect(starts.size).toBe(ATLAS_JOURNEYS.length)
  })
})

describe('layoutAtlas', () => {
  it('六层台子、每格一块、每条连线一条曲线', () => {
    expect(layout.terraces).toHaveLength(ATLAS_LAYERS.length)
    expect(layout.cubes).toHaveLength(ATLAS_MODULES.length)
    expect(layout.edges).toHaveLength(ATLAS_EDGES.length)
    expect(layout.width).toBeGreaterThan(0)
    expect(layout.height).toBeGreaterThan(0)
  })

  it('所有点串都是有限数，且落在画布内', () => {
    expect(values(layout.ground.top).length).toBeGreaterThan(6)
    expect(values(layout.ground.front).length).toBe(8)
    expect(values(layout.ground.lip).length).toBe(4)
    for (const sequence of [layout.ground.top, layout.ground.front, layout.ground.lip]) {
      const nums = values(sequence)
      expect(nums.every((n) => Number.isFinite(n))).toBe(true)
    }
    for (const terrace of layout.terraces) {
      for (const sequence of [terrace.top, terrace.front, terrace.side, terrace.flagPad]) {
        const nums = values(sequence)
        expect(nums.every((n) => Number.isFinite(n))).toBe(true)
      }
      expect(terrace.width).toBeGreaterThan(0)
    }
    for (const cube of layout.cubes) {
      for (const sequence of [cube.roof, cube.front, cube.side, ...cube.bandsFront, ...cube.bandsSide]) {
        const nums = values(sequence)
        expect(nums.every((n) => Number.isFinite(n))).toBe(true)
      }
      expect(cube.dot.x).toBeGreaterThan(0)
      expect(cube.dot.y).toBeGreaterThan(0)
    }
    for (const edge of layout.edges) expect(edge.d).not.toMatch(/NaN|Infinity/)
  })

  it('连线一律从楼顶中心竖直起飞，落到另一座楼的楼顶中心', () => {
    for (const edge of layout.edges) {
      const nums = edge.d.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
      const [sx, sy, c1x, c1y, c2x, c2y, ex, ey] = nums as [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
      ]
      expect(edge.d.startsWith('M')).toBe(true)
      expect([sx, sy, ex, ey]).toEqual([edge.start.x, edge.start.y, edge.end.x, edge.end.y])
      expect(c1x).toBe(sx)
      expect(c2x).toBe(ex)
      expect(c1y).toBeLessThan(sy)
      expect(c2y).toBeLessThan(ey)
      const span = Math.hypot(ex - sx, ey - sy)
      expect(sy - c1y).toBeGreaterThan(25.5)
      expect(sy - c1y).toBeLessThan(62.5)
      expect(sy - c1y).toBeLessThanOrEqual(span * 1.1 + 12.2)
    }
  })

  it('箭头画在终点正上方，方向朝下', () => {
    for (const edge of layout.edges) {
      const nums = edge.head.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
      const [left, top, midX, midY, right, rightY] = nums as [
        number,
        number,
        number,
        number,
        number,
        number,
      ]
      expect(left).toBeLessThan(midX)
      expect(right).toBeGreaterThan(midX)
      expect(rightY).toBe(top)
      expect(midX).toBe(edge.end.x)
      expect(midY).toBeGreaterThan(top)
      expect(edge.end.y - midY).toBeGreaterThan(0)
      expect(edge.end.y - midY).toBeLessThanOrEqual(5)
    }
  })

  it('连线按远近排序，远处的先画', () => {
    const depths = layout.edges.map((edge) => edge.depth)
    expect(depths).toEqual([...depths].sort((a, b) => a - b))
    expect(depths.every((depth) => Number.isFinite(depth))).toBe(true)
  })

  it('地面托在最低一层下面，旗子插在自己那层的台面上', () => {
    const bottomOf = (sequence: string): number => Math.max(...values(sequence).filter((_, i) => i % 2 === 1))
    const groundBottom = bottomOf(layout.ground.top)
    for (const terrace of layout.terraces) {
      expect(groundBottom, `${terrace.no} 台子伸到地面以下`).toBeGreaterThan(bottomOf(terrace.top))
      expect(inside(terrace.top, terrace.flagBase), `${terrace.no} 旗杆不在台面上`).toBe(true)
      const pad = corners(terrace.flagPad)
      const center = {
        x: pad.reduce((sum, point) => sum + point.x, 0) / pad.length,
        y: pad.reduce((sum, point) => sum + point.y, 0) / pad.length,
      }
      expect(Math.hypot(center.x - terrace.flagBase.x, center.y - terrace.flagBase.y)).toBeLessThan(1)
      for (const point of pad) {
        expect(inside(terrace.top, point), `${terrace.no} 旗座出界`).toBe(true)
      }
    }
    expect(corners(layout.ground.top).length).toBeGreaterThan(ATLAS_LAYERS.length * 2)
  })

  it('楼高只由连线数决定，楼的宽度只由体量档决定', () => {
    for (const a of layout.cubes) {
      for (const b of layout.cubes) {
        if ((layout.degrees[a.id] ?? 0) === (layout.degrees[b.id] ?? 0)) expect(a.height).toBe(b.height)
        const weightA = ATLAS_MODULES.find((module) => module.id === a.id)!.weight
        const weightB = ATLAS_MODULES.find((module) => module.id === b.id)!.weight
        if (weightA === weightB) expect(a.width).toBe(b.width)
        if (weightA > weightB) expect(a.width).toBeGreaterThan(b.width)
      }
    }
    expect(barLength(4)).toBeGreaterThan(barLength(1))
  })

  it('每栋楼都有楼层、腰线与女儿墙，宽的楼顶还叠一层塔冠', () => {
    for (const cube of layout.cubes) {
      expect(cube.floors).toBeGreaterThanOrEqual(2)
      expect(cube.bandsFront).toHaveLength(cube.bandsSide.length)
      for (const sequence of [cube.roof, ...cube.bandsFront, ...cube.bandsSide]) {
        expect(values(sequence).every((n) => Number.isFinite(n))).toBe(true)
      }
      if (!cube.tower) continue
      for (const sequence of [
        cube.tower.roof,
        cube.tower.front,
        cube.tower.side,
        cube.tower.plinthFront,
        cube.tower.plinthSide,
        cube.tower.parapetFront,
        cube.tower.parapetSide,
        cube.tower.roofLine,
      ]) {
        expect(values(sequence).every((n) => Number.isFinite(n))).toBe(true)
      }
    }
    expect(layout.cubes.filter((cube) => cube.tower).length).toBeGreaterThan(0)
  })

  it('台子宽度跟着这层的体量排：核心最宽，入口与壳最窄', () => {
    const widths = layout.terraces.map((terrace) => terrace.width)
    const core = ATLAS_LAYERS.findIndex((layer) => layer.id === 'core')
    const boot = ATLAS_LAYERS.findIndex((layer) => layer.id === 'boot')
    expect(widths[core]).toBe(Math.max(...widths))
    expect(widths[boot]).toBe(Math.min(...widths))
  })

  it('每块都落在自己那层台子的宽度以内', () => {
    for (const cube of layout.cubes) {
      const terrace = layout.terraces[cube.layer]!
      const nums = values(cube.roof)
      const minX = Math.min(...nums.filter((_, i) => i % 2 === 0))
      const maxX = Math.max(...nums.filter((_, i) => i % 2 === 0))
      const plate = values(terrace.top)
      const plateMin = Math.min(...plate.filter((_, i) => i % 2 === 0))
      const plateMax = Math.max(...plate.filter((_, i) => i % 2 === 0))
      expect(minX).toBeGreaterThan(plateMin)
      expect(maxX).toBeLessThan(plateMax)
    }
  })
})
