# 决策记录 0022：收录治理——URL 形态归一、sitemap 去 lastmod、设置页 noindex

Status: implemented
Class: bug-fix

## Problem

2026-10-22 把生产域从 `myzzz.vercel.app` 切到 `myzzz.wiki` 后，GSC 网域资源出现三类未编入索引：

- **重复网页（8 条）**：8 个音擎详情页全被 Google 归并到 `/w-engines/13014` 名下。实测复现：
  「测试实际网址」第一次渲染有 2 个资源加载失败，控制台报动态 import 失败、页面只剩外壳；
  重测全部资源正常。抓取时刻（10-23）渲染成空壳是本次归并的直接原因。
- **已发现-尚未编入索引（166 条）**：165 个详情页 + `/disks` 名录页，从未被抓取。
- 站点自身还有三处会持续制造歧义：

1. 同一内容暴露多个 URL：`/agents/1011` 与 `/agents/1011/` 都 200；`/index.html`、`/agents/index.html` 也 200。
2. sitemap 每条 `<lastmod>` 都是构建当天——站点每日随数据同步重建，等于每天宣告 243 个页面全改过。
3. `/settings` 没有独立 HTML，静态兜底是共享 `index.html` 的 canonical `/`，内容却跟着本机偏好变，会被当成首页的重复页。

## Decision

- `vercel.json` 增加三条 308：`/index.html → /`、`/(.*)/index.html → /$1`、`/(.*)/ → /$1`。
  redirects 先于文件系统生效，故目录索引形式的尾斜杠 URL 也统一回到不带斜杠的形态。
- `vercel.json` 对 `/settings` 下发 `X-Robots-Tag: noindex`（页面本身仍是可用路由，只是不进索引）。
- `scripts/generate-sitemap.mjs` 不再写 `<lastmod>`：没有可靠的逐页修改时间时，宁可不声明。
- `scripts/verify-vercel-config.mjs` 把上述归一与 noindex 写成构建期断言——改掉配置会被 `build:ci` 拦下，
  不靠部署后线上试错（这些行为本地 `vite preview` 测不到）。

## Alternatives considered

- **保留 lastmod 写构建日**：每次重新部署都让全站「当天改过」，Google 会判定该字段不可信并忽略；
  更糟的是把抓取预算引向无变化的页面。删掉比写错更诚实。
- **lastmod 取数据文件的 git 提交时间**：日期真实，但依赖构建环境带完整 git 历史；Vercel 的浅克隆会给出
  错误的提交时间，且 243 页逐条 `git log` 拖慢构建。
- **改用 `trailingSlash` 配置**：只对能命中文件的路径生效，与「目录索引 + 兜底 rewrite」组合的行为不由它
  单独决定，且不可见；显式 redirect 规则可读、可被门禁断言。
- **`/settings` 用 meta noindex**：它没有独立 HTML，要改构建器单独生成一份设置页；响应头一行即可，
  不动构建链路。

## Consequences

- 收益：URL 空间收敛为单一形态；`/settings` 不再被当重复页；sitemap 不再逐日宣告全站更新；
  三条归一规则有构建期断言守着。
- 代价：尾斜杠 URL 多一跳 308；Google 失去 lastmod 的新鲜度信号（对内容低频变化的档案站影响很小）。
- 遗留缺口：不存在的路径仍由兜底 rewrite 返回 200（软 404），本次未动；详情页正文仍靠 JS 渲染——
  Google 渲染失败时同类「被归并」还会复发，根治需要构建期预渲染正文。
