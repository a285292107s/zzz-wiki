# audits/README.md — 量化审计脚本工具箱（playwright-cli run-code --filename）

每个脚本对应一项品质基线检查（基线数值见 QUALITY.md）。
运行前提：`npm run build:ci` && `npm run preview`——**本仓库的 `preview` 已固定 `--port 4175`**，下面的 27 个脚本全部指向 `http://localhost:4175`，端口必须一致，否则全套跑不起来。

**一条命令跑全套**：`npm run audit:all`（scripts/audit-all.mjs）——按下面的表格逐个执行、
汇总通过/失败/需人工判读，失败即非零退出。每个脚本的**通过判据显式声明**在该文件的
RULES 表里（不靠猜返回结构）；**新增审计脚本必须同时补判据**，否则会被标「？需人工判读」
而不会默认通过。`npm run audit` 仍只列清单（含各脚本一句话说明）。

| 脚本 | 检查项 | 基线 |
|---|---|---|
| viewport-overflow.js  | 8 视口 × 8 路由横向溢出 | 0 |
| touch-targets.js      | 交互目标 ≥24×24（WCAG 2.5.8） | 0 问题 |
| regression-walk.js    | 全站功能走查（**87 项**，覆盖七类目/边界态/URL 状态/离线联动）。名录/图谱的**条数不写死**：比对运行时数据文件真值（`live-data-readable` 先取真值，再断言「渲染条数 == 数据条数」），故 `npm run sync` 新增角色不会误报 | 87/87 |
| transfer-profile.js   | 首访传输预算（冷缓存总重 + 分类明细；总重 <3MB 竞奖档 / 字体 ≤1.2MB / 图片 ≤1MB） | 53 请求 / 751KB（js 61 + css 25 + 字体 189 + 图片 436 + json 40；**2026-10 实测，运行取当前值**） |
| quick-search.js       | ⌘K 检索链路端到端（中文高亮/罗马字命中/结果态预激活/空态键盘路径） | 4/4 |
| font-loading.js       | CJK 衬线生效 + 分片按需 | serif=Noto Serif SC |
| slider-keyboard.js    | 滑条键盘操作（8 实例） | 全部响应 |
| landmarks.js          | landmark/h1/alt 唯一性 | 每页 h1/main/footer 各 1；无缺 alt 图（详情页含 2 个 `<header>`：页头 + 条目头，合法） |
| font-weight-calibration.js | CJK 衬线实际渲染字重标定 | 生产 = wght 500 实例 |
| axe-a11y.js          | axe-core 全量规则（**15 路由 × 桌面/移动 = 30 组合**，含详情 404 态） | 0 violations |
| axe-states.js        | 交互面板**展开态**的 axe（窄屏检索直达区/下拉/检索/浮层/空态） | 6 状态 0 violations |
| print-mode.js        | 打印（纸墨模式）：白纸黑字/外壳隐藏/内容保留 | **30/30**（5 路由 × 6 断言） |
| forced-colors.js     | 高对比度模式：结构线/状态/滑条可见 | 8/8 |
| csp-check.js         | 生产安全响应头本地验证（拦截注入 CSP 后走关键路径） | 0 违规 |
| content-sweep.js     | 全站逐页内容完整性（**页数取自 `dist/sitemap.xml`，不写死**） | 0 异常 |
| focus-visible.js     | 焦点可见性（逐 Tab 位，WCAG 2.4.7） | 121 停靠点 0 缺失 |
| typography-audit.js  | 排印合规（字号是否全在 --fs-* 尺度内、字体族、行宽） | 0 越轨 |
| interaction-states.js| 交互态完整性（逐元素强制 :hover/:active 比较视觉指纹） | 101 元素 0 缺失 |
| motion-audit.js      | 动效克制性（reduced-motion 覆盖、过长过渡、transition: all） | reduced 0 残留 |
| color-audit.js       | 色彩系统（调色板合规 / 文本 AA / 非文本 3:1） | 0 越轨，最差文本 4.65:1 |
| reflow-spacing.js    | WCAG 1.4.10 重排(320px) + 1.4.12 文本间距 + 320px 命中区 + 触屏档 | 0 溢出/0 裁切/0 过小目标 |
| keyboard-journey.js  | 键盘完整旅程（15 条任务，含焦点不被抢 / 详情页返回可达 / 窄屏检索直达） | 15/15 |
| ax-tree.js           | 无障碍树（可访问名/标题层级/控件状态/图片名冗余，含详情 404 态） | 0 未命名，0 冗余 |
| inp-interaction.js   | 交互响应 INP 代理（4× CPU 节流，含长任务/TBT） | 最差 48–88ms（<100 竞奖档） |
| offline-check.js     | 离线阅读（SW 接管 → 断网重载 → 兜底页 → 缓存有界 → 回访零网络） | 7/7 |
| spacing-audit.js     | 版式节奏合规（严格门禁=版式级；容器级仅报告） | 版式级 0 越轨 |
| hero-flight.js       | 起飞前编排 + 共享元素飞行（逐帧读 ::view-transition-group 几何 / 退场错峰 / 取景变形是否落定 / 中途改主意）。「取景变形落定」一项会先切到四卡里 zoom 偏离 1 最大的一张——首卡 zoom≈1 时变形量与「没变形」不可区分（详见脚本第 6 节） | 18/18 |

