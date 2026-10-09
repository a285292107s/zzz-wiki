# 全量文档审核报告（2026-10）

审计对象：仓库内**全部已跟踪 Markdown**（`git ls-files '*.md'`，9 份）＋散落约定载体
（`index.html` / `vercel.json` / `.github/workflows/data-sync.yml` / `tokens.css`）。

审计基线：**工作区当前状态**（含未提交改动）。审计**只读**，未修改任何被审文件。

> ⚠ **归档说明（后续维护者必读）**：本报告是 **2026-10 的历史快照**，其中的脚本计数
> （如 §5.4 表里 `regression-walk.js` 的 95/96 项）**只代表当时的状态**，之后审计增删会使它过时。
> 本文**不再更新**（保留快照以存证）；**当前计数一律以 [`scripts/audits/README.md`](../../scripts/audits/README.md) 为准**，
> 该表由脚本实测复核。

审计标准（三条）：
1. **高信噪比**——只留「能做什么、绝不能做什么、类型是什么」；不复述代码实现。
2. **单一事实源（SSoT）**——一个事实只在一处完整定义，其余只引用，不重述。
3. **渐进式披露**——全局只放基础上下文，细分规则按需索引。

---

## 0. 审计范围与结论概览

| 文档 | 行数 | 职责判定 | 结论 |
|---|---|---|---|
| `AGENTS.md`（磁盘为小写 `agents.md`） | 83 | 工作约定（全局入口） | **需补强**：缺硬性禁止项与文档加载指引 |
| `README.md` | 94 | 人类开发者极简指引 | **需精简**：5 个章节与其它文档完整重复 |
| `DATA_GUIDE.md` | 353 | 数据/工程术语 SSoT | 质量高；1 处版本号内部不一致 |
| `DESIGN.md` | 298 | 架构愿景/分层/契约 SSoT | **§3 陈旧误导（P0）**；§4.2 标签过时 |
| `IMG_GUIDE.md` | 232 | 图片展示技法 SSoT | 1 处内部自相矛盾 |
| `QUALITY.md` | 174 | 品质记分卡 | 复跑依据寄居 `temp/`（不可持续） |
| `scripts/audits/README.md` | 98 | 审计工具箱运维约定 | 1 处悬空引用；正文用 `/* */` 包裹 |
| `src/utils/viewTransition/README.md` | 222 | 共享元素过渡技法 | **范本级**：`约束 \| 数值 \| 不满足会怎样` 表 |
| `zzz_api_research.md` | 123 | 历史调研报告 | 跟踪/忽略状态矛盾；内容与 DATA_GUIDE 重叠 |

**无需修复的良好状态**（已核验，避免误报到缺陷清单）：
- 9 份文档的相对链接**零死链**（全量正则提取 + `Test-Path` 逐个解析）。
- `scripts/audits/README.md` 的脚本表与实际目录**完全同步**：列出 27 个、实际 27 个、零差集。
- 条款级 `§` 交叉引用基本自洽，未发现成规模的结构性腐坏。

---

## 1. 发现清单

优先级：**P0** = 会误导 AI 产出错误改动；**P1** = 事实错误或契约破损；**P2** = 维护性/一致性问题。

