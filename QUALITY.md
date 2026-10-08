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
| LCP（首页 · 移动 · **首次访问**，真冷：禁 SW + 禁缓存） | ≤4.0s | ≤2.5s | <1.5s | **2.26–2.27s**（头图）✅ | `temp/home-lcp-truefirst.js` |
| LCP（首页 · 移动 · **回访**，SW 缓存命中） | ≤4.0s | ≤2.5s | <1.5s | **~1.00s**（文本）✅ **已达竞奖档** | 同上（不清 SW 缓存） |
| LCP（首页 · 移动 · Lighthouse 模拟值） | ≤4.0s | ≤2.5s | <1.5s | ~4.5s ⚠️ | `npx lighthouse` |
| LCP（名录 · 移动） | ≤4.0s | ≤2.5s | <1.5s | **2.6s** ✅ | 同上 |
| LCP（详情 · 移动） | ≤4.0s | ≤2.5s | <1.5s | **2.3s**（节流 A/B 口径） | `temp/lcp-probe-4180.js` |
| LCP（详情 · 桌面 **DPR 1**） | ≤4.0s | ≤2.5s | <1.5s | **2.32s** ✅ | `temp/hero-dpr-check.js` |
| LCP（详情 · 桌面 DPR 2） | ≤4.0s | ≤2.5s | <1.5s | **节流 7212ms / 不节流 152ms** → 严苛节流产物，真实桌面不构成问题 ✅ | `temp/lcp-dpr2-compare.js` |
| **INP**（4× CPU 节流代理） | ≤500ms | ≤200ms | <100ms | **最差 48–88ms / 中位 32–40ms** ✅ | `scripts/audits/inp-interaction.js` |
| CLS | ≤0.25 | ≤0.1 | <0.05 | **0.000–0.001** ✅ | `regression-walk.js`（home-cls / detail-cls-fresh） |
| 总重（首页/名录/详情） | — | — | <3MB | **636 / 440 / 911KB** ✅ | Lighthouse `resource-summary` |
| 长任务 TBT（节流） | — | — | — | 4 个 / 最长 **229–771ms**（首屏，unattributed）⚠️ | `inp-interaction.js` |
| 主包 gzip / CSS gzip | — | — | — | **67KB / 14.1KB** ✅（预算 70 / 22KB；+2.9KB 记在本轮「起飞前编排」——整页退场收集器 + 取景变形 + 逐条入场 + 中断回滚路径，见 `verify-budget.mjs` 文件头） | `npm run verify:budget` |
| 运行时外部请求 | 0 | 0 | 0 | **数据面 0**；图片候选链兜底例外（见 §4 声明一致性） ✅ | `regression-walk.js` + CSP 门禁 |
| **离线阅读** | 已访问页面断网可读 | — | — | **Service Worker 已上线**：导航网络优先 / 静态资源缓存优先 / 数据 JSON 陈旧优先 + 后台更新；缓存世代跟随数据版本，换版整批清理；**未缓存页面断网落到自包含的离线兜底页**（可读文案 + 返回入口，而非浏览器空白页） ✅ | `offline-check.js`（7/7，含负向验证） |
| **回访数据量** | 回访零网络 | — | — | 首访详情 **881KB / 122 项** → 回访 **0KB / 128 项全部由 SW 命中**（`transferSize` 合计 0、`workerStart>0` 全覆盖）——对反复查阅的资料档案是实际收益，也对应 Webby「带宽受限」考量 ✅ | `offline-check.js`（repeat-visit-zero-network） |

