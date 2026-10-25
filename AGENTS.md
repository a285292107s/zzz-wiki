# AGENTS.md · 工程约定（给 AI / 协作者）

绳网档案 —— 绝区零（ZZZ）资料档案站：Vue 3 + TS + Vite 静态站，数据在构建期拉取落地到
`public/data/`，运行时零外部请求（数据面硬约束；图片候选链兜底例外见 §3）。

> 本文档是**工作约定**，只收录「每个任务都相关」的内容；领域细节一律渐进式披露，按需取用，
> 发现与实际不符时就地修正。
>
> **加载指引**：全局只读本文档；确认任务涉及某领域后再按需读对应文档
> （「什么任务读哪份」的完整索引见 [`docs/README.md`](./docs/README.md)）：
>
> - 数据来源 / 表结构 / 图标兜底 / 失效信号 / 运维命令 → [`DATA_GUIDE.md`](./DATA_GUIDE.md)
> - 架构愿景、分层与目录约定 → [`DESIGN.md`](./DESIGN.md)
> - 图片/媒体展示技法（超宽/透明底/人像立绘如何展示得好 → 公式与核验流程）→ [`IMG_GUIDE.md`](./IMG_GUIDE.md)
> - 品质指标与复跑命令 → [`QUALITY.md`](./QUALITY.md)
> - 模块调用边界（谁可以依赖谁）→ [`docs/architecture.md`](./docs/architecture.md)
> - 数据契约 / 命名 / 术语表 → [`docs/conventions/`](./docs/conventions/)
> - 决策记录（**为什么不用方案 B**，防止重走老路）→ [`docs/decisions/`](./docs/decisions/)

## 0. 硬性禁止项（Negative Constraints）

本节只收录 §3「数据与前端铁律」与 §6「注释与文档」**未覆盖**的禁止项——**数据面零外部请求、
图片候选链、富文本、版本号、措辞一致性五项见 §3**（设计语言的**完整定义在
[`DATA_GUIDE.md`](./DATA_GUIDE.md) §10**，§3 只留判据）；**代码不写注释与决定落点见 §6**；
此处不重复，避免两处各自漂移。

1. **不读就不断言**：未实际读取文件，禁止声称「已检查过」；路径与事实用工具核验，不靠推测。
2. **不擅自加依赖**：需要新库先说明理由并由用户拍板；能原生实现就不引库。
3. **不重复造 helper**：改逻辑前先查 `src/utils/` 与 `src/domain/`；同一功能禁止多处实现。
4. **不夹带重构**：只改本任务相关的代码；未被要求的重写不做。
5. **不写水文档**：不生成未被要求的样板文档、前言、客套；已落盘的文档**不复述代码与字段定义**
   （字段定义归 `src/data/types.ts` / `src/domain/schema.ts`；决定类记录的判据与落点见 §6）。
6. **不把 `temp/` 当仓库**：`temp/` 已 gitignore 且会被清空；验收依据与长期脚本不得只存在于 `temp/`
   （既有基线文件 `temp/quality-baseline.md` 即属此类，不可依赖——基线归 `QUALITY.md`）。
7. **不手改生成物**：`public/data/**` 由 `pnpm run sync` 与 `pnpm run data` 写入（**两者都会写盘**），
   生成物（含名词表 `live/{lang}/noun.json`）禁止手工追加内容——重建时会被覆盖。

## 1. 临时文件：只放 `temp/`

- **统一归口**：一切临时产物（调试脚本、一次性导出/下载、截图、验证中间件）放 `temp/`
  （已 gitignore、随时可清空、用完即删）；下载缓存走 `.cache/`。禁止丢进根目录、`src/`、`public/`。

## 2. Git 提交约定

- **提交前检查**：`git status` 确认临时产物不入库；发现新类型临时产物时**优先加 `.gitignore` 规则**。
- **提交信息**：用仓库既有风格 `<type>: <中文摘要>`（feat/fix/chore/refactor），重要变更带正文要点。
- **生成物入库**：`public/data/**` 是生成物但**约定入库**（勿删勿忽略）；改动数据文件时检查是否伴随构建脚本升级。

## 3. 数据与前端铁律

- **运行时零外部请求（数据面）**：前端只读本地 `/data`；数据版本号从 `manifest.json` 动态取，禁止硬编码。
  措辞要与实现一致：**数据面零外部请求是硬约束**；**图片面**唯一例外是候选链兜底——本站资源缺失时
  才回源同源 CDN（nanoka），且**不得新增直连外部图源**（禁止把兜底当主源用）。