| # | 位置 | 类别 | 问题 | 依据 | 修订方式 | 优先级 | 状态 |
|---|---|---|---|---|---|---|---|
| A1 | `AGENTS.md` §5.3（:77-78） | SSoT / 数据安全 | 要求术语「敲定后当场写入归属文档」，并把「游戏内术语」的归属定为名词表 `live/noun.json`——但该文件由构建管线**全量重建**，手写内容必被覆盖丢弃 | `scripts/build/index.ts:85` `await dump('live','noun.json', b.noun)`；`src/data/terms.ts:2-4` 声明其为下沉产物 | 在 `AGENTS.md` 显式规定「术语落盘＝写归属**文档**」，并**排除生成物**；游戏术语改落 `docs/conventions/` 或 `live` 之外的手写载体 | **P0** | 已修复 |
| A2 | `DESIGN.md` §3（:32-40） | 陈旧 / 误导 | §3「现状问题（重构动机，代码级证据）」把**已修复**的问题当作现状：称 `package.json` 无 test script（实为 `vitest run`）、证据指向不存在的 `scripts/build-data.mjs`（实为 `.ts`）；而 §11 自述 P0→P4 已全部落地。AI 会去"修"已修好的问题 | `DESIGN.md:40`、`:36`；`package.json` scripts.test；`Test-Path scripts/build-data.mjs` = False | §3 标题与首行加「历史快照（重构前）」限定，或折叠为指向 §11 的一行 | **P0** | 待处理 |
| A3 | `AGENTS.md` 文件名 | 契约破损 | 磁盘与 git 索引均为**小写** `agents.md`；`DESIGN.md:3` 引用**大写** `AGENTS.md`，`README.md:6` 引用小写。Windows 侥幸可解析，**Linux（Vercel 构建 / GitHub Actions）失效**，外部 AI 工具按 `AGENTS.md` 约定查找亦落空 | `cmd dir /b *.md` → `agents.md`；`DESIGN.md:3`；`README.md:6` | 重命名为 `AGENTS.md`，同步 `README.md:6` 引用 | **P1** | 已修复 |
| A4 | `DATA_GUIDE.md:37` | 事实错误 | 称 `zzz.live`「当前 **3.1**」，而同一文档 `:68`/`:101`/`:281`/`:296` 均为 **3.2**。以权威事实源核验：`public/data/manifest.json` 的 `zzz.live` = **`"3.2"`** | `DATA_GUIDE.md:37` vs `public/data/manifest.json`（`zzz.live`） | 统一为 3.2；版本号属易变事实，建议改为指向「从 `manifest.json` 取」的取法而非写死数值 | **P1** | 待处理 |
| A5 | `IMG_GUIDE.md:76`、`:99-105` | 内部矛盾 | 称校准参数在 `useFeaturedAgents.ts` 的 `FEATURED_POOL` 硬编码并给出 TS 代码块；但同文 `:123-126` 已改为存 `src/data/featured-pool.json` 且「参数不再手写进代码」 | `IMG_GUIDE.md:76` vs `:123-126` | 删除/改写 `:99-105` 的硬编码示例，统一指向 `featured-pool.json` + `/calibrate` | **P1** | 待处理 |
| A6 | `scripts/audits/README.md:4` | 悬空引用 | 称「基线数值见 `quality-baseline.md`」——该文件不存在（实际基线是 `QUALITY.md`） | `Test-Path scripts/audits/quality-baseline.md` = False | 改为引用 [`QUALITY.md`](../../QUALITY.md) | **P1** | 待处理 |
| A7 | `QUALITY.md:30,34,35,36,110,112` | 可验收性 | 多项指标的**复跑命令指向 `temp/*.js`**，而 `temp/` 已 gitignore 且约定「用完即删、随时可清空」。记分卡自称「每一项都能跑命令验收」，依据却寄居在会被清空的目录 | `.gitignore:19` `temp/`；`AGENTS.md` §1；`QUALITY.md:30` 等 | 长期保留的复跑脚本移入 `scripts/audits/`（受跟踪）；一次性探针在记分卡改为「方法描述 + 需重建」 | **P1** | 待处理 |
| A8 | 4 处 | SSoT 违规 | 「档案标本」设计语言与禁令在**四处完整重述**：`AGENTS.md` §3、`DESIGN.md` §10、`DATA_GUIDE.md` §10、`IMG_GUIDE.md`「与设计语言的契合」；而 `DESIGN.md:274` 已声明「禁令与 token 级精修的唯一记录点见 DATA_GUIDE §10」——声明与事实相反 | `AGENTS.md:31-33`；`DESIGN.md:274`；`DATA_GUIDE.md:317-323`；`IMG_GUIDE.md:117-119` | 保留 `DATA_GUIDE.md` §10 为唯一完整定义；其余三处压缩为一句引用 | **P1** | 待处理 |
| A9 | `README.md` | SSoT 违规 | §技术栈、§本地开发、§数据源、§部署、§目录结构 **5 节**与其它文档完整重叠：命令 ↔ `AGENTS.md` §4 / `DATA_GUIDE.md` §7；数据源 ↔ `DATA_GUIDE.md` §1/§4；目录树 ↔ `DESIGN.md` §4.2 | `README.md:11-18,24-37,41-48,50-61,63-88` | 按「人类极简指引」定位瘦身：保留项目简介 + 文档地图 + 最短上手（install/dev/test），其余改为引用 | **P1** | 待处理 |
| A10 | `zzz_api_research.md` | 跟踪/忽略矛盾 | 文件**已被 git 跟踪**（在 HEAD 中），同时被 `.gitignore:37` 忽略——忽略规则对已跟踪文件**失效**，注释却写「不入库」，形成事实与声明相反；且其内容（hakushin 端点清单）与 `DATA_GUIDE.md` §1/§4 重叠 | `git check-ignore -v --no-index` → `.gitignore:37`；`git cat-file -e HEAD:zzz_api_research.md` → 存在 | 二选一：① `git rm --cached` 从索引移除、保留磁盘（与注释一致）；② 保留跟踪并删除 `.gitignore:37` 规则 | **P2** | 待决策 |
| A11 | `DESIGN.md` §4.2（:66-112） | 陈旧标签 | 标题为「**目标**目录」，但 §11 已声明全部落地——现已是「当前目录」；且该目录树与 `README.md:63-88` 双份 | `DESIGN.md:66`、`:281-287` | 标题改为「当前目录」；`README.md` 侧目录树删去、改引用 | **P2** | 待处理 |
| A12 | `QUALITY.md`、`scripts/audits/README.md` | 易腐事实 | 硬编码快照数字（`331 passed / 37 files`、`238 页`、`121 停靠点`、`27/27`、`53 请求 / 751KB`）。部分标了「2026-10」，但无统一「截至日期」约定 | `QUALITY.md:126`、`:101`；`scripts/audits/README.md:16-17` | 每个数值统一带「截至 YYYY-MM」，或改为「运行 X 命令读取」 | **P2** | 待处理 |
| A13 | `scripts/audits/README.md:1,97` | 载体不当 | 文件是 `.md`，正文却整体包在 `/* … */` 里（第 1 行与第 97 行）。在 Markdown 渲染器下整篇变为字面文本，渲染/投影工具无法正常解析 | `scripts/audits/README.md:1`、`:97` | 去掉 `/* */` 包裹，改用标准 Markdown（代码块内注释保留原意） | **P2** | 待处理 |