> **LCP 的两个口径必须分清**：Lighthouse 报的是 **Lantern 模拟值**（从 trace 推算并行竞争），
> 本站首页模拟 ~4.5s 而**实测观测值 2.26s（首访）/ ~1.00s（回访）**。做优化决策要用观测值 +
> 机制级时序；对外报告要同时给两个口径，否则会误判「首页远未达标」。
>
> **测量方法学（第 114 轮修正，此前的数字口径不严）**：首访 LCP 必须在
> **新上下文 + `serviceWorkers:'block'` + `Network.setCacheDisabled(true)`** 下测——
> ① 仅 `clearBrowserCache` 不够：本 profile 的缓存仍让头图以 `transferSize=0` 秒回；
> ② 在共享 page 上测更不行：**测量导航本身会注册 SW 并缓存资源**，第二次读数就变成回访。
> 修正后的两组数字：**首访 2.26–2.27s（头图）· 回访 ~1.00s（文本，头图瞬间命中）**。
>
> **首访 LCP 的真实构成（第 114–115 轮 A/B 实测）**：
> - 头图在 JS 引导后 ~1.39s 才被请求、~2.24s 完成 → 首访 LCP 2.26s（头图）
> - **带宽竞争才是主约束**：首页要拉 **35 片 CJK 字体**（约 175KB）与 27KB 头图抢同一条
>   1.6Mbps 链路；头图的完成时刻几乎完全由「JS 何时引导 + 字体何时让出带宽」决定
> - 试过并**回退**的两个优化（都实测更差，按「只保留有实测收益的改动」回退）：
>   1. **解析期预取今日头图**（`boot-picks.js`）：4 张变体 LCP 2.88s、1 张变体 2.59s
>      ——资源优先级倒置（图片抢带宽 → 字体更晚 → 文本更晚）
>   2. **视口内元素跳过 reveal**：LCP 反而 3.5s。两个原因：① `mounted` 时取 rect 不可靠，
>      DCL 时仍有 7 个元素 opacity 0（实现没生效）；② 首屏内容更早可见 → 主线程早期工作量
>      增加 → 应用预取被推迟（头图 1391→1647ms 才发起）
> - 禁动画（`prefers-reduced-motion: reduce`，指令整体 no-op）时 LCP 1.81–1.95s——说明
>   **理论天花板约 1.9s**，但「让首屏更早可见」这条路在真实负载下不成立
> - 试过并**回退**的第三个优化：**首页折叠外用 `content-visibility: auto`** 推迟文本，
>   期望减少早期分片请求——实测**无改善**（LCP 2300–2328ms vs 基线 2268–2304ms，且
>   **分片数仍为 35**）：那 35 片由**首屏内容**驱动，折叠外推迟不了
> - **判定：首访 LCP 已到该设计的实际下限**（4 次同条件 A/B 尝试均无收益或更差）。
>   剩余杠杆都属**设计取舍**，暂不采用：
>   ① `font-display: optional` → 首绘用系统衬线、不再 swap（丢失「中文衬线」这一语言核心）；
>   ② 预载首屏静态文本所需分片 → 实测首屏 84 字就触及 **41 片**（分片约 2 字/片），
>      预载反而比现状的 35 片更多；
>   ③ 让首卡在构建期确定以配合预载 → 牺牲「今日角色」的每日随机（产品决策）
> - 因此记分卡的这一行不再作为「待办」：**首访 2.26s 属官方「良好」**，
>   **回访 1.00s 已达竞奖档**，且所有尝试与数据都已留档

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
| **共享元素飞行（首页「今日角色」→ 代理人详情）** | 真的飞起来、落点精确、收尾干净、回程落回同一张 | **18/18**：直接点与「先换卡再点」两条路径逐帧几何都从起飞盒（≈933×395）收敛到目的地 `.hero-bg`（1168×413）；位移 Δw 214–225px / Δy 234–245px；结束后 0 个 vt 标记残留；回程落回起飞的那张卡。**旧实现是静默空转**（两端几何完全相同，观感即硬切）——只看「有没有动画类/动画对象」验不出来，故单列一项逐帧几何审计 | `hero-flight.js` |
| **起飞前编排（四拍：整页退场 → 原地变形 → 飞行 → 逐条入场）** | 变形在起飞前完成、退场有级联、目标页逐条装订、中断可回滚 | **18/18 里的 5 项专测**：① 起跳那一刻 `.deck-item img` 的 transform 已是 `none`（起手是校准 `scale(1.29)`）——变形**确实在飞行前落定**；② 退场区块 opacity 极差 > 0.2（是级联不是同时消失）；③ 无修饰点击被接管（`vt-exit` + ≥5 个 `.vt-out`）；④ `⌘/Ctrl` 点击放行（不接管、不编排）；⑤ 中途改主意时用户的新去向优先、标记撤净。另有实测：`prefers-reduced-motion` 下整段编排不发生（站头 opacity 保持 1、导航照常）；手机 390×844 编排成立、飞行收敛 348→350、无横向溢出 ✅ | `hero-flight.js` + 人工帧序列复核 |
| **牌堆入场编排（标本装匣）** | 一次编排、终态即常态、不拖帧 | 装裱线 560ms → 画落位 760ms（缩放 1.03→1 + 显影）→ 标本签与刻度错峰至 930ms；全部只动 transform/opacity/border-color（**刻意不用 clip-path**：它要每帧重绘 1168×500 那一层）；减少动效下不加类、元素直接停在终态 ✅ | `motion-audit.js` + FeaturedDeck 单测 |

