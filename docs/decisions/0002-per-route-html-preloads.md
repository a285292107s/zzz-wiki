# 决策记录 0002：逐路由 HTML 注入三项预载

Status: implemented
Class: process

## Problem

本站是 SPA。搜索引擎与社交爬虫拿到的 `dist/index.html` 必须由构建期逐路由生成
（`npm run route-html`），否则所有页面共享同一份 head 元信息。

但「逐路由 HTML」还顺带解决了一个**性能**问题：SPA 里 hero 图、详情 JSON、路由 chunk 都要等
入口 JS 下载并执行后才发起请求。慢速网络下，这些请求会比 HTML 到达晚 1.5–4 秒——而它们恰恰是
首屏内容。逐路由 HTML 在**解析期**就知道当前路由要什么，可以提前发起。

## Decision

生成器按路由写入三类预载，插入点固定在 `<link rel="preload" href="/data/manifest.json">` 之前
（`scripts/generate-route-html.mjs`）：

1. **hero 图** — `<link rel="preload" as="image" ... fetchpriority="low">`，
   按 `media` 断点区分 mobile / full。
   **`fetchpriority="low"` 是关键**：默认预载是 High 优先级，会与关键 JS 抢带宽——实测图片确实早到
   2.3 秒，但 LCP 没有改善。
2. **详情 JSON** — `<link rel="preload" as="fetch" ... crossorigin>`。
   `crossorigin` **必须带**，否则与后续 `fetch` 的凭据模式不匹配，会重复下载。
3. **路由 chunk** — `<link rel="modulepreload">`，含该路由的视图 chunk **及其静态依赖**
   （不含入口 `index.html`）。因为视图是动态 `import()`，不预载就要等入口 JS 跑完才发现它。
   该路由的 chunk 映射漂移会在构建期直接报错。

## Alternatives considered

**不预载。** 否决：请求起止时序实测整体晚 1.5–4 秒。

**预载但用默认（High）优先级。** 否决：与关键 JS 争抢同一条链路，图片确实早到 2.3 秒，
但 **LCP 无改善**——所以「图片更早」本身不是收益，`fetchpriority="low"` 才是。

**只靠 LCP 数值判断要不要预载。** 否决：单项收益被 ±300ms 的测量噪声淹没，判不出差异。
必须看**请求起止时序**（这也是 `QUALITY.md` §1 强调「LCP 两个口径必须分清」的同源教训）。

**在 HTML 里静态预取全部路由的 chunk。** 否决：会把整站 JS 推到首屏，与懒加载的目的相反。

## Consequences

- **代价**：`generate-route-html.mjs` 承担了元信息替换之外的第二个职责（性能注入），
  复杂度上升；且它必须读 build manifest 才能算出 chunk 依赖图。
- **收益**：慢网下首屏关键请求从「等 JS 引导」变成「HTML 解析期发起」；实测数字与结论记录在本记录
  与脚本头部注释中。
- **遗留缺口**：`content-sweep` 等审计脚本**必须先 `npm run build:ci`**（不是 `npm run build`），
  否则 `dist/` 里没有逐路由 HTML 与 sitemap，脚本会静默扫 0 页（已加负向防护，
  见 `scripts/audits/README.md`）。

> 相关：`QUALITY.md` §1 记录了首访 LCP 的测量口径（新上下文 + 禁 SW + 禁缓存三件套）。
> 本记录的理由说明同时保留在 `scripts/generate-route-html.mjs` 的代码注释里。