- **图标候选链**：**站外图源**一律经 `<HollowImage>`，**禁止直连单一外部图源**（工具清单见 DATA_GUIDE §6）；
  **本地筛选图标资产例外**（属性/职业/阵营图标，单一事实源 `src/domain/filterIcons.ts`）——消费方
  `FilterDropdown.vue`（筛选下拉，属性/职业/阵营三组选项的图标）**直接渲染本地 `iconUrl`**，
  不经候选链、不发外部请求。
- **富文本处理**：游戏标记文本（`<color=#…>`、`<IconMap:…>`）展示层一律经富文本工具处理，禁止裸插值（见 DATA_GUIDE §6）。
- **设计语言（"档案标本"）**：**完整要素与禁令见 [`DATA_GUIDE.md`](./DATA_GUIDE.md) §10**，本条不复述。
  判据一句话：出现圆角卡片堆叠、渐变霓虹、投影，就是返工项。
- **不 AI 味**：优雅、克制——当产出像常见模板站（圆角 + 渐变 + 投影 + 满屏卡片）时，宁可返工。

## 4. 环境与命令

- **依赖**：包管理器为 pnpm（版本由 `package.json` 的 `packageManager` 钉住），锁文件只维护 `pnpm-lock.yaml`
  （勿再引入 `package-lock.json` 或 yarn 锁文件）；新增依赖用 `pnpm add <pkg>`。
  ⚠ pnpm 配置只读 `pnpm-workspace.yaml`（`package.json` 的 `pnpm` 字段已失效）；依赖的安装脚本须在该文件
  的 `allowBuilds` 里逐一审批，否则 `pnpm install` 会以 `ERR_PNPM_IGNORED_BUILDS` 非零退出（详见决策记录 0005）。
- **日常命令**：开发 `pnpm run dev`（http://localhost:5173）；构建 `pnpm run build`（含 vue-tsc）；
  单测 `pnpm test`（**全量，不用选择器**：整套约 11 秒，选择器要读要维护，比它省下的时间贵）；
  一个命令看全部验证：`pnpm run check`（= `check:diff --run`）。
- **验证只有一个入口：`pnpm run check`**（干跑只用 `pnpm run check:diff`）。规则只三条：
  1. 非文档改动一律跑 `npx vue-tsc -b` + `pnpm test` + `node scripts/verify-cjk-fonts.mjs`（合计约 25 秒）。
  2. 改到渲染面（`src/views|components|styles|composables|utils|data/`、`App.vue`、`main.ts`、`index.html`）
     再加 `pnpm run verify:ui`——**它会自己起 dev 服务、用完自己关**，不需要先开 5173。
  3. 其余（数据真值、部署配置、审计脚本、构建依赖）只打印「手动看一眼」，不自动跑。
  纯域逻辑（`src/domain/`）不触发浏览器层：数值口径由单测守，页面文案由发版前的 content-sweep 兜。
- **`pnpm run verify:ui`**：3 断点（1440/768/390）查渲染锚点、图片 alt、横向溢出、控制台错误与 axe（首末视口），
  截图落 `temp/verify-ui/`，实测约 8 秒/路由。路由默认**按改动推断**：改视图只查它自己的路由；
  改共享组件/样式则查**首页 + 全部名录页**（宁可多查一页，也不要只查一页就报绿）。
  详情页要指定实例时 `-- --route /w-engines/14164`。会话名带进程号，天生不撞车；
  若仍报「playwright-cli 会话打不开」，先 `playwright-cli list` 看残留、`playwright-cli close` 收掉。
- **浏览器层是发版级，不是迭代级**：`verify:ui` 只守「这一页还在、没溢出、没 axe 违规」；
  几何、构图、键盘旅程、字体墨色、离线与缓存策略**只在发版前**跑：
  合并前 `pnpm run build:ci` + `pnpm run preview` + `pnpm run audit:core`（核心 7 项），
  发版/月度 `pnpm run audit:all`（23 项，约 4 分钟）。审计一项就要几十秒，别拿它当每次编辑的成本。
- **修 bug 的回合只在 dev 验证**（HMR，改一次看一次）；生产构建只在发版前做一次。
- **不为小修复新增审计脚本**：先复跑已有脚本；确需新增，先逐条答准入判据（**五条答不全就不加**，
  全文见 `scripts/audits/README.md`）。最常漏的是判据质量——`计数 === 0` 型是**空真**判据
  （什么都没扫到也报绿），必须同时有正向锚与下限。