## 3. 设计系统兑现（Awwwards Design 40%）

| 指标 | 目标 | 本站实测 | 复跑 |
| --- | --- | --- | --- |
| 字号尺度合规 | 全部来自 `--fs-*` | **0 越轨**（13 令牌） ✅ | `typography-audit.js` |
| 调色板合规 | 无游离色 | **0 越轨**（数据色单列） ✅ | `color-audit.js` |
| 交互态完整性 | 每个可交互元素有 hover/active | **101 元素 0 缺失** ✅ | `interaction-states.js` |
| 字体族 | 只在三套栈内 | **0 越轨** ✅ | `typography-audit.js` |
| 行宽（measure） | 无过宽块（>50 字/行） | **0** ✅ | `typography-audit.js` |
| **版式节奏（间距）** | 版式级间距全部来自节奏令牌 | **0 越轨**（8 个生效值全部出自 `--pad-*` / `--space-*`）✅ | `spacing-audit.js` |
| **宽屏构图（1920 / 2560 / 3440）** | 版心按比例跟随但有上下限；正文行宽不得随视口变宽 | `--wrap-max: clamp(1280px, 78vw, 1760px)`（容器与左侧导航共用同一变量）；内容占比 1920 **78%** / 2560 **69%** / 3440 **51%**；**正文行宽恒定 514px ≈38 字**（各自 56–76ch 上限）；详情立绘 1920 1386 / 2560 **1648** ✅ | 走查 `wide-container-capped` + `typography-audit`（过长行 0） |
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
| **编号规则可核查** | 号段与编号语义有说明 | **4 类目号段由数据派生**（1011–1621 / 12001–14162 / 53001–55098 / 31000–34200），并讲清**两套编号**：源站 ID（详情页头 `NO.1011`、快搜结果、深链/文件名）与展示位次（翻页处 `002`，类目内按 ID 升序）；名录表格不显示编号 ✅ | `regression-walk.js`（about-id-ranges / about-numbering-precise） |
| **「今日角色」名副其实** | 同日恒定、跨日更换 | 按本地日期播种确定性挑选（mulberry32）——原先每次挂载随机换人，与文案不符且回访永远冷缓存 ✅ | `regression-walk.js`（home-today-stable）+ 单测 4 例 |
| **「今日角色」双断点陈列** | 桌面与手机都完整展示角色，信息不压画面 | 桌面 2.36:1 标本板（宽度 = min(栏宽, 44vh×2.36)，居中陈列不留单侧空档；**留一档「标本比封面小」的差距**，共享元素飞行才有几何位移——48vh 时 1680 宽下陈列框 1187 ≈ 栏宽 1198，飞行会退化成纯交叉溶解）；手机 4:5 竖幅＋**图下标本签**（旧版手机是 16:9 横带，只露一条横带且被信息条压掉近半画面）；两断点共用同一套 `pos/zoom/originY`，纵向取景完全一致 ✅ | 截图 `temp/deck-mobile-before-after.png` + `axe-a11y`（30 组合 0 violations）/ `reflow-spacing`（320 溢出 0、命中区 0 过小）/ `regression-walk` / `hero-flight.js`（各断点倍率 1.10–1.42） |
| **「今日角色」首屏不重复** | 4 张卡的属性与阵营都不重复 | **365/365 天成立**：选片按「属性 + 阵营」双重去重（阵营代表设计语言：机车帮 / 家政 / 治安局 / 防卫军…）。此前纯随机洗牌实测出现「4 张里 3 张白发红眼」，首页第一印象显得随手 ✅（残余局限：设计语言本身相近的角色仍可能同屏；**试过按图片主色调去重——实测信号太弱未采用**：47/54 张有色彩，但**2 个色相桶就占 57%**，要求 4 张色相分散经常无解） | `regression-walk.js`（home-cards-element-diverse）+ 单测 5 例（含逐日 365 天校验） |
| **皮肤立绘陈列（Outfits）** | 素材按其实质尺寸呈现，不印成邮票 | 立绘列 **132px → clamp(260px, 26vw, 400px)**（桌面实测 372×497）；源站皮肤素材实测 **2128×2008 / ~350KB** 全身立绘；文字与立绘**垂直居中**（说明常仅两三行，顶端对齐会留大片空白）；手机单列、立绘 ≤64vw 不占满整屏 ✅ | 截图 `temp/shots/skins5-1440.png` · `skins-390.png` + 走查/reflow 回归 |
| **对照台（档案原生交互）** | 同类目并排比对，差异可辨 | 详情页就地「加入对照」→ `/compare` 表格并排；差异行**同时**用琥珀与「差异」文字标记（不单靠颜色）；上限 3 条、跨类目重开一桌、localStorage 持久化、`?cat=&ids=` 可分享；**移出/清空后焦点主动交棒**（下一条的移出钮 / 空态标题），不掉回 body ✅ | `regression-walk.js`（compare-add / compare-table / compare-remove / compare-clear / **compare-deeplink**）+ `keyboard-journey.js`（3 项焦点交棒）+ 单测 21 例 |
| **逐条出处** | 每条档案可追溯快照 | 详情页页脚显示「数据版本 LIVE x.y · 快照 日期 · 来源」 ✅ | `regression-walk.js`（detail-provenance） |
| **公式页版本锚定** | 机制版本与数据版本并列可对照 | 「机制整理 **2.0 版** · 站内档案数据 **LIVE 3.2**（快照 …）」+ 出处链接 + 通向实据的交叉引用（→ 代理人名录对照读数） ✅ | `regression-walk.js`（formulas-version / formulas-crossref） |
| **声明与实现一致** | 文案不得绝对化到与实现不符 | 原「页面不做任何跨域请求 / 不经任何外部服务」→ 改为「**本站资源齐备时零跨域请求** + 候选链兜底例外」（实测邦布 55098 缺图标时确实回源 CDN 一次）；原「离线打开已缓存页面仍可阅读」当时**没有 SW、是空话** → 现已实现并写明适用范围 ✅ | `regression-walk.js`（about-claims-precise）+ `offline-check.js` |
| 多语言质量 | 无机器翻译痕迹 | 单语（zh），文案人工撰写 ✅ | — |

