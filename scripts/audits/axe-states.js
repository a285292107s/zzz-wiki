/* ============================================================
 * axe-states.js — 交互面板「展开态」的 axe 审计（playwright-cli run-code）
 *
 * 现有 axe-a11y.js 只审计页面默认态；而对话框 / listbox / 浮层 / 移动菜单这类
 * 动态结构只在展开后存在——它们的 ARIA 组合、焦点可见性、对比度从未被覆盖。
 * 本脚本逐个打开交互面并在该状态下跑全量 axe。
 *
 * 覆盖：移动菜单、筛选下拉（listbox）、检索面板（dialog）、术语浮层、双形态切换钮。
 * 用法：playwright-cli open http://localhost:4175 && \
 *       playwright-cli run-code --filename=scripts/audits/axe-states.js
 * 基线：各状态 0 violations
 * ============================================================ */

async (page) => {
  const states = []

  /** 在给定状态下跑 axe；openFn 负责把界面切到该状态 */
  const audit = async (state, { route, viewport, openFn, expect, closeFn }) => {
    await page.setViewportSize(viewport ?? { width: 1440, height: 900 })
    await page.goto('http://localhost:4175' + route, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1800)
    const opened = await openFn(page)
    const present = await page.evaluate((sel) => (sel ? !!document.querySelector(sel) : true), expect ?? null)
    await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' })
    const violations = await page.evaluate(async () => {
      const r = await window.axe.run(document, { resultTypes: ['violations'] })
      return r.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.length,
        target: v.nodes[0]?.target?.join(' ').slice(0, 60),
      }))
    })
    states.push({ state, route, opened, expectPresent: present, violations })
    if (closeFn) await closeFn(page)
  }

  // 1) 移动菜单展开（窄屏）
  await audit('mobile-menu', {
    route: '/',
    viewport: { width: 412, height: 823 },
    openFn: async (p) => {
      await p.click('.menu-toggle')
      await p.waitForTimeout(500)
      return true
    },
    expect: '#mobile-nav',
    closeFn: async (p) => {
      await p.keyboard.press('Escape')
      await p.waitForTimeout(300)
    },
  })

  // 2) 筛选下拉展开（listbox + option）
  await audit('filter-listbox', {
    route: '/agents',
    openFn: async (p) => {
      await p.click('.filter-dropdown .trigger')
      await p.waitForTimeout(400)
      return true
    },
    expect: '.popover[role="listbox"]',
    closeFn: async (p) => {
      await p.keyboard.press('Escape')
      await p.waitForTimeout(300)
    },
  })

  // 3) 检索面板展开（dialog + 结果行）
  await audit('quick-search', {
    route: '/agents',
    openFn: async (p) => {
      await p.keyboard.press('Control+k')
      await p.waitForTimeout(900)
      await p.keyboard.insertText('波')
      await p.waitForTimeout(800)
      return true
    },
    expect: '.qs-scrim',
    closeFn: async (p) => {
      await p.keyboard.press('Escape')
      await p.waitForTimeout(300)
    },
  })

  // 4) 术语浮层展开（键盘聚焦路径：聚焦术语锚点即触发显示，比鼠标悬停稳）。
  //    注：并非每个详情页都有术语锚点——/agents/1021 实测 4 个（1011 为 0），
  //    路由须选带锚点的页面，否则该状态会「静默空跑」。
  await audit('term-tip', {
    route: '/agents/1021',
    openFn: async (p) => {
      return await p.evaluate(async () => {
        const t = [...document.querySelectorAll('.rich-term')].find((el) => el.offsetParent !== null)
        if (!t) return false
        t.scrollIntoView({ block: 'center' })
        await new Promise((r) => setTimeout(r, 400))
        t.focus()
        await new Promise((r) => setTimeout(r, 900))
        return !!document.querySelector('.term-tip')
      })
    },
    expect: '.term-tip',
    closeFn: async (p) => {
      await p.keyboard.press('Escape')
      await p.waitForTimeout(300)
    },
  })

  // 5) 检索面板「无结果」空态（空态文案 / 提示按钮同样要过审）
  await audit('quick-search-empty', {
    route: '/agents',
    openFn: async (p) => {
      await p.keyboard.press('Control+k')
      await p.waitForTimeout(900)
      await p.keyboard.insertText('zzzzzz')
      await p.waitForTimeout(800)
      return true
    },
    expect: '.qs-scrim',
    closeFn: async (p) => {
      await p.keyboard.press('Escape')
      await p.waitForTimeout(300)
    },
  })

  // 5) 双形态切换（AgentHead 形态钮所在页）
  await audit('hero-form-toggle', {
    route: '/agents/1551',
    openFn: async (p) => {
      await p.waitForTimeout(600)
      return await p.evaluate(() => !!document.querySelector('.hero-form, .form-toggle, [aria-pressed]'))
    },
    expect: null,
  })

  const failed = states.filter((s) => s.violations.length > 0)
  return JSON.stringify(
    {
      statesChecked: states.length,
      statesWithViolations: failed.length,
      serious: failed.reduce((n, s) => n + s.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').length, 0),
      report: states,
    },
    null,
    1,
  )
}