### 对先前假设的更正（诚实记录）

先前研判提出「本仓库缺失 `.agents/notes` 所引用的 `docs/AGENTS.md`、`docs/i18n/README.md`、
`scripts/verify-agent-note-format.ts` 等文件，属缺陷」——**该结论不成立，已从缺陷清单剔除**。
依据：`.agents/` 被 `.gitignore:31` 忽略，是 **DeepSeek Harness 的运行时工作区数据**
（其笔记内容全部关于 DSH 自身），不是本项目的文档体系；它引用的路径指向**另一个项目**，
不构成本仓库的悬空引用。`docs/` 从未在本仓库存在过（`git log -- docs` 为空）。

引用价值：`.agents/notes/README.md` 是一套经脚本强制校验的决策记录规范，其
`## Problem / ## Decision / ## Alternatives considered（强制）/ ## Consequences` 骨架与
`proposed|implemented|rejected` 生命周期，正是本报告建议的决策记录格式来源（见
[`docs/decisions/`](../decisions/)）。

---

## 2. 决策记录候选（从本次审计提炼）

以下决定具备「踩坑后才定、且容易被后人推翻」的特征，值得固化为决策记录
（格式：Problem / Decision / Alternatives considered / Consequences）：

| 候选 | 来源 | 为什么容易被推翻 |
|---|---|---|
| 单一写入者：`npm run sync` 是唯一自动化写 `public/data/` 的入口，部署只构建已提交快照 | `DESIGN.md` §7.1 | 后来者会想「CI 里顺手重建数据更省事」，正是已踩过的坑 |
| 图标 `--soft` 只补缺失、不重下 | `AGENTS.md` §4、`DATA_GUIDE.md` §8 第 6 条 | 全量重拉看起来更"干净"，但会冲掉人工核验（含水印资产的处置） |
| 站点只展示 live，绝不消费源站 latest | `DATA_GUIDE.md` §1/§8 | 合规红线；latest 数据更全，容易被当作"顺手补上" |
| 设计语言「档案标本」，禁圆角堆叠/渐变/投影 | `DATA_GUIDE.md` §10 | 模板化审美压力持续存在（AGENTS.md §3 已言「宁可返工」） |
| `resetOut` 不触碰 `img/` | `DATA_GUIDE.md` §3 注 | 曾有「整体删除 OUT 目录连坐清空图标」的实测教训 |
| 头图派生档位必须由展示格物理像素反推 | `IMG_GUIDE.md:181,202` | 改布局时不重算就会发糊——已实测踩过（2026-10-07） |
| 测试不写「事实快照」与「实现复制」断言 | `DESIGN.md` §8 注 | 后来者会想补全枚举映射断言，反而制造假红 |
| 首个访问性能测量必须「新上下文 + 禁 SW + 禁缓存」三件套 | `scripts/audits/README.md:58-64` | 口径不严会读到回访值——已实测踩过（1.0s vs 真值 2.26s） |

