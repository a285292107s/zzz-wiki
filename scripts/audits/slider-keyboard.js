async (page) => {
  // 逐个滑条键盘走查：8 个滑条（1 基础属性 + 7 技能）全部响应方向键且 valuetext 同步
  await page.goto('http://localhost:4175/agents/1011#skills', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2200)
  const result = await page.evaluate(async () => {
    const sliders = [...document.querySelectorAll('.level-range')]
    const out = []
    for (let i = 0; i < sliders.length; i++) {
      const s = sliders[i]
      s.focus()
      const before = Number(s.value)
      s.stepDown()
      s.dispatchEvent(new Event('input', { bubbles: true }))
      const after = Number(s.value)
      out.push({ i, before, after, delta: after - before, vt: s.getAttribute('aria-valuetext') })
    }
    return out
  })
  return JSON.stringify(result)
}
