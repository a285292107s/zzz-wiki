/* ============================================================
 * audits/README.md — 量化审计脚本工具箱（playwright-cli run-code --filename）
 *
 * 每个脚本对应一项品质基线检查（基线数值见 quality-baseline.md）。
 * 运行前提：npm run build:ci && npm run preview（或等效静态服务 :4175）。
 *
 * | 脚本 | 检查项 | 基线 |
 * |---|---|---|
 * | viewport-overflow.js  | 8 视口 × 8 路由横向溢出 | 0 |
 * | touch-targets.js      | 交互目标 ≥24×24（WCAG 2.5.8） | 0 问题 |
 * | regression-walk.js    | 全站功能走查（73 项，覆盖七类目/边界态/URL 状态/离线联动） | 73/73 |
 * | transfer-profile.js   | 分类传输体积（逐文件 kb + 加载时刻） | 36 请求；最大 noto-serif-sc.css 68.9KB（解码值，gzip 后 ~10KB） |
 * | quick-search.js       | ⌘K 检索链路端到端（中文高亮/罗马字命中/结果态预激活/空态键盘路径） | 4/4 |
 * | font-loading.js       | CJK 衬线生效 + 分片按需 | serif=Noto Serif SC |
 * | slider-keyboard.js    | 滑条键盘操作（8 实例） | 全部响应 |
 * | landmarks.js          | landmark/h1/alt 唯一性 | 每页 h1/main/footer 各 1；无缺 alt 图（详情页含 2 个 `<header>`：页头 + 条目头，合法） |
 * | font-weight-calibration.js | CJK 衬线实际渲染字重标定 | 生产 = wght 500 实例 |
 * | axe-a11y.js          | axe-core 全量规则（12 路由 × 桌面/移动 24 组合） | 0 violations |
 * | axe-states.js        | 交互面板**展开态**的 axe（菜单/下拉/检索/浮层/空态） | 6 状态 0 violations |
 * | print-mode.js        | 打印（纸墨模式）：白纸黑字/外壳隐藏/内容保留 | 24/24 |
 * | forced-colors.js     | 高对比度模式：结构线/状态/滑条可见 | 8/8 |
 * | csp-check.js         | 生产安全响应头本地验证（拦截注入 CSP 后走关键路径） | 0 违规 |
 * | content-sweep.js     | 全站 238 页内容完整性（泄漏/空区块/断图/元信息） | 0 异常 |
 * | focus-visible.js     | 焦点可见性（逐 Tab 位，WCAG 2.4.7） | 121 停靠点 0 缺失 |
 * | typography-audit.js  | 排印合规（字号是否全在 --fs-* 尺度内、字体族、行宽） | 0 越轨 |
 * | interaction-states.js| 交互态完整性（逐元素强制 :hover/:active 比较视觉指纹） | 101 元素 0 缺失 |
 * | motion-audit.js      | 动效克制性（reduced-motion 覆盖、过长过渡、transition: all） | reduced 0 残留 |
 * | color-audit.js       | 色彩系统（调色板合规 / 文本 AA / 非文本 3:1） | 0 越轨，最差文本 4.65:1 |
 * | reflow-spacing.js    | WCAG 1.4.10 重排(320px) + 1.4.12 文本间距 + 320px 命中区 + 触屏档 | 0 溢出/0 裁切/0 过小目标 |
 * | keyboard-journey.js  | 键盘完整旅程（12 条任务，含焦点不被抢） | 12/12 |
 * | ax-tree.js           | 无障碍树（可访问名/标题层级/控件状态/图片名冗余） | 0 未命名，0 冗余 |
 * | inp-interaction.js   | 交互响应 INP 代理（4× CPU 节流，含长任务/TBT） | 最差 48–88ms（<100 竞奖档） |
 * | offline-check.js     | 离线阅读（SW 接管 → 断网重载 → 兜底页 → 缓存有界 → 回访零网络） | 7/7 |
 * | spacing-audit.js     | 版式节奏合规（严格门禁=版式级；容器级仅报告） | 版式级 0 越轨 |
 *
 * ⚠ **跑审计前必须 `npm run build:ci`**（不是 `npm run build`）：后者会清空 dist 且
 *   **不生成 sitemap / 逐路由 HTML**，`content-sweep` 这类读产物清单的脚本会静默地
 *   扫 0 页（曾据此误判）。产物清单以 sitemap 为单一来源。
 *
 * ⚠ **run-code 探针里不要在事件回调中抛异常**：`page.on` / `cdp.on` 的回调一旦抛错会
 *   直接让 playwright-cli 会话崩溃（"Session closed"，无堆栈）。需要计数请求时优先用
 *   `performance.getEntriesByType('resource')` 的 `transferSize` / `workerStart` 字段，
 *   而不是挂事件监听。
 *
 * ⚠ **Service Worker 会遮蔽「失败模拟」**（2026-10 引入离线能力后）：SW 自己发起的 fetch
 *   不经过 `page.route`，SW 脚本的注册请求也不经过——`route('**/sw.js', abort)` 无效。
 *   需要在「无 SW」前提下测失败/断网的检查，应另开 `serviceWorker: 'block'` 的上下文
 *   （见 `regression-walk.js` 的错误态检查段）。
 *
 * ⚠ **测离线必须用 `context.setOffline`**，不能用 CDP 的
 *   `Network.emulateNetworkConditions({offline:true})`：后者只作用于页面 target，
 *   **SW 自己发起的 fetch 不在其中**——SW 仍能联网取回真实页面，离线检查会因错误原因通过
 *   （`offline-check.js` 首版即如此，实测发现后改正）。
 *   同理，离线审计必须先**注销残留 SW + 清缓存**：浏览器配置跨审计复用，旧注册不重新拉取
 *   脚本就继续生效（负向验证时删掉 `dist/sw.js` 仍全绿，即因此）。
 *
 * 新增审计：脚本导出 JSON（{ total, failed, failedItems } 风格），
 * 失败项必须带定位信息（tag/cls/几何），让下一轮修复不用重新考古。
 * ============================================================ */