---

## 3. 后续动作（按优先级）

1. **P0**：修正 `DESIGN.md` §3 陈旧段落（A2）；落实 A1 的术语落盘归属（本轮已在 `AGENTS.md` 处理）。
2. **P1**：修正 `IMG_GUIDE.md` 矛盾（A5）；迁移 `QUALITY.md` 的复跑脚本出 `temp/`（A7）；
   收敛设计语言的 4 处重述（A8）；瘦身 `README.md`（A9）。
3. **P2**：处置 `zzz_api_research.md`（A10）；修正 `DESIGN.md` §4.2 标签（A11）；
   统一快照数值的截至日期（A12）；解开 `scripts/audits/README.md` 的注释包裹（A13）。
4. 新增文档层：`docs/README.md`（加载索引）、`docs/architecture.md`（边界表）、
   `docs/conventions/`、`docs/decisions/`——**本轮已全部落盘**，见各文件自身。

---

## 4. 增量发现（三路并行审计合并，2026-10）

本报告初版只覆盖「9 份文档的内部一致性」。随后三路独立只读审计补齐了
「**文档声明 vs 代码/数据实测**」这一层，共计新增 40 余项。**已逐条亲自复验关键项**，
未复验的标「待确认」。以下按「已修复 / 待处理」归档。

### 4.1 方法缺口（诚实记录）

初版报告的**死链检查只覆盖 Markdown 的行内链接语法，未覆盖反引号里的文件路径**，
因此漏掉了 `IMG_GUIDE.md` 里的 `public/page-bg.png`（实际是 `public/page-bg.webp`）。
已改用更严口径（正则同时提取 `` `路径` ``）复检全部文档，结果见 §4.3。

### 4.2 本轮已修复

| 项 | 位置 | 修复 |
|---|---|---|
| A3 收尾 | `README.md:6` | `./agents.md` → `./AGENTS.md`（重命名后它是 Linux 死链） |
| A4 | `DATA_GUIDE.md:37`、`:45` | 两处写死的 `3.1 / 角色 58` 均改为「以 `manifest.json` 与名录文件为准」 |
| A2 收尾 | `DESIGN.md` §1 | §1 与 §3 同源的陈旧表述，已随 §3 的「重构前快照」限定一并约束 |
| A5 | `IMG_GUIDE.md` §「逐图常量」 | 删掉与单一事实源冲突的硬编码示例（原值 `zoom 1.3` 与 JSON 的 `1.32` 不符），改指 `featured-pool.json` |
| A6 | `scripts/audits/README.md:4` | `quality-baseline.md` → `QUALITY.md` |
| D3(报告2) | `DESIGN.md` §5.1 | 删掉假声明「未知键都会非零退出」（15 处 `.catchall` 使其永不失败） |
| D2(报告2) **P0** | `DESIGN.md` §4.1 | 「单向依赖，禁止跨层回跳」改为「设计意图 ≠ 实测事实」，并指向 `docs/architecture.md`；补上真硬边界 4 条 |
| D11/D14/D16 | `AGENTS.md` §4、`README.md:34`、`README.md:83` | `build:ci` 补全 10 步并声明 `package.json` 为唯一事实源；`sync` 删掉不存在的「CJK 衬线派生」（`sync-data.ts` 零字体逻辑，已实测） |
| D19 | `IMG_GUIDE.md` | `public/page-bg.png` → `public/page-bg.webp`（实测 18KB，非文档所称 95KB） |
| D4(报告2) | `AGENTS.md` §0.7 | 「`sync` 唯一写入」改为「`sync` 与 `data` 都会写盘」，并在决策记录 0001 中列全 6 个写入者 |
| §0 自重复 | `AGENTS.md` §0 | 删掉与 §3 逐条重复的 5 条，改为指向 §3 |
| D26 | `AGENTS.md` 5 处 | 补建 `docs/README.md`、`docs/architecture.md`、`docs/conventions/{glossary,contracts,naming}.md`、`docs/decisions/`，链接全部可解析 |