- **部署构建入口 `pnpm run build:ci`**（Vercel 已指向；**完整链路以 `package.json` 为唯一事实源**）：
  `build:ci` = `verify:assets` → `verify:data` → `vue-tsc -b` → `build:deploy`；
  `verify:assets` = `verify:fonts` → `verify:icons --local` → `gen:featured-birthdays --check` → `verify:fonts:cjk`；
  `build:deploy` = `vite build` → `sitemap` → `route-html` → `verify:budget` → `verify:vercel`。
  **部署链路里没有单测**：单测归 `.github/workflows/checks.yml`（push/PR，约 30 秒）——发布门槛是
  「类型过 + 能不能构建 + 派生产物一致」，不是「测试全绿」；测试该在人推之前就红。
  整条链本地约 25 秒，收工前跑一次即可（`pnpm run check` 会提示）。
  **只构建已提交快照，不在构建期重建数据**（数据更新走 `pnpm run sync`，见下）。
- **工程质量审计工具箱**（发版/月度，不是日常）：合并前 `pnpm run audit:core`（核心 7 项），
  发版/月度 `pnpm run audit:all`（全箱；清单与基线见 `scripts/audits/README.md`）。
- **数据+图标同步入口 `pnpm run sync`**（`scripts/sync-data.ts`）：唯一自动化写入 `public/data/` 的入口——
  探测新版本 → 重建 JSON → 图标 `--soft` 补差（只补缺失、已有美术资源零重下）→ 重建 CJK 字体子集 → 校验（告警）→ 汇总变更集。
  由 `.github/workflows/data-sync.yml` 定时触发，重算字体子集后过【四道硬门禁】：`verify:data`（数据契约）、
  `verify-icons --local`（图标本地必须项）、`verify-cjk-fonts`（字体覆盖）、`generate-featured-birthdays --check`
  （首页生日表与详情一致）；全过后把**数据 + 图标 + 字体子集**放进同一次提交推到 master → 触发 Vercel 部署，
  任一门禁不过则 job 失败、不提交。四道门禁守的是同一类事故：字体子集与生日表都随上游文本派生、
  却只由部署构建校验——重算后漏提交或漏校验，master 上就会出现「数据新、派生资产旧」的快照，
  表现为部署构建失败。
  门禁前先跑类型与单测（坏了别花十几分钟同步再红）；末尾**对账线上 `/data/manifest.json` 的版本与已提交快照**，
  抓「提交了但部署失败」。
  **探测失败也算失败**：`probeOutdated` 与 `buildAll` 任何异常都非零退出并打印「站点仍停留在 X」，
  workflow 侧写 step summary 并自动开/评论一条「data-sync 失败」issue——曾经的写法是异常直接 `return`（exit 0），
  job 天天绿、站点静默停在旧版，没人知道。确要沿用旧快照时手动加 `--allow-probe-failure`。
  仓库为私有 + 免费套餐，分支保护不可用，故门禁在 workflow 内实现。`pnpm run data` 仅作数据-only 用途。
- **换行符**：文本一律 **LF**，由根级 `.gitattributes` 钉死；改动它之前先读该文件头的规则顺序警示
  （后写规则覆盖先写，二进制声明必须排在文本通配之后）。判据：`git diff --check` 应完全干净。
  详见决策记录 0007。
- **排障顺序**：改动数据管线按 DATA_GUIDE §7 顺序执行；名录/详情数量为 0 或 404 时先查 DATA_GUIDE §8
  失效信号，别急着改前端。

## 5. 沟通与输出约定（AI 回复）

### 5.1 面向读者：弥合上下文差

- **默认读者没读过代码**：不假设用户了解本仓库组件、store、工具函数或 `public/data/` 字段；私有名词
  （组件名、数据键、工具函数）首次出现紧跟括号注明玩家业务含义，如
  `HollowImage（图标兜底组件，玩家看到的是缺失时自动换图源）`。
- **玩家侧文案禁工程黑话**：面向站内用户的措辞不出现未解释的框架术语（hydration、副作用、shallowRef、
  竞态…）；必须讲机制时用游戏逻辑或日常比喻。已在 DATA_GUIDE / DESIGN 定义的词可直接用。
- **直截了当 + 业务收束**：第一句给方案或结论，不讲客套；代码讲完后用 ≤3 条大白话说明「这段改动让玩家
  多看到/看到了什么」，不罗列框架技术细节——与 §3「不 AI 味」同源。
- **交代验证成本**：交付时说清「跑了什么 / 没跑什么、为什么」以及残余风险（一条就够），不写流水账。
  跑了全箱不等于更负责——与本次改动无对应风险的检查只是在烧时间（判据见 §4）。

### 5.2 面向代码：可复制、可复核

- **片段自包含**：给用户复制运行的代码必须带完整 import 与类型定义；引用了当前代码块之外的数据，
  显式标注 `// 【假设外部传入：…】`（仅限回复内示例；入库代码不写注释，见 §6），
  不造突兀孤立命名（`stateMap` → 具体业务名）。
