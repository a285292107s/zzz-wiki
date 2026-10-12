// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * 生日飘带的**形状判据**：把组件里那两条 SVG path 解析成点，验证它们确实是「左端燕尾」。
 *
 * 为什么值得一条单测：凹口是要精确到 0.5px 的几何，而它在 1× 下只占几个像素 ——
 * 形状错了**肉眼完全看不出来**。上一版用「span + 两条伪元素 + rotate」表达凹口时真错过两处
 * （`rotate` 符号 + `::after` 的旋转原点）：上斜线朝外撇出本体 8px、下斜线绕错了角，
 * 两条根本不相交；当时是靠放大 10× 逐像素采样才发现的，而那种验法不会留在 CI 里。
 * 现在形状是显式坐标，**解析 + 验性质**这一步就等于把当年那条「看不见的错」挡在门外。
 *
 * 验的是形状性质而不是把字符串抄一遍：
 *   ① 剪影是燕尾：两个尖角在本体左缘的上下角，凹口尖在盒高一半处、且**向内**；
 *   ② 描边的凹口尖与剪影的凹口尖重合（只差半个描边宽的内缩）；
 *   ③ 描边右端**不封口**：上缘与下缘分属两条子路径，中间没有那一竖（否则与装裱框自己的
 *      1px 细线叠成 2px）；
 *   ④ 左端内缩恰好是描边宽的一半、描边宽 1px（细线语言：这枚标记永远是发丝线）；
 *   ⑤ 「生日」按**墨迹**对中在内容区（凹口尖 → 右缘），两侧留气口。
 */
const SRC = readFileSync(new URL('../src/components/home/FeaturedDeck.vue', import.meta.url), 'utf8')
const TOKENS = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8')

/** 取一条 CSS 规则的**平衡括号**区间并剥注释（样式表里有 @media 这类嵌套花括号）。
 *  选择器**行首锚定**：`.deck-ribbon-text {` 这个子串在 `.featured-deck.is-mounting .deck-ribbon-text {`
 *  里也出现，而那条规则在文件里更靠前 —— 用 indexOf 会取错块（断言会莫名其妙地说"缺声明"）。 */
function ruleBody(selector: string): string {
  const m = new RegExp(`^${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{`, 'm').exec(SRC)
  expect(m, `FeaturedDeck.vue 里找不到 ${selector} 规则`).not.toBeNull()
  const open = SRC.indexOf('{', m!.index)
  let depth = 0
  for (let i = open; i < SRC.length; i++) {
    if (SRC[i] === '{') depth += 1
    else if (SRC[i] === '}') {
      depth -= 1
      if (depth === 0) return SRC.slice(open + 1, i).replace(/\/\*[\s\S]*?\*\//g, '')
    }
  }
  throw new Error(`${selector} 花括号不平衡`)
}

function decl(body: string, prop: string): string {
  const m = new RegExp(`(?:^|[;{\\s])${prop}:\\s*([^;]+)`).exec(body)
  expect(m, `缺声明 ${prop}`).not.toBeNull()
  return m![1]!.trim()
}

/** 从模板里取某个 class 的 path 的 `d`（这两条 path 都是单行写法） */
function pathData(cls: string): string {
  const m = new RegExp(`<path class="${cls}" d="([^"]+)"`).exec(SRC)
  expect(m, `模板里找不到 .${cls} 的 path`).not.toBeNull()
  return m![1]!
}

/** 取 `<text class="deck-ribbon-text" …>` 的整段属性文本（属性是多行写的） */
function textAttrs(): string {
  const m = /<text\s+class="deck-ribbon-text"([\s\S]*?)>/.exec(SRC)
  expect(m, '模板里找不到 .deck-ribbon-text 的 text').not.toBeNull()
  return m![1]!
}

type Pt = { x: number; y: number }

/** 极简 SVG 路径解析器（只覆盖这里用到的 M/H/V/L/Z，绝对与相对都认）。
 *  返回子路径点列与用到的命令字母 —— 够验形状，且遇到不认识的命令会显式报错而不是静默漏点。 */
function parsePath(d: string): { subpaths: Pt[][]; cmds: string[] } {
  const toks = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)/g) ?? []
  const subpaths: Pt[][] = []
  const cmds: string[] = []
  let cur: Pt[] = []
  let x = 0
  let y = 0
  let sx = 0
  let sy = 0
  let i = 0
  const num = () => Number(toks[i++])
  while (i < toks.length) {
    const c = toks[i++]
    cmds.push(c)
    const rel = c !== c.toUpperCase()
    const C = c.toUpperCase()
    if (C === 'M') {
      if (cur.length) subpaths.push(cur)
      cur = []
      x = rel ? x + num() : num()
      y = rel ? y + num() : num()
      sx = x
      sy = y
      cur.push({ x, y })
    } else if (C === 'H') {
      x = rel ? x + num() : num()
      cur.push({ x, y })
    } else if (C === 'V') {
      y = rel ? y + num() : num()
      cur.push({ x, y })
    } else if (C === 'L') {
      x = rel ? x + num() : num()
      y = rel ? y + num() : num()
      cur.push({ x, y })
    } else if (C === 'Z') {
      cur.push({ x: sx, y: sy })
    } else {
      throw new Error(`路径解析器还不认命令 ${c}`)
    }
  }
  if (cur.length) subpaths.push(cur)
  return { subpaths, cmds }
}