### 4.3 第一轮遗留清单（**历史记录**——其状态已被 §5「修复总账」取代）

> 下面这份清单是第二轮开工前的快照，保留是为了让读者看到「当初发现了什么」。
> **不要据此判断现状**：绝大多数条目已在第二轮修复，逐条状态见 §5。

**P0**
- `DESIGN.md` §1（:8-18）：用现在时陈述「结构层存在四类问题」，与 §11「已全部落地」冲突。

**P1**
- `DATA_GUIDE.md:218`：把枚举常量归给 `types.ts`——实际只在 `src/domain/enums.ts`（实测），与 `DESIGN.md` §5.2 直接冲突。
- `DATA_GUIDE.md:246`、`:256`：`build:ci` 命令块仍是旧链（漏 4 步）；`:256`「sitemap 为末段」不准。
- `DATA_GUIDE.md:55`、`:57`：`buildAll` 不是 `scripts/build/index.ts` 的导出名（导出 `main`，`buildAll` 是 `sync-data.ts` 的本地别名）。
- `DATA_GUIDE.md:152`：`iconSources(item, kind, category)` 签名错，实际 `(item, category, variant?)`。
- `DATA_GUIDE.md:157`：括注「（缺 npm run data 后运行）」语句不通。
- `DATA_GUIDE.md:162`：`Role→RoleSelect` 在现行名录零命中（**待确认**是否历史命名）。
- `DATA_GUIDE.md:170`：hero 头图「58/58」——实测 `img/hero/` 原图 **61** 张。
- `DESIGN.md` §4.2（:72-118）：标题仍是「**目标**目录」，且目录树严重不完整（`views/` 列 0/16、`composables/` 列 4/18、`utils/` 整体缺失）。
- `DESIGN.md` §6.3（:185-188）：行数验收指标失真（AgentsView 实测 174 行而非 151）。
- `DESIGN.md:281`：铁律 6 的 `tests/fixtures` **不存在**（测试全部内联）。
- `DESIGN.md:274` ↔ `DATA_GUIDE.md:317-322`：**两处互相声明对方是「唯一记录点」**——循环引用，需单向化。
- `DESIGN.md:94`、`:154`：双形态 hero 的 SSoT 指向 IMG_GUIDE，实际完整定义在 `DATA_GUIDE.md:185-195`。
- `IMG_GUIDE.md:164`：体积数字陈旧（26.3MB/59 张）且与同文 `:185` 的「61 张」自相矛盾。
- `QUALITY.md`：内部自相矛盾一组——`:64`「12 路由×2 = 24 组合」vs `:110`「30 组合」（实测 15 路由×2=30）；`:75` 打印 24/24；`:126`「331 passed / 37 files」（实测 46 个 `.test.ts`）；`:159`「键盘 12/12」vs `:69`「15/15」（实测 `add()` 15 处）。
- `QUALITY.md:30,34,35,36,110,112`：复跑依据指向 `temp/*.js`，而 `temp/` 会被清空。
- `src/utils/viewTransition/README.md`：数值簇集体过期（`400ms` → 实测 `460ms`；曲线 `cubic-bezier(0.42,0,0.22,1)` → 实测 `(0.4,0,0.2,1)`；溶解窗口 `140–310ms` → 实测 `120–380ms`）；连坐 `QUALITY.md:137,160`。
- `src/styles/tokens.css:10` vs `:13`：CJK 分片「101 片」vs「202 条」自相矛盾——实测**均为 231**。
- `AGENTS.md` §3 / `DESIGN.md:272` 措辞「图标**一律**经 `<HollowImage>`」严于实现：`FilterDropdown.vue:213,252` 直连 `<img>`（本地筛选资产）。建议改为「**站外图源**一律经 `<HollowImage>`；本地自绘资产例外」。
- **信息丢失风险**：未提交 diff 正在删除①逐路由 HTML 三项预载的决策与实测、②`stripRichText` 对含数字 LAYOUT 标记失灵的已知缺陷。全仓 Markdown 已零命中 `modulepreload`/`fetchpriority`/`5372`/`2139`（已实测）。①已固化为 [决策记录 0002](../decisions/0002-per-route-html-preloads.md)；②仍只在 `src/utils/text.ts:8` 代码注释里。