⚠ **跑审计前必须 `npm run build:ci`**（不是 `npm run build`）：后者会清空 dist 且
  **不生成 sitemap / 逐路由 HTML**，`content-sweep` 这类读产物清单的脚本会静默地
  扫 0 页（曾据此误判）。产物清单以 sitemap 为单一来源。
  现已设防：取不到任何 `<loc>` 时 `content-sweep` **显式返回 `failed: true` 与原因**，
  不再「0 页 / 0 异常」地绿着通过（负向验证：移走 `dist/sitemap.xml` → 立刻报错）。

⚠ **run-code 探针里不要在事件回调中抛异常**：`page.on` / `cdp.on` 的回调一旦抛错会
  直接让 playwright-cli 会话崩溃（"Session closed"，无堆栈）。需要计数请求时优先用
  `performance.getEntriesByType('resource')` 的 `transferSize` / `workerStart` 字段，
  而不是挂事件监听。

⚠ **量尺寸前等字体与渲染稳定**：命中区/行高这类测量依赖字体度量，固定 `waitForTimeout`
  在浏览器繁忙时会读到未就绪状态而误报（`reflow-spacing.js` 在全量审计时曾偶发报
  `smallTargetsAt320: 3`，单独复跑为 0）。改为等 `document.fonts.status === 'loaded'`
  + 两帧 rAF 后再量。**偶发失败要查竞态或改确定性等待，不能靠重跑蒙过去。**

⚠ **测「首次访问」性能必须三件套**（口径不严会读到回访值）：
  ① **新上下文**（`browser.newContext()`）——在共享 page 上测，测量导航本身会注册 SW
     并缓存资源，第二次读数就变成回访；
  ② `serviceWorkers: 'block'`——否则 SW 命中让资源以 `transferSize=0` 秒回；
  ③ `Network.setCacheDisabled(true)`——仅 `clearBrowserCache` 不够，本 profile 的缓存
     仍会让头图 0KB 秒回（实测踩过：读数 1.0s vs 真值 2.26s）。
  回访性能则相反：**保留 SW 缓存**才是要测的条件。

⚠ **结构性改动不要用脚本搬行**：本会话三次用正则/PowerShell 批量改文件，分别把
  `add()` 的多余参数、注释吞掉 `page.goto`、以及 `execFileSync` 的参数数组清空——
  每次都靠复读文件才发现。**改代码用编辑器工具逐处改；批量替换只用于等长、可验证的
  字面量替换，并在替换后立刻复读受影响行。**

⚠ **Service Worker 会遮蔽「失败模拟」**（2026-10 引入离线能力后）：SW 自己发起的 fetch
  不经过 `page.route`，SW 脚本的注册请求也不经过——`route('**/sw.js', abort)` 无效。
  需要在「无 SW」前提下测失败/断网的检查，应另开 `serviceWorker: 'block'` 的上下文
  （见 `regression-walk.js` 的错误态检查段）。

⚠ **测离线必须用 `context.setOffline`**，不能用 CDP 的
  `Network.emulateNetworkConditions({offline:true})`：后者只作用于页面 target，
  **SW 自己发起的 fetch 不在其中**——SW 仍能联网取回真实页面，离线检查会因错误原因通过
  （`offline-check.js` 首版即如此，实测发现后改正）。
  同理，离线审计必须先**注销残留 SW + 清缓存**：浏览器配置跨审计复用，旧注册不重新拉取
  脚本就继续生效（负向验证时删掉 `dist/sw.js` 仍全绿，即因此）。
  另：等 SW 就绪要**轮询状态**（controller 存在 **且** `/offline.html` 已入缓存），
  不要用固定 `waitForTimeout` —— 刚跑完别的审计（浏览器忙）时安装会慢，曾出现
  「兜底页未缓存 → 离线落到浏览器错误页」的偶发失败（复跑三次均过，确认是竞态）。
  **偶发失败要么查出竞态、要么改成确定性等待，不能靠重跑蒙过去。**

新增审计：脚本导出 JSON（{ total, failed, failedItems } 风格），
失败项必须带定位信息（tag/cls/几何），让下一轮修复不用重新考古。
新增页面/路由时，**同时把路径加进各审计的 `routes` 清单**（axe/ax-tree/排印/色彩/
节奏/reflow/打印/交互态/焦点/动效/视口溢出/landmark/touch-targets）——否则新页面
等于没有任何门禁覆盖。`content-sweep` 读 sitemap，会自动覆盖。

⚠ **`git checkout -- <目录>` 会连未提交的改动一起回退**：为恢复一个被正则改坏的审计
  脚本而 `git checkout -- scripts/audits/`，把同目录下**尚未提交**的走查护栏一起退掉了
  （全量审计报 `home-index-rows` 期望值不符才发现）。**只恢复出问题的那个文件，
  并先 `git status` 看清哪些改动还没提交。**

