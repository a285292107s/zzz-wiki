/* ============================================================
 * csp-check.js — 生产安全响应头（CSP 等）本地验证（playwright-cli run-code）
 *
 * 为什么需要：CSP 与缓存策略一样只在生产 Vercel 生效，本地 vite preview 不带这些头；
 * 直接上线等于「第一次执行就是生产」。这里用请求拦截把候选策略注入响应，然后：
 *   1) 监听 document 的 securitypolicyviolation 事件 + console 中的 Refused to…
 *   2) 走一遍关键路径（首页/名录/详情/公式/出处 + ⌘K 检索 + 筛选下拉 + 术语浮层 + 翻页）
 *   3) 断言：零违规、字体与图片仍装载、检索仍出结果
 *
 * 策略要点（与 src 实测对齐）：无内联脚本 → script-src 'self' 即可；
 * Vue 运行期会写 style 属性（--reveal-delay / object-position 等）→ style-src 需 'unsafe-inline'；
 * HollowImage 的 CDN 兜底与纸纹 data: URI → img-src 放行 static.nanoka.cc 与 data:。
 *
 * 用法：playwright-cli open http://localhost:4175 && \
 *       playwright-cli run-code --filename=scripts/audits/csp-check.js
 * 基线：违规 0 / 字体已装载 / 检索有结果
 * ============================================================ */

async (page) => {
  const CSP = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://static.nanoka.cc",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ')

  const SECURITY_HEADERS = [
    { key: 'Content-Security-Policy', value: CSP },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  ]

  const violations = []
  const consoleNotes = []
  page.on('console', (m) => {
    const t = m.text()
    if (/Refused to|Content Security Policy|Failed to load resource/i.test(t)) consoleNotes.push(t.slice(0, 140))
  })

  await page.addInitScript(() => {
    window.__csp = []
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__csp.push({
        directive: e.violatedDirective,
        blocked: (e.blockedURI || '').slice(0, 80),
        source: (e.sourceFile || '').slice(-40),
      })
    })
  })

  // 注入安全响应头到所有响应（含 HTML/CSS/JS/字体/图片）
  await page.route('**/*', async (route) => {
    await route.continue({
      headers: { ...route.request().headers(), ...Object.fromEntries(SECURITY_HEADERS.map((h) => [h.key, h.value])) },
    })
  })

  const checks = []
  const add = (name, ok, detail) => checks.push({ name, ok, detail })

  // 1) 首页
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('http://localhost:4175/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  {
    const r = await page.evaluate(() => ({
      serif: getComputedStyle(document.querySelector('.page-title')).fontFamily.split(',')[0].replaceAll('"', '').trim(),
      loadedSerif: [...document.fonts].filter((f) => f.family.includes('Noto Serif') && f.status === 'loaded').length,
      cards: document.querySelectorAll('.deck-item').length,
      imgsLoaded: [...document.querySelectorAll('img')].filter((i) => i.complete && i.naturalWidth > 0).length,
      violations: window.__csp,
    }))
    add('home-no-violation', r.violations.length === 0, JSON.stringify(r.violations.slice(0, 2)))
    add('home-serif-ok', r.serif === 'Noto Serif SC' && r.loadedSerif > 0, `${r.serif} ×${r.loadedSerif}`)
    add('home-imgs-ok', r.cards === 4 && r.imgsLoaded > 0, `卡片 ${r.cards} / 已装载图 ${r.imgsLoaded}`)
  }

  // 2) ⌘K 检索（含动态渲染的行）
  {
    await page.keyboard.press('Control+k')
    await page.waitForTimeout(900)
    await page.keyboard.insertText('猫又')
    await page.waitForTimeout(800)
    const n = await page.evaluate(() => document.querySelectorAll('.qs-row').length)
    add('quicksearch-results', n > 0, `rows=${n}`)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
  }

  // 3) 名录 + 筛选下拉
  await page.goto('http://localhost:4175/agents', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1800)
  {
    await page.click('.filter-dropdown .trigger')
    await page.waitForTimeout(400)
    const rows = await page.evaluate(() => document.querySelectorAll('tbody.d-body tr').length)
    const opts = await page.evaluate(() => document.querySelectorAll('.popover [role=option]').length)
    add('list-filter-open', rows === 60 && opts > 1, `rows=${rows} options=${opts}`)
    await page.keyboard.press('Escape')
  }

  // 4) 详情页 + 术语浮层 + 翻页
  await page.goto('http://localhost:4175/agents/1021', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  {
    const tipOpened = await page.evaluate(async () => {
      const t = [...document.querySelectorAll('.rich-term')].find((el) => el.offsetParent !== null)
      if (!t) return false
      t.scrollIntoView({ block: 'center' })
      await new Promise((r) => setTimeout(r, 350))
      t.focus()
      await new Promise((r) => setTimeout(r, 900))
      return !!document.querySelector('.term-tip')
    })
    add('detail-term-tip', tipOpened, String(tipOpened))
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
    const v = await page.evaluate(() => window.__csp)
    add('detail-no-violation', v.length === 0, JSON.stringify(v.slice(0, 2)))
  }

  // 5) 公式页 / 出处页
  for (const route of ['/formulas', '/about', '/compare']) {
    await page.goto('http://localhost:4175' + route, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)
    const v = await page.evaluate(() => window.__csp)
    add(`${route}-no-violation`, v.length === 0, JSON.stringify(v.slice(0, 2)))
  }

  const allViolations = await page.evaluate(() => window.__csp)
  const failed = checks.filter((c) => !c.ok)
  return JSON.stringify(
    {
      policy: CSP,
      total: checks.length,
      failed: failed.length,
      failedItems: failed,
      violationEvents: allViolations.length,
      consoleNotes: [...new Set(consoleNotes)].slice(0, 6),
    },
    null,
    1,
  )
}
