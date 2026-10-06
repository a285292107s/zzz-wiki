/* ============================================================
 * forced-colors.js — 高对比度模式（Windows HCM / forced-colors: active）审计
 *
 * 系统在 HCM 下会把作者颜色强制映射为 Canvas/CanvasText 等系统色，于是：
 *   - 「用底色当发丝线」的构造（网格 gap + 底色）会与页面同色 ⇒ 整条消失
 *   - 纯底色表示「选中/当前项」的状态一并消失
 *   - 滑条轨道/刻度为纯底色 ⇒ 不可见
 * 本脚本用 playwright 的 forcedColors 模拟逐项验证修复结果。
 *
 * 判据（详情页 + 名录页）：
 *   1) 画布为白、正文为黑（系统映射生效）
 *   2) 档案网格线 / 区块细线 / 滑条刻度 ≠ 画布色（结构可见）
 *   3) 网格单元 = 画布色（否则糊成实心块）
 *   4) 下拉选中项 / 检索当前行有实线描边（outline-style: solid）
 *
 * 用法：playwright-cli open http://localhost:4175 && \
 *       playwright-cli run-code --filename=scripts/audits/forced-colors.js
 * 基线：7/7 通过
 * ============================================================ */

async (page) => {
  const checks = []
  const add = (name, ok, detail) => checks.push({ name, ok, detail })

  await page.goto('http://localhost:4175/agents/1011', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  await page.emulateMedia({ forcedColors: 'active' })
  await page.waitForTimeout(300)
  {
    const r = await page.evaluate(() => {
      const bg = (sel) => {
        const el = document.querySelector(sel)
        return el ? getComputedStyle(el).backgroundColor : 'missing'
      }
      return {
        canvas: bg('body'),
        dossier: bg('.dossier'),
        dItem: bg('.d-item'),
        rule: bg('.section-head .rule'),
        tick: bg('.mark .tick'),
        breakTick: bg('.mark.is-break .tick'),
      }
    })
    add('canvas-white', r.canvas === 'rgb(255, 255, 255)', r.canvas)
    add('dossier-line-visible', r.dossier !== r.canvas && r.dossier !== 'missing', r.dossier)
    add('dossier-cell-canvas', r.dItem === 'rgb(255, 255, 255)', r.dItem)
    add('section-rule-visible', r.rule !== r.canvas && r.rule !== 'missing', r.rule)
    add('slider-tick-visible', r.tick !== r.canvas && r.tick !== 'missing', r.tick)
    add('slider-break-tick-highlight', r.breakTick !== r.canvas && r.breakTick !== 'missing', r.breakTick)
  }
  await page.emulateMedia({ forcedColors: 'none' })

  await page.goto('http://localhost:4175/agents', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1600)
  await page.emulateMedia({ forcedColors: 'active' })
  await page.waitForTimeout(200)
  await page.click('.filter-dropdown .trigger')
  await page.waitForTimeout(300)
  {
    const opt = await page.evaluate(() => {
      const el = document.querySelector('.opt.selected')
      return el ? getComputedStyle(el).outline : 'missing'
    })
    add('selected-option-outline', /solid/.test(opt), opt)
  }
  await page.keyboard.press('Escape')

  await page.keyboard.press('Control+k')
  await page.waitForTimeout(1200)
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(300)
  {
    const row = await page.evaluate(() => {
      const el = document.querySelector('.qs-row.on')
      return el ? getComputedStyle(el).outline : 'no-active-row'
    })
    add('quicksearch-active-outline', /solid/.test(row), row)
  }
  await page.keyboard.press('Escape')
  await page.emulateMedia({ forcedColors: 'none' })

  const failed = checks.filter((c) => !c.ok)
  return JSON.stringify({ total: checks.length, failed: failed.length, failedItems: failed }, null, 1)
}
