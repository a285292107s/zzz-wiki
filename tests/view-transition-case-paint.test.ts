// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * 装裱壳关键帧的**隐式关键帧**约束（纯文本守卫，浏览器行为由 hero-flight.js 的 L/M 项兜）。
 *
 * 为什么值得一条单测：`vt-chrome-case` 是按「共享元素的所有祖先」标记的（首页 13 层），
 * 其中多数本身完全透明。关键帧一旦把起点/终点写死成整页底色（--bg-0 / --line-1），
 * 这些透明层就会被**凭空涂上一层整页底色** —— `.home` 盖住固定层拼贴壁纸、
 * `#app` 盖住 `body::before` 页面壁纸，退场淡出、落地淡入，观感是「背景闪了好几下」。
 * 这类改动在 CSS 里只是一行，评审时极难看出来，故在文本层面钉住。
 */
const CSS = readFileSync(new URL('../src/styles/base.css', import.meta.url), 'utf8')

/** 取出某个 @keyframes 的**平衡括号**区间（嵌套花括号要配对，不能只看第一个 }），并剥掉注释。
 *  必须剥注释：这些关键帧上方带大段说明文字（里面就有 from/to/--bg-0 字样），
 *  不剥会把注释当声明，断言全假阳性（本用例最初就栽在这里）。 */
function keyframesBody(name: string): string {
  const start = CSS.indexOf(`@keyframes ${name}`)
  expect(start, `base.css 里找不到 @keyframes ${name}`).toBeGreaterThan(-1)
  const open = CSS.indexOf('{', start)
  let depth = 0
  for (let i = open; i < CSS.length; i++) {
    if (CSS[i] === '{') depth += 1
    else if (CSS[i] === '}') {
      depth -= 1
      if (depth === 0) return CSS.slice(open + 1, i).replace(/\/\*[\s\S]*?\*\//g, '')
    }
  }
  throw new Error(`@keyframes ${name} 花括号不平衡`)
}

describe('装裱壳关键帧：只动元素自己的框，不给透明层凭空涂色', () => {
  it('vt-case-out 不写死整页底色（只写透明那一侧 = 隐式关键帧）', () => {
    const body = keyframesBody('vt-case-out')
    expect(body).not.toContain('--bg-0')
    expect(body).not.toContain('--line-1')
    // 仍要退到透明（壳的动作本身不能丢）
    expect(body).toContain('transparent')
  })

  it('vt-case-in 同样不写死整页底色', () => {
    const body = keyframesBody('vt-case-in')
    expect(body).not.toContain('--bg-0')
    expect(body).not.toContain('--line-1')
    expect(body).toContain('transparent')
  })

  it('两条关键帧各只写一侧（另一侧交给元素自身的计算值）', () => {
    // 两侧都写 = 又回到「给透明层凭空定色」；只写一侧才是 no-op 安全的
    const count = (body: string, token: string) => body.split(token).length - 1
    expect(count(keyframesBody('vt-case-out'), 'from')).toBe(0)
    expect(count(keyframesBody('vt-case-in'), 'to')).toBe(0)
  })
})