## 5. 安全与部署（Functionality 的工程底线）

| 指标 | 目标 | 本站实测 | 复跑 |
| --- | --- | --- | --- |
| CSP | 严格（脚本无 unsafe-inline/eval） | **已上线，本地实测 0 违规** ✅ | `csp-check.js` + `verify:vercel` |
| 缓存策略 | 内容寻址 immutable、非寻址重验证 | **27 项断言通过** ✅ | `verify:vercel` |
| 部署产物一致性 | sitemap 域 = canonical 域 | **门禁通过** ✅ | `verify-budget` |
| 测试 | 全绿 | **331 passed / 37 files** ✅ | `npm test` |
| **审计工具箱全量复跑** | 27 脚本全部通过 | **27/27 · 0 需人工判读**（每个脚本的通过判据显式声明；失败即非零退出）✅ | **`npm run audit:all`**（一条命令；单脚本仍可 `playwright-cli run-code --filename=scripts/audits/<脚本>`） |

---

## 6. 已知差距（下一轮的目标）

| 差距 | 现状 | 目标 | 方向 |
| --- | --- | --- | --- |
| ~~首页 LCP 竞奖档（<1.5s）~~ **已到实际下限** | 首访 2.26s / 回访 **1.00s**（达标） | <1.5s | **4 次同条件 A/B 尝试均无收益或更差**（解析期预取头图 / 首屏跳过 reveal / 折叠外 content-visibility / 预载首屏分片），根因是首屏 CJK 字体（35 片 ≈175KB）与 27KB 头图抢同一条链路——属该设计的**带宽下限**。回访已进竞奖档；剩余杠杆（`font-display: optional`、首卡构建期确定）都是设计取舍，暂不采用（理由见上） |
| 首页 Lighthouse 模拟值 | 4.5s | ≤2.5s | Lantern 模拟对并行请求的建模偏悲观；先按观测值优化，对外双口径报告 |
| 共享元素飞行的**内容交接**是交叉溶解（两张不同裁切的同一张画） | 溶解收在飞行后 35%–78% 这一段（不劈在中段）；两端若裁切差异极大（极端 zoom）仍可能在交接处被察觉 | — | 结构性限制：两端画幅比不同（2.36 横幅 vs 整栏 2.99），同一张源图在两端露出的是不同窗口，VT 只能靠等长互补溶解交接。要彻底消除就得让两端取景一致（改构图校准），代价是牺牲其中一端的取景质量——**不做**；已把溶解移到运动收尾段以弱化它 |
| 3D/WebGL 类创意表达 | 无 | — | FWA 偏好的方向；本站定位为「档案标本」静态质感，**刻意不做**（避免模板化的炫技） |