- **名词对照表兜底**：单次给出 >10 行新代码时，代码下方附简表「代码名 → 游戏概念 → 存的是什么」，
  与名词表（`live/{lang}/noun.json`）术语体系保持一致。此表是**回复内的一次性产物**；其中定稿的术语要升级落盘（见 5.3）。
- **数值换算附公式**：技能倍率、掉落概率、`{CAL}` 等级代入等计算逻辑，必须写出算术公式与中文原理，
  scale 语义按游戏实机核实（见 DATA_GUIDE §6）。

### 5.3 面向术语：单一事实源

- **完整定义只写一处**：一个工程术语只在**定义它的那份文档**里有完整定义——一句话「它是什么」
  ＋边界「它**不**包括什么、与近邻术语的区别」；其余地方只引用，不重述、不另立新叫法。
  归属分区：游戏内术语 → [`docs/conventions/glossary.md`](./docs/conventions/glossary.md)（**手写**术语表）；
  数据/工程术语 → DATA_GUIDE；架构术语 → DESIGN。
  ⚠ **不要写进 `public/data/live/{lang}/noun.json`**：那是构建期由源站**全量重建**的生成物
  （`scripts/build/index.ts` → `dump('live', '{lang}/noun.json', …)`），手写内容会被下次 `pnpm run sync`
  整体覆盖。该文件只是**被读取的数据源**，不是落盘位置。
- **立刻落盘**：术语一经敲定**当场写入**归属文档，不批量攒到最后（会话结束时上下文已烂，攒 = 丢）；
  改名时同步更新全部引用，旧名保留为别名。
- **挑战冲突，不静默兼容**：叫法与已有文档或代码命名冲突时，当场指出并给出规范术语让用户拍板
  （改名还是改代码/改文档），禁止默默按自己的理解继续。
- **含糊不落盘**：定义仍含糊的说法挂「待澄清」继续追问，不要先落一个错的定义。
- **通用技术词不是领域术语**：框架名、语言特性等不进术语体系。

## 6. 注释与文档：代码自解释，决定进文档

- **`src/` 与 `scripts/` 不写注释**：文件头、字段说明、「为什么这么写」的那一句都不留，没有例外
  （`.vue` 模板注释与 CSS 注释同样算）。编译指令（`/// <reference …>`、`@ts-expect-error`）不属于
  解释性文字，保留。理想的代码靠命名与结构自解释，读者不需要旁白；一段逻辑要靠旁白才读得懂，
  说明表达力不足：先改代码本身——换命名、拆函数、把约束写进类型或断言，而不是用注释打补丁。
- **注释会腐烂，代码才是唯一真相源**：逻辑一直在改，注释常被忘在原地；一条过时、甚至与逻辑相悖的
  注释危害大于没有注释，因为它会主动误导后来的维护者。宁可让代码自己说话。
- **只有「读代码会做错事」的决定才进文档**。判据是「删掉这句说明，只看代码会不会做错事」：
  外部世界的事实（DSH 契约、第三方 API 行为）、违反后不报错只是悄悄错的不变量、非直觉取舍的理由、
  改 A 必须改 B 的跨文件耦合。命名、类型、断言、结构能表达的，一律不进文档。
- **落点**（同一规则只写一处，别处引用不复述；分区总则见 [`docs/README.md`](./docs/README.md)）：
  - 口径与不变量 → [`docs/conventions/contracts.md`](./docs/conventions/contracts.md)
  - 架构取舍 → [`DESIGN.md`](./DESIGN.md)；调用边界 → [`docs/architecture.md`](./docs/architecture.md)
  - 难逆转的决定（为什么不选方案 B）→ [`docs/decisions/`](./docs/decisions/)
  - 踩过的坑 → 先补进事实所在的领域文档（`DATA_GUIDE` / `IMG_GUIDE` / `QUALITY`）或决策记录的
    `## Consequences`；**不另立 `LESSONS.md` 平行文件**
  - 用法 / 参数 / 运维步骤 → [`DATA_GUIDE.md`](./DATA_GUIDE.md) §7 或
    [`scripts/audits/README.md`](./scripts/audits/README.md)（已有同一事实就只引用，不复制）
- **存量注释按「触达」迁移**：只处理本次改动实际涉及的代码处——仍有决策价值的内容按上面的落点写进
  文档，再删该处注释；没有决策价值的直接删。不要顺手清理整个文件（§0.4 不夹带重构），更不要一次性
  全仓删除——那会把还没落盘的判断一起删掉。
- **记录回执**：新增或改动上述记录后，当次回复用一两句告诉维护者：动了哪份文件、记了什么、
  为什么代码里放不下。别让记录悄悄沉进仓库。