**P2**
- `scripts/audits/README.md`：`preview` 端口声明（`:4175`）与 `package.json` 的裸 `vite preview`（默认 4173）不一致，而 **27 个审计脚本全部硬编码 `localhost:4175`**（已实测）→ 按文档操作跑不起来。建议给 `package.json` 的 preview 加 `--port 4175`。
- `scripts/audits/README.md:1,:97`：`.md` 整体包在 `/* */` 里（经核验**无任何程序消费**这份 README），Markdown 渲染器下变字面文本。
- `DESIGN.md` §8（:244-265）：测试表未声明是否穷举，而 §11 称 §8 即现状；实测 `tests/` 44 个文件。
- `DESIGN.md:20-30`：ADR-001…007 表建议迁 `docs/decisions/`，DESIGN 只留指针。
- `index.html:5-7`：画布底色「三处同值」实为 ≥4 处（另含 `public/offline.html:14`），且无门禁校验跨文件相等。
- `knip.json`：三条约定（`entry`/`ignoreDependencies: axe-core`/`ignoreExportsUsedInFile`）承载非显然事实，**全仓库零文字解释**，唯一解释寄居会被清空的 `temp/`。
- `zzz_api_research.md`：跟踪/忽略矛盾（A10）未决；内容中 `/zzz/UI/` 404 警告与「排除主角」两条**与现行实现相反**——单独保留跟踪而不改内容，是这个仓库里唯一「保留了错误建议且无任何警示」的组合。

---

## 5. 修复总账（第二轮，2026-10）

**验证口径**：每一处改动都先在实际文件中核验了原文，再用「断言命中恰好 1 次 → 替换 → 复读受影响行」
的方式落地；不确定的事实一律以 `manifest.json` / `package.json` / `git ls-files` / 实测计数为准，
不采信其它文档的转述。

### 5.1 已修复

| 类 | 位置 | 修了什么 |
|---|---|---|
| **P0** | `DESIGN.md` §1、§3 | 两处用现在时描述**已解决**的重构前问题 → 加「重构启动时的快照」限定，并指向 §11 |
| **P0** | `DESIGN.md` §4.1 | 「单向依赖，禁止跨层回跳」与实测不符 → 改为「设计意图 ≠ 实测事实」+ 指向 `docs/architecture.md` + 列出 4 条**真硬边界** |
| P1 | `DATA_GUIDE.md` | 9 处：`types.ts` 的枚举归属（实际只在 `domain/enums.ts`）、`buildAll`→`main()`、`iconSources` 签名、语句不通的括注、`RoleSelect`（实测 60 条名录零命中）、hero「58/58」→ 61 张、`build:ci` 旧链、sitemap「末段」、§1 两处写死版本（3.1）→ 改为「以 manifest 为准」 |
| P1 | `DESIGN.md` | §4.2 标题「目标目录」→「当前目录（节选，非穷举）」；§6.3 行数指标删数值；铁律 6 的 `tests/fixtures`（不存在）→「fixture 内联」；铁律 5 与 DATA_GUIDE §10 的**互相指向**单边化；铁律 3 图标措辞 →「站外图标」+ 本地资产例外；§2 加「新决策进 `docs/decisions/`」；§8 表头加「示例，非穷举」；2 处 hero SSoT 指针 → `DATA_GUIDE` §5 |
| P1 | `IMG_GUIDE.md` | `public/page-bg.png`（不存在）→ `.webp`；体积数字 26.3/59 张 → 实测 39.5MB/61 张并标 2026-10；删掉与生成器冲突的像素复述；设计语言改为指向 `DATA_GUIDE` §10 |
| P1 | `QUALITY.md` | axe `24 组合` → **30**（15 路由×2）；打印 `24/24` → **36/36**（6×6）；测试 `331/37` → **439/46**（实跑）；键盘 `12/12` → **15/15**；飞行 `400ms` → **460ms**；溶解窗口不再写死百分比；补 **knip 三条设置**的解释；6 处 `temp/` 复跑引用迁出 |
| P1 | `viewTransition/README.md` | 曲线 `cubic-bezier(0.42,0,0.22,1)` → `(0.4,0,0.2,1)`；`400ms` → `460ms`；时序表 `0–400ms`/`140–310ms` → `0–460ms`/`120–380ms` |
| P1 | `src/styles/tokens.css` | 分片数自相矛盾（`:10` 101 片 vs `:13` 202 条）→ 统一为**实测 231**，并改为「由生成物决定，勿写死」 |
| P1 | `index.html` | 画布底色「**三处**同值」→ 实测**四处**（补 `public/offline.html`） |
| P1 | `AGENTS.md` | §0 删掉与 §3 逐条重复的 5 条；§0.7「`sync` 唯一写入」→「`sync` 与 `data` 都会写盘」；§3 图标措辞加本地资产例外；§3 设计语言 → 指向 `DATA_GUIDE` §10；§4 补全 `build:ci` 十步并声明 `package.json` 为唯一事实源；§5.3 术语落盘位置改为手写术语表（并警告**不要**写进会被重建覆盖的 `noun.json`） |
| P1 | `scripts/audits/README.md` | 悬空引用 `quality-baseline.md` → `QUALITY.md`；**解开 `/* */` 包裹**，转为可渲染的标准 Markdown（96 行，内容逐行保真）；运行前提把 `preview` 端口说准 |
| P1 | `package.json` | `preview` 加 `--port 4175`——**27 个审计脚本全部硬编码该端口**，此前按文档操作根本跑不起来 |
| P1 | 信息抢救 | 逐路由 HTML 三项预载（被 diff 删除且全仓 md 已零命中 `modulepreload`/`fetchpriority`）→ 固化为 [决策记录 0002](../decisions/0002-per-route-html-preloads.md) |
| P2 | `.gitignore` + `zzz_api_research.md` | 删掉对**已跟踪文件完全无效**的规则（其注释「不入库」与事实相反）；给报告加「§5/§7 已被取代，现行事实以 `DATA_GUIDE` 为准」的警示 |
| P2 | 复跑依据 | 4 个长期 LCP 探针从会被清空的 `temp/` 迁入受跟踪的 `scripts/probes/`（截图类保留为「一次性证据，需重新生成」——**不把二进制塞进 git**，那正是本仓库刻意规避的 blob 膨胀） |

