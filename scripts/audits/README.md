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
 * | regression-walk.js    | 19 项全站功能走查 | 19/19 |
 * | transfer-profile.js   | 分类传输体积 | 首页 imgs ≈175KB |
 * | quick-search.js       | ⌘K 检索链路端到端 | 全通过 |
 * | font-loading.js       | CJK 衬线生效 + 分片按需 | serif=Noto Serif SC |
 * | slider-keyboard.js    | 滑条键盘操作（8 实例） | 全部响应 |
 * | landmarks.js          | landmark/h1/alt 唯一性 | 每页各 1 |
 * | font-weight-calibration.js | CJK 衬线实际渲染字重标定 | 生产 = wght 500 实例 |
 * | axe-a11y.js          | axe-core 全量规则（8 路由 × 桌面/移动 16 组合） | 0 violations |
 * | axe-states.js        | 交互面板**展开态**的 axe（菜单/下拉/检索/浮层/空态） | 6 状态 0 violations |
 * | print-mode.js        | 打印（纸墨模式）：白纸黑字/外壳隐藏/内容保留 | 24/24 |
 * | forced-colors.js     | 高对比度模式：结构线/状态/滑条可见 | 8/8 |
 * | csp-check.js         | 生产安全响应头本地验证（拦截注入 CSP 后走关键路径） | 0 违规 |
 * | content-sweep.js     | 全站 238 页内容完整性（泄漏/空区块/断图/元信息） | 0 异常 |
 * | focus-visible.js     | 焦点可见性（逐 Tab 位，WCAG 2.4.7） | 121 停靠点 0 缺失 |
 * | typography-audit.js  | 排印合规（字号是否全在 --fs-* 尺度内、字体族、行宽） | 0 越轨 |
 * | interaction-states.js| 交互态完整性（逐元素强制 :hover/:active 比较视觉指纹） | 101 元素 0 缺失 |
 * | motion-audit.js      | 动效克制性（reduced-motion 覆盖、过长过渡、transition: all） | reduced 0 残留 |
 *
 * 新增审计：脚本导出 JSON（{ total, failed, failedItems } 风格），
 * 失败项必须带定位信息（tag/cls/几何），让下一轮修复不用重新考古。
 * ============================================================ */
