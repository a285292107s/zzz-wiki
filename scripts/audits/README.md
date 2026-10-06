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
 *
 * 新增审计：脚本导出 JSON（{ total, failed, failedItems } 风格），
 * 失败项必须带定位信息（tag/cls/几何），让下一轮修复不用重新考古。
 * ============================================================ */