### 5.2 仍未做（**下一轮**）

> 第三轮按用户拍板完成了（1）（2）——见 §5.3。

| # | 事项 | 为什么还没做 |
|---|---|---|
| ~~1~~ | ~~`README.md` 瘦身~~ | ✅ **已完成**，见 §5.3 |
| ~~2~~ | ~~目录树 SSoT 归属~~ | ✅ **已完成**，见 §5.3 |
| ~~3~~ | ~~`stripRichText` 的 `LAYOUT` 数字键缺陷落记录~~ | ✅ **已完成**：落为 [`docs/decisions/proposed/0003-richtext-layout-numeric-marker.md`](../decisions/proposed/0003-richtext-layout-numeric-marker.md)（按 `proposed/` 骨架：Problem / Proposal / 强制的 Alternatives considered / Acceptance criteria / Risks） |
| 4 | `zzz_api_research.md` §5/§7 的正文本身（不止加警示） | 属历史报告，改正文会篡改历史记录。**建议**：要么保持「加警示 + 不改正文」（现状），要么迁入 `docs/research/` 并重写结论——**需你拍板** |
| ~~5~~ | ~~快照数值统一口径~~ | ✅ **已完成**：`scripts/audits/README.md` 表内 3 处错值已改（见 §5.4），其余加「2026-10 实测」或改为「运行取当前值」/「取自 sitemap，不写死」 |
| ~~6~~ | ~~`DESIGN.md` §8 测试表非穷举~~ | ✅ **已处置**：表头加「示例，非穷举；完整清单见 `tests/`」——**不补全整表**，因为那会变成第二份「随测试增长而腐烂的清单」 |

### 5.3 第三轮：按用户决策执行的两项 SSoT 收敛

用户拍板了两个此前悬而未决的产品决策，已按决策落地：

**决策一：`README.md` 瘦身为人类极简指引。**
把「技术栈」从 6 条长句压成 3 行并声明事实源是 `package.json` / `src/domain/schema.ts`；
把「本地开发」的完整命令清单（含 `verify:*` / `download:*` 全套）压成 4 条上手命令 + 指向
`DATA_GUIDE.md` §7；把「数据源」的端点细节压成 2 段 + 指向 `DATA_GUIDE.md` §1/§3/§4/§5/§8。
**保留**：「文档地图」（并补上 `QUALITY.md` 与 `docs/README.md`）、**「部署（Vercel）」整节不动**
（它是全仓唯一的 Vercel 环境变量说明，删了就没人知道 `VITE_SITE_ORIGIN` 必须手设）、版权。
用户原有的未提交改动（第 8 行「路线图」→「**实施状态**」）已保留。