> **已澄清为「非真实差距」**（不再列为待办）：
> - **详情桌面 DPR 2 LCP**：节流 7212ms / 不节流 152ms——把移动级节流套在 retina 桌面上不成立；
>   原图 2552px 对 2336px 需求仅 1.09× 超采，**不为字节牺牲 retina 画质**（该决定由本轮数据支持）。
> - **首屏长任务**：已归因（首帧内容布局，与内容规模成正比 + 字体到达局部重排），INP 实测 48–88ms 已达获奖档。

> 记分卡的复跑约定：`npm test` + `npm run build:ci` 是**必过门禁**；
> 上表各审计用 `playwright-cli run-code --filename=scripts/audits/<脚本>`（需 preview 运行中）。
> 新指标一旦加入记分卡，就要同时进 `regression-walk.js`（能进走查的）或独立脚本（需 CDP 的）。

---

## 7. 评审维度对照（自评 · 第 100 轮）

把三大奖项的**评审维度**逐条对到本站证据上，避免「指标全绿但维度没覆盖」的盲区。
自评只用两档：**有证据**（可跑命令复现）/ **无法自证**（需要人眼或真实评审）。

| 奖项维度 | 本站证据 | 自评 |
| --- | --- | --- |
| Awwwards **Design 40%** | 令牌单一来源（字号/颜色/间距/字体族 4 项审计 0 越轨）、交互态完整 101/101、视觉层级由 `tokens.css` + `/style` 页自陈 | 有证据（**构图与美感的最终判断无法自证**） |
| Awwwards **Usability 30%** | 键盘旅程 12/12、焦点 121/121、axe 24 组合 0、重排/间距/命中区/HCM/打印全通过、INP 48–88ms | 有证据 |
| Awwwards **Creativity 20%** | 「档案标本」语言（细线 + 等宽编号 + 纸墨）、逐路由静态 HTML + 预载、URL 即视图、**对照台**（档案原生交互：并排比对 + 差异标记 + 可分享链接）、**标本起飞**（首页陈列框 → 详情封面的一次共享元素飞行：装匣入场三拍 + 飞行 400ms + 落地文字逐条就位，`hero-flight.js` 逐帧几何可验） | **有证据**：原创性成立，且已有两个「记得住的交互」（对照台 + 标本起飞）。动效仍按「一次编排、只服务动作语义」克制，不做装饰性位移 |
| Awwwards **Content 10%** | 232 条结构化档案、字段覆盖透明度、逐条出处、公式页版本锚定、编号规则可核查 | 有证据 |
| Webby **Content** | 同上 + 238 页 0 异常、缺口如实标注不补造 | 有证据 |
| Webby **Structure & Navigation** | 名录/详情/公式/说明四层结构、段内导航 + 滚动高亮、深链与视图状态入 URL、离线可用 | 有证据 |
| Webby **Visual Design**（含 disability inclusion） | 对比度 4.65:1 起、HCM 8/8、reduced-motion 0 残留、320px 无溢出 | 有证据 |
| Webby **Functionality**（快速加载 / 特殊访问 / 带宽） | CWV 达标、回访零网络、离线兜底页、SW 缓存有界、CSP 严格 | 有证据 |
| Webby **Interactivity** | 快速检索（⌘K）、等级滑条（键盘 + URL）、筛选/排序（URL）、复制链接、翻页、**今日角色牌堆**（跟手拖拽 1:1 + 橡皮筋 + 键盘 ←/→/Home/End + 刻度，换卡读数按方向滚入） | 有证据 |
| Webby **Innovation** | 数据出处透明化（覆盖/版本/编号规则）、离线优先的档案站、零外部请求、**对照台**（把「比」这件真实任务做成一等公民，而非塞进列表页） | **有证据**：方向清楚且有落地形态 |
| Webby **Overall Experience** | 加载/错误/空/离线四态都有出路；边界态文案可读 | 有证据 |
| FWA（创意 / 实验性 / 技术执行） | 技术执行有证据（性能/无障碍/离线/构建门禁）；**创意与实验性偏保守** | **部分**：与「不炫技」的定位一致，属有意取舍；本轮新增一处**技术执行型**表达（View Transitions 共享元素飞行 + 逐帧几何审计），但仍不做 3D/WebGL 那类炫技 |

**自评结论**：可验收维度已基本覆盖（六板块 40+ 项、全部可复跑）；**「创意/创新」已从「部分」升为「有证据」**
（第 102 轮落地对照台——档案原生的交互；本轮补上「标本起飞」——一处**动作语义驱动**的共享元素
飞行，节奏、降级与逐帧几何都有审计兜底）。剩余只能由人眼判定的仍是**构图美感**。

