# QUALITY.md · 获奖级品质记分卡

目标不是「感觉像获奖站」，而是**每一项都能跑命令验收**。本文件把三大奖项的评审维度
翻译成本站可测的指标：目标值、当前实测值、复跑命令、以及差距。

> 评审依据（外部检索，2026-10）：
> - **Awwwards**：Design 40% / Usability 30% / Creativity 20% / Content 10%；评审 ≥18 人、
>   去掉离均值最远的 3 个分数；**6.5+ 得 Honorable Mention**，SOTD 取最高分
>   （[awwwards 评估页](https://www.awwwards.com/about-evaluation/) ·
>   [评审维度拆解](https://www.utsubo.com/blog/award-winning-website-design-guide)）
> - **Webby（Websites & Mobile Sites）7 维度**：Content、Structure & Navigation、Visual Design、
>   Functionality、Interactivity、Innovation、Overall Experience；其中 Visual Design 明确要求
>   「improving inclusion for people with disabilities」，Functionality 明确要求「loads quickly…
>   takes into consideration… special access needs, disabilities, and bandwidth limitations」
>   （[Webby 评审标准](https://www.webbyawards.com/judging-criteria/)）
> - **FWA**：偏重创意、实验性与技术执行，500+ 国际评审
> - **Core Web Vitals 官方阈值**（75 分位）：LCP ≤2.5s / INP ≤200ms / CLS ≤0.1
>   （[web.dev 阈值定义](https://web.developers.google.cn/articles/defining-core-web-vitals-thresholds)）
> - 行业参考的**获奖者水平**：LCP <1.5s、INP <100ms、CLS <0.05、总重 <3MB
>   （同上拆解文）

指标分三档：**门槛**（不达标即失格）→ **良好**（官方「good」）→ **竞奖**（获奖者水平）。

---

## 1. 性能与功能（Awwwards Usability 30% / Webby Functionality）

| 指标 | 门槛 | 良好 | 竞奖 | 本站实测 | 复跑 |
| --- | --- | --- | --- | --- | --- |
| LCP（首页 · 移动 · **实测观测值**） | ≤4.0s | ≤2.5s | <1.5s | **2.33–2.47s** ✅ | `temp/home-lcp-attribution.js`（冷缓存） |
| LCP（首页 · 移动 · Lighthouse 模拟值） | ≤4.0s | ≤2.5s | <1.5s | ~4.5s ⚠️ | `npx lighthouse` |
| LCP（名录 · 移动） | ≤4.0s | ≤2.5s | <1.5s | **2.6s** ✅ | 同上 |
| LCP（详情 · 移动） | ≤4.0s | ≤2.5s | <1.5s | **2.3s**（节流 A/B 口径） | `temp/lcp-probe-4180.js` |
| LCP（详情 · 桌面 **DPR 1**） | ≤4.0s | ≤2.5s | <1.5s | **2.32s** ✅ | `temp/hero-dpr-check.js` |
| LCP（详情 · 桌面 DPR 2） | ≤4.0s | ≤2.5s | <1.5s | ~5.0s（311KB 原图，节流下）⚠️ | 同上（retina 保画质优先） |
| **INP**（4× CPU 节流代理） | ≤500ms | ≤200ms | <100ms | **最差 48–88ms / 中位 32–40ms** ✅ | `scripts/audits/inp-interaction.js` |
| CLS | ≤0.25 | ≤0.1 | <0.05 | **0.000–0.001** ✅ | `regression-walk.js`（home-cls / detail-cls-fresh） |
| 总重（首页/名录/详情） | — | — | <3MB | **636 / 440 / 911KB** ✅ | Lighthouse `resource-summary` |
| 长任务 TBT（节流） | — | — | — | 4 个 / 最长 **229–771ms**（首屏，unattributed）⚠️ | `inp-interaction.js` |
| 主包 gzip / CSS gzip | — | — | — | **59.1KB / 11.9KB** ✅ | `npm run verify:budget` |
| 运行时外部请求 | 0 | 0 | 0 | **0** ✅ | `regression-walk.js` + CSP 门禁 |

> **LCP 的两个口径必须分清**：Lighthouse 报的是 **Lantern 模拟值**（从 trace 推算并行竞争），
> 本站首页模拟 ~4.5s 而**冷缓存实测观测值只有 2.33–2.47s**。做优化决策要用观测值 +
> 机制级时序；对外报告要同时给两个口径，否则会误判「首页远未达标」。
> 首页 LCP 元素是**随机挑选的今日角色头图**（4 张之一，33–43KB）：它在 JS 引导后 ~1.36s
> 才被发现。试过并回退的优化：首卡 high / 其余 low 的优先级分化（2360 vs 2400ms，噪声内）。

## 2. 无障碍与包容性（Awwwards Usability 内 / Webby Visual Design 明列）

| 指标 | 目标 | 本站实测 | 复跑 |
| --- | --- | --- | --- |
| axe 全规则（12 路由 × 2 视口） | 0 violations | **24 组合 0** ✅ | `axe-a11y.js` |
| axe 交互展开态（6 状态） | 0 violations | **6 状态 0** ✅ | `axe-states.js` |
| 文本对比度（AA 4.5:1） | 全部达标 | **最差 4.65:1** ✅ | `color-audit.js` / 走查 `text-contrast-aa` |
| 非文本对比度（3:1） | 无「仅靠低对比边界识别」的控件 | **0** ✅（9 处带标签控件留档） | `color-audit.js` |
| 焦点可见性（WCAG 2.4.7） | 每个 Tab 位都有指示 | **121 停靠点 0 缺失** ✅ | `focus-visible.js` |
| 键盘完整旅程（WCAG 2.1.1） | 全部任务可纯键盘完成 | **12/12** ✅ | `keyboard-journey.js` |
| 无障碍树（名称/层级/状态） | 0 未命名、h1 唯一、无冗余名 | **0 / 唯一 / 0** ✅ | `ax-tree.js` |
| 重排 320px（WCAG 1.4.10） | 无横向滚动 | **0 溢出** ✅ | `reflow-spacing.js` |
| 文本间距（WCAG 1.4.12） | 无裁切/重叠 | **0 / 0** ✅ | `reflow-spacing.js` |
| 命中区（WCAG 2.5.8） | ≥24px | **320px 下 0 过小**；触屏滑条 18px/30px ✅ | `reflow-spacing.js` |
| 高对比度模式 | 结构可见 | **8/8** ✅ | `forced-colors.js` |
| 打印 | 纸墨可读 | **24/24** ✅ | `print-mode.js` |
| 动效克制（reduced-motion） | 关闭后无残留 | **0 残留** ✅ | `motion-audit.js` |

## 3. 设计系统兑现（Awwwards Design 40%）

| 指标 | 目标 | 本站实测 | 复跑 |
| --- | --- | --- | --- |
| 字号尺度合规 | 全部来自 `--fs-*` | **0 越轨**（13 令牌） ✅ | `typography-audit.js` |
| 调色板合规 | 无游离色 | **0 越轨**（数据色单列） ✅ | `color-audit.js` |
| 交互态完整性 | 每个可交互元素有 hover/active | **101 元素 0 缺失** ✅ | `interaction-states.js` |
| 字体族 | 只在三套栈内 | **0 越轨** ✅ | `typography-audit.js` |
| 行宽（measure） | 无过宽块（>50 字/行） | **0** ✅ | `typography-audit.js` |
| 视觉层级/一致 | 令牌单一来源 | 见 `tokens.css` 注释 + `/style` | — |

## 4. 结构与内容（Webby Content / Structure & Navigation；Awwwards Content 10%）

| 指标 | 目标 | 本站实测 | 复跑 |
| --- | --- | --- | --- |
| 全站内容完整性（238 页） | 0 渲染异常 | **0 泄漏 / 0 空区块 / 0 断图** ✅ | `content-sweep.js`（**须先 `build:ci`**：`build` 不产 sitemap/逐路由 HTML，脚本会静默扫 0 页） |
| 每页元信息 | title + description + canonical + og | **237 页逐路由 HTML 齐全** ✅ | `npm run route-html`（含自校验） |
| 结构化入口 | sitemap + robots 一致 | **238 URL / 同域** ✅ | `verify-budget`（origin 一致性门禁） |
| 边界态 | 加载/空/错误/404 均有出路 | **4 态齐备**（空态可清除、错误可重试） ✅ | `regression-walk.js` |
| 可分享视图 | 筛选/排序/等级写进 URL | **4 类状态全部深链** ✅ | `regression-walk.js`（sort/level/copy 组） |
| 空白与占位 | 无 lorem、无「敬请期待」 | 内容全部来自落地数据 ✅ | `content-sweep.js` |
| **字段覆盖透明度** | 缺口如实标注、不补造 | **4 类目 / 9 字段**，3 项缺口以琥珀标注（简介 57/60、潜能 11/60、邦布图标 41/42） ✅ | `regression-walk.js`（about-coverage） |
| 多语言质量 | 无机器翻译痕迹 | 单语（zh），文案人工撰写 ✅ | — |

## 5. 安全与部署（Functionality 的工程底线）

| 指标 | 目标 | 本站实测 | 复跑 |
| --- | --- | --- | --- |
| CSP | 严格（脚本无 unsafe-inline/eval） | **已上线，本地实测 0 违规** ✅ | `csp-check.js` + `verify:vercel` |
| 缓存策略 | 内容寻址 immutable、非寻址重验证 | **27 项断言通过** ✅ | `verify:vercel` |
| 部署产物一致性 | sitemap 域 = canonical 域 | **门禁通过** ✅ | `verify-budget` |
| 测试 | 全绿 | **325 passed / 37 files** ✅ | `npm test` |

---

## 6. 已知差距（下一轮的目标）

| 差距 | 现状 | 目标 | 方向 |
| --- | --- | --- | --- |
| **首屏长任务 229–771ms** | TBT 396–756ms | <200ms | 定位该任务归属（当前 unattributed）：入口 JS 求值 vs 首帧渲染 |
| **详情桌面 DPR 2 LCP ~5.0s** | retina 取 311KB 原图 | ≤2.5s | 原图 2552px 对 2336px 需求仅 1.09× 超采，砍不动；可评估「DPR2 用 2000px 档」的取舍（画质 vs 字节） |
| **首页 LCP 竞奖档（<1.5s）** | 实测 2.4s / 模拟 4.5s | <1.5s | LCP 元素是**随机**挑的今日角色头图（JS 引导后 1.36s 才发现）→ 若要提前只能让首卡确定化（牺牲部分随机性，需产品决策） |
| 首页 Lighthouse 模拟值 | 4.5s | ≤2.5s | Lantern 模拟对并行请求的建模偏悲观；先按观测值优化，对外双口径报告 |
| 3D/WebGL 类创意表达 | 无 | — | FWA 偏好的方向；本站定位为「档案标本」静态质感，**刻意不做**（避免模板化的炫技） |

> 记分卡的复跑约定：`npm test` + `npm run build:ci` 是**必过门禁**；
> 上表各审计用 `playwright-cli run-code --filename=scripts/audits/<脚本>`（需 preview 运行中）。
> 新指标一旦加入记分卡，就要同时进 `regression-walk.js`（能进走查的）或独立脚本（需 CDP 的）。