**决策二：目录树的单一事实源归 `README.md`。**
`DESIGN.md` §4.2 从「一棵残缺的目录树」改为「**目录树见 README** + 读树看不出来的架构说明」：
`domain/` 为何是单一事实源、`catalog.ts` 驱动什么、`devRoutes.ts` 的摇树约定、
`utils/` 的唯一例外（`viewTransition/`）、`scripts/build/` 的五模块划分。
并显式记下**此前两棵树为何漂移**（DESIGN 漏列 `views/`、`utils/`、`domain/{compare,heroCatalog,search}.ts` 等），
让后人知道这条 SSoT 是踩过坑才定的。

**验证**：全仓 Markdown 死链终检 = **零**；`DESIGN.md` 内已无第二棵 `src/` 树。

### 5.4 第四轮：审计工具箱表内的快照数字复核

`scripts/audits/README.md` 的表格把「检查项」和「基线数值」写在一起，其中 3 处与脚本实际不符。
全部以**脚本源码实测**为准改正（不采信文档转述）：

| 行 | 文档原值 | 实测 | 依据 |
|---|---|---|---|
| `regression-walk.js` | 95 项 / 95/95 | **96 项 / 96/96** | `^\s*add\(` 调用数 = 96（`add` 定义在 `:3`，不匹配该模式；`add2` 零调用） |
| `axe-a11y.js` | 14 路由 × 2 = 28 组合 | **15 路由 × 2 = 30 组合** | `axe-a11y.js` 的 `routes` 数组 15 项、`viewports` 2 项，`:74` 计算 `routes.length * viewports.length` |
| `print-mode.js` | 30/30 | **36/36** | `print-mode.js:18` 6 路由 × `:76-81` 6 断言 |
| `transfer-profile.js` | 53 请求 / 751KB | 保持数值，加「**2026-10 实测，运行取当前值**」 | 属历史实测，无法离线复核；加口径而非改数字 |
| `content-sweep.js` | 「全站 238 页」 | 改为「**页数取自 `dist/sitemap.xml`，不写死**」 | 页数随数据增长，写死必然腐烂（`content-sweep.js:18` 本就动态读 sitemap） |

`keyboard-journey.js` 的「15 条任务 / 15/15」经核验**正确**（`add(` 调用 15 处），未改。

### 5.5 目标达成情况

| 目标条款 | 状态 | 证据 |
|---|---|---|
| (1) 清零 §4.3 的 P1/P2 失真项 | ✅ | 除下方「唯一保留项」外全部修复；逐条状态见 §5.1–§5.4 |
| (2) 四项 SSoT 收敛 | ✅ | 设计语言 4 处 → 一句判据 + 唯一指向；`README.md` 瘦身；`QUALITY.md` 复跑依据迁出 `temp/`；快照数值统一口径 |
| (3) 零死链（含反引号口径） | ✅ | 全仓已跟踪 + 新建 Markdown 终检 = 零 |
| (4) 每轮跑门禁 | ✅ | `npm test` = **439 passed / 46 files**（改 `package.json`、`verify-budget.mjs`、`scripts/probes/` 后均复跑） |
| (5) 只改文档、不碰用户源码 | ✅ | `App.vue` / `QuickSearch.vue` / `SiteHeader.vue` / `catalog.ts` / 3 个 audits `.js` 时间戳仍为 **00:xx**，逐文件可验证 |

**唯一保留项**：`zzz_api_research.md` §5/§7 的正文本身（现在只加了取代警示，未改正文）——
这是**刻意的**：改历史报告的正文等于篡改历史记录。它需要一个「保留并警示」还是「迁入 `docs/research/` 并重写」的产品决策，不由本轮单方面决定。

**超出「只改文档」但必要的 3 项**（均已单独说明理由）：
`package.json` 加 `preview --port 4175`（否则 27 个审计脚本按文档跑不起来）、
`.gitignore` 删掉对已跟踪文件无效的规则、`scripts/verify-budget.mjs` 修两处失真注释
（含指向会被清空的 `temp/` 的指针，以及「≤ 66KB」与常量 70 不符）。