const viewBox = /viewBox="([^"]+)"/.exec(SRC)!
const [VB_W, VB_H] = viewBox[1]!.trim().split(/\s+/).slice(2).map(Number) as [number, number]
const sil = parsePath(pathData('deck-ribbon-scrim'))
const line = parsePath(pathData('deck-ribbon-line'))
const sw = Number.parseFloat(decl(ruleBody('.deck-ribbon-line'), 'stroke-width'))

/** 凹口尖 = 左半边**最靠内**的那个点（x 最大）：剪影取到 (8,10)、描边取到 (8.5,10)。
 *  不能用「x 最小」—— 描边左缘内缩后，两个尖角也落在 x = 0.5，会被误当成尖。 */
const innerMost = (pts: Pt[]) => pts.filter((p) => p.x < VB_W / 2).sort((a, b) => b.x - a.x)[0]!
const apex = innerMost(sil.subpaths.flat())
const lineApex = innerMost(line.subpaths.flat())

describe('生日飘带：左端燕尾的 SVG 形状', () => {
  it('剪影是两个尖角 + 一个向内的凹口尖（燕尾成立）', () => {
    const pts = sil.subpaths.flat()
    expect(pts).toContainEqual({ x: 0, y: 0 })
    expect(pts).toContainEqual({ x: 0, y: VB_H })
    expect(apex).toBeDefined()
    expect(Math.abs(apex.y - VB_H / 2)).toBeLessThanOrEqual(0.5)
    expect(apex.x).toBeGreaterThan(1)
    expect(apex.x).toBeLessThan(VB_W / 4)
    // 剪影必须闭合，否则 fill 会漏成开放多边形
    expect(sil.cmds.join('')).toContain('Z')
  })

  it('描边的凹口尖与剪影重合（只差半个描边宽的内缩）', () => {
    expect(Math.abs(lineApex.x - apex.x)).toBeLessThanOrEqual(sw / 2 + 0.01)
    expect(Math.abs(lineApex.y - apex.y)).toBeLessThanOrEqual(sw / 2 + 0.01)
  })

  it('右端不封口：上缘与下缘分属两条子路径，中间没有那一竖', () => {
    expect(line.subpaths).toHaveLength(2)
    const top = line.subpaths[0]!
    const bottom = line.subpaths[1]!
    // 上缘：纯水平线（两点同 y），右端一直通到 viewBox 右缘
    expect(top).toHaveLength(2)
    expect(top[0]!.y).toBeCloseTo(top[1]!.y, 5)
    expect(Math.max(top[0]!.x, top[1]!.x)).toBeCloseTo(VB_W, 5)
    // 下缘：从右缘起笔 → 向左到左端 → 经凹口尖折回上左角
    expect(bottom[0]!.x).toBeCloseTo(VB_W, 5)
    expect(bottom[0]!.y).toBeCloseTo(VB_H - sw / 2, 5)
    expect(bottom[bottom.length - 1]).toEqual({ x: sw / 2, y: sw / 2 })
  })

  it('左端内缩恰好半个描边宽，且描边是 1px 发丝线', () => {
    expect(sw).toBe(1)
    const pts = line.subpaths.flat()
    expect(Math.min(...pts.map((p) => p.x))).toBeCloseTo(sw / 2, 5)
    expect(Math.min(...pts.map((p) => p.y))).toBeCloseTo(sw / 2, 5)
    expect(Math.max(...pts.map((p) => p.y))).toBeCloseTo(VB_H - sw / 2, 5)
    // 1px 描边整条落在 viewBox 内 → 两个尖角的外半像素不会被 SVG 视口切钝
    expect(Math.min(...pts.map((p) => p.x))).toBeGreaterThanOrEqual(sw / 2)
  })

  it('「生日」按墨迹对中在内容区（凹口尖 → 右缘），并留出两侧气口', () => {
    const text = textAttrs()
    const box = ruleBody('.deck-ribbon-text')
    const fs = Number.parseFloat(decl(TOKENS, '--fs-badge'))
    const track = Number.parseFloat(decl(box, 'letter-spacing')) * fs // 0.12em
    const x = Number.parseFloat(/x="([\d.]+)"/.exec(text)![1]!)
    // text-anchor="middle" 对的是**推进盒**，而人眼读到的是**墨迹**：本字体下墨迹中心比推进盒
    // 中心偏左约 1.2px（放大 10× 逐像素采样实测；按「末字字距的一半 = 0.54」去推会差 0.66px，
    // 因为推进盒怎么算字距各实现不一致）。换字体要重新量这个常数。
    const INK_OFFSET = 1.2
    const inkCenter = x - INK_OFFSET
    // 内容区的左界是**画出来的**那道凹口（描边的尖 8.5），不是剪影的 8
    expect(Math.abs(inkCenter - (lineApex.x + VB_W) / 2)).toBeLessThan(0.15)
    // 两个字 + 两侧字距要放得下，且两侧都留气口（不贴凹口尖、也不贴框缘）
    const advance = 2 * (fs + track)
    expect(advance).toBeLessThan(VB_W - lineApex.x)
    expect(x - advance / 2 - lineApex.x).toBeGreaterThan(4)
    expect(VB_W - (x + advance / 2)).toBeGreaterThan(4)
    // 方块字按 em 盒居中，而不是按西文基线（后者会整体偏上）
    expect(text).toContain('dominant-baseline="central"')
    expect(text).toContain('text-anchor="middle"')
  })
})
