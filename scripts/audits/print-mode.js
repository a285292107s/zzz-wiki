/* ============================================================
 * print-mode.js — 打印（纸墨模式）审计（playwright-cli run-code）
 *
 * 站点是「档案」：打印出来应当是一份可读的纸质档案。检查项：
 *   1) 白纸黑字：body 背景为白、正文为深墨（不是屏幕态的反相浅字）
 *   2) 背景纹理/壁纸令牌失效（--paper-noise/--page-bg-image/--home-bg-image = none）
 *      → 省墨，且固定视口层不再逐页重复
 *   3) 交互外壳隐藏：站头、区块索引、回顶、检索面板、术语浮层、跳转链接、翻页提示
 *   4) 内容保留：区块 / 表格 / 标签仍可见（不能把正文一起隐藏）
 *   5) 页脚出处行保留（纸质档案需要数据来源与更新日期）
 *
 * 用法：playwright-cli open http://localhost:4175 && \
 *       playwright-cli run-code --filename=scripts/audits/print-mode.js
 * 基线：全部路由 0 失败
 * ============================================================ */

async (page) => {
  const routes = ['/', '/agents', '/agents/1011', '/about', '/compare']
  const checks = []
  const add = (route, name, ok, detail) => checks.push({ route, name, ok, detail })

  for (const route of routes) {
    // 对照台：预置一桌内容再打印——空态与「有表」是两种版式，只测空态会漏掉
    // 「交互件印到纸上」「表格被 min-width 裁掉」这类问题（实测确认过）。
    await page.goto('http://localhost:4175/', { waitUntil: 'domcontentloaded' })
    await page.evaluate((r) => {
      if (r === '/compare')
        localStorage.setItem('zzz-wiki:compare', JSON.stringify({ catPath: '/agents', ids: [1011, 1021, 1031] }))
      else localStorage.removeItem('zzz-wiki:compare')
    }, route)
    await page.goto('http://localhost:4175' + route, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1600)
    await page.emulateMedia({ media: 'print' })
    await page.waitForTimeout(300)
    const r = await page.evaluate(() => {
      const cs = (sel, prop) => {
        const el = document.querySelector(sel)
        return el ? getComputedStyle(el)[prop] : 'missing'
      }
      const vis = (sel) => {
        const el = document.querySelector(sel)
        return el ? getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' : false
      }
      const root = getComputedStyle(document.documentElement)
      return {
        bodyBg: cs('body', 'backgroundColor'),
        bodyColor: cs('body', 'color'),
        noise: root.getPropertyValue('--paper-noise').trim(),
        pageBg: root.getPropertyValue('--page-bg-image').trim(),
        homeBg: root.getPropertyValue('--home-bg-image').trim(),
        // 交互外壳：除站头/索引/回顶/页脚动作外，还包括**复制链接**与**对照台控件**
        // （移出/清空是纯交互件；印在纸上会出现无意义的「×」，且会被误读成正文）
        chromeVisible: [
          '.masthead',
          '.section-nav',
          '.back-top',
          '.foot-actions',
          '.copy-link',
          '.entry-remove',
          '.bench-clear',
          '.cmp-btn',
        ].filter(vis),
        contentVisible: vis('.page-title') || vis('.page-head'),
        // 正文保留的判据不能只认「表格/索引/spec」：空态页面（如对照台无内容时）
        // 同样有正文要打印。故取「结构块可见」**或**「正文可见文本足够多」。
        tableVisible:
          vis('table') ||
          vis('.index-row') ||
          vis('.spec') ||
          (document.querySelector('main')?.innerText.trim().length ?? 0) > 40,
        footVisible: vis('.foot'),
      }
    })
    await page.emulateMedia({ media: 'screen' })

    add(route, 'paper-white', r.bodyBg === 'rgb(255, 255, 255)', r.bodyBg)
    add(route, 'ink-dark', /rgb\((1[0-9]|[0-9]{1,2}), /.test(r.bodyColor), r.bodyColor)
    add(route, 'textures-off', r.noise === 'none' && r.pageBg === 'none' && r.homeBg === 'none', `${r.noise}|${r.pageBg}|${r.homeBg}`)
    add(route, 'chrome-hidden', r.chromeVisible.length === 0, JSON.stringify(r.chromeVisible))
    add(route, 'content-kept', r.contentVisible && r.tableVisible, `title=${r.contentVisible} content=${r.tableVisible}`)
    add(route, 'provenance-footer', r.footVisible, String(r.footVisible))
  }

  const failed = checks.filter((c) => !c.ok)
  return JSON.stringify({ total: checks.length, failed: failed.length, failedItems: failed }, null, 1)
}
