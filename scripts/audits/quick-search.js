async (page) => {
  await page.goto('http://localhost:4175/agents/1011')
  await page.waitForTimeout(1200)
  await page.keyboard.press('Control+k')
  await page.waitForTimeout(700)
  await page.keyboard.type('anby')
  await page.waitForTimeout(500)
  const r = await page.evaluate(() => ({
    rows: [...document.querySelectorAll('.qs-row')].map((x) => ({
      name: x.querySelector('.qs-name')?.textContent.trim(),
      marks: [...x.querySelectorAll('mark.qs-hit')].map((m) => m.textContent),
    })),
    activeRow: document.querySelector('.qs-row.on')?.querySelector('.qs-name')?.textContent.trim(),
  }))
  return JSON.stringify(r)
}
