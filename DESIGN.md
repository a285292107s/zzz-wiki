# DESIGN.md · 绳网档案架构设计

> 本文档是项目**架构设计**（愿景、分层、契约、实施状态），与 [DATA_GUIDE.md](./DATA_GUIDE.md)（数据事实）和 [AGENTS.md](./AGENTS.md)（工作约定）并列。
> 实施过程中本文件保持更新：结构落地后就地修正，不许让文档与代码漂移。

---

## 1. 背景与目标

「绳网档案」是绝区零数据展示型 wiki：Vue 3 + TS + Vite 6，零 UI 框架，构建期生成静态 JSON（public/data/），运行时零外部请求。
> ⚠ **本节是重构启动时的快照**：当时功能完整、视觉成立，但结构层存在**契约漂移、视图重复、零测试、单文件管线**四类问题。**这四类问题现已全部解决**（见 §11）——下面的「重构目标」是**当时**的目标，不是待办；读现状请看 §4–§9。

当时确认的重构目标（**已完成**，见 §11）：

1. 建立**数据契约单一事实源**，让 build 管线与前端永远无法漂移（含运行时校验 + CI 门禁）。
2. 前端**分层化**：视图变薄、逻辑进 composables、重复下沉为组件、状态无库。
3. **测试基建**从零到一，保护高风险纯逻辑。
4. 保持现有铁律与视觉语言（见 §10），**不推倒重来、不改视觉**（token 级精修除外，见 §10 铁律 5 附注）。

## 2. 决策记录（ADR）

| # | 决策 | 结论 | 理由 |
|---|---|---|---|
| ADR-001 | 重构范围 | **全套 P0→P4** | 一步到位，避免半套架构再次漂移 |
| ADR-002 | 契约校验方案 | **引入 zod** | 类型推导一流、生态成熟；尺寸代价可接受（构建/校验侧使用，不进入运行时热路径） |
| ADR-003 | 测试基建 | **vitest + @vue/test-utils** | 纯逻辑 + 组件行为都值得保护 |
| ADR-004 | 多语言 | **预留 lang 参数，默认 zh，本重构轮不做切换 UI**（入口已由 [决策记录 0010](./docs/decisions/0010-multilingual-game-content.md) 补上：游戏内容四语；界面短文案于 [0011](./docs/decisions/0011-multilingual-ui-copy.md) 一并四语化，长文页保持中文并加注记） | 数据四语齐全，架构一次到位，入口以后加 |
| ADR-005 | 状态管理 | **保持无状态库，composables 解决** | 当前规模组合式函数足够，不引入 pinia |
| ADR-006 | 设计系统 | **维持 token 方案 + 新增设计系统文档页** | 视觉不动，组织方式文档化 |
| ADR-007 | 交付物 | DESIGN.md 落地为唯一架构依据 | 本轮实施依据 |

> 以上 7 条是**重构期的历史决策**，保留备查。**新决策一律写入 [`docs/decisions/`](./docs/decisions/)**
> （格式、六类封闭集与红线见该目录 README）——不要继续往这张表里加行。

## 3. 现状问题（重构**前**快照，代码级证据）

> ⚠ **本节是历史快照**：描述的是本轮重构**启动时**的状态，**不是现状**。文中问题已全部解决
> （见 §11 实施状态）——`package.json` 现已有 `test`（vitest run），文中证据所指的
> `scripts/build-data.mjs` 已拆为 `scripts/build/*.ts`。
> **不要据此判断「还需修什么」**；保留本节只为记录重构动机与当时的证据口径。
> 当前结构以 §4–§9 为准。

| 级别 | 问题 | 证据 |
|---|---|---|
| P0 | 数据契约两侧漂移、无机器校验 | scripts/build-data.mjs 的 SPECIALTY_EN 只到 6，前端 PROFESSIONS 已有 7（锋御）；类型全部 [k: string]: unknown，视图靠 as 断言 |
| P1 | 视图重复 | 4 个列表页各自手写 page-head/toolbar/loading/error/empty/表格行；AgentDetailView 529 行，TalentRow 两处重复声明 |
| P2 | 逻辑分裂重复 | locName（api.ts）与 pickName（text.ts）同一逻辑两份实现；枚举映射 types.ts 与 build 脚本双份；App.vue 导航与 HomeView sections 双份事实 |
| P3 | 数据层朴素 | 无超时/重试、错误归一化粗糙、BASE 硬编码 /data、LANG=zh 写死、缓存只进不出 |
| P4 | 零测试 | package.json 无 test script；正则清洗、规整逻辑、图标候选链均无单测保护 |

## 4. 目标架构

### 4.1 分层与依赖规则

> ⚠ **以下层序图是「设计意图」，不是实测事实。** 实测存在双向与回跳：
> `domain ↔ data`、`composables ↔ components`、`composables ↔ router`、`utils → Vue`。
> **实际边界（含已登记的例外）以 [`docs/architecture.md`](./docs/architecture.md) 为准**——
> 那是 `src/**` 全量 import 扫描的结果。**不要按本节的箭头做重构**：照箭头推导会得出
> 「把图标分类从 `data/` 搬进 `domain/`」这类与图标链 SSoT 冲突的结论。

```
views（薄页面，只做拼装）
  ↓
composables（状态与交互逻辑：异步状态机、列表筛选、路由参数、页面元信息）
  ↓
components（无状态展示组件；视觉与 DOM 只出现在这一层）
  ↓
domain（单一事实源：枚举、目录元信息、zod schema）
  ↓
data（请求实现：只依赖 domain 的 schema 推导类型）
  ↑
utils（纯函数：text / rich / names / contrast / cameraRect —— 目标是无组件、无状态，可单测）
```

**真硬边界**（这些实测成立，违反即返工）：

- **components 不得 import `router` / `views`**，也不得发起请求（纯 props/emits/slots）——实测当前
  为零违规，保持住。
- **枚举只定义在 `src/domain/enums.ts`**；`src/data/types.ts` **只做再导出**（见 §5.2）。
- **views 不得写 async 状态机样板、不得复制枚举映射**——必须走 composables / domain。
- **图标链（HollowImage + icons.ts）保持现状**，作为铁律执行点，只做 API 稳定性整理。

已接受的例外与新增边界的登记流程，见 [`docs/architecture.md`](./docs/architecture.md) §4。

### 4.2 目录结构

> **目录树的单一事实源是 [`README.md`](./README.md) 的「目录结构」节**——本节**不再维护第二棵树**。
> 此前两棵树已经漂移：本节漏列 `views/`、`utils/`、`domain/{heroCatalog,search}.ts`、
> `components/QuickSearch` 等多处。这里只保留**读目录树看不出来的架构说明**。

- **`domain/` 是单一事实源**：枚举（`enums.ts`）、4 类目元信息（`catalog.ts`）、zod 契约（`schema.ts`）。
  `data/types.ts` **只做再导出**，不新增定义（见 §5.2）——这条曾经漂移过（上游职业只到 6，前端已有 7 锋御），所以固定下来。
- **`catalog.ts` 驱动导航 / 首页目录 / 路由定义 / 列表页**：改类目顺序只改这一处。
- **`domain/devRoutes.ts`** 登记 dev-only 页面（`/style`、`/calibrate`）；生产构建整块摇树移除（§6.4）。
- **`utils/` 目标是纯函数**，唯一例外是 `utils/viewTransition/`（有状态、依赖 Vue 的编排层）——
  例外已登记在 [`docs/architecture.md`](./docs/architecture.md) §4，**迁出与否尚未拍板**。
- **`scripts/build/`** 拆为 `io` / `normalize` / `domains` / `live-target` / `index` 五模块（详见 §7）。

逐目录的**调用边界（允许调谁 / 严禁调谁）**不在本节——见 [`docs/architecture.md`](./docs/architecture.md)。

## 5. 数据契约（核心机制）

### 5.1 单一事实源

- src/domain/schema.ts 用 zod 定义全部产出形状：CharacterListItem、CharacterDetail、WEngineListItem、WEngineDetail、Bangboo…、DiskDrive…、Manifest。
- 前端类型：src/data/types.ts 改为 z.infer 导出，删掉手写防御类型与 [k: string]: unknown 兜底（删除后逐页过 vue-tsc，消灭全部 as 断言）。
- 构建管线：scripts/build/ 直接 import 同一份 schema（zod 是运行时校验器，Node 天然可用；若工具链要求，build 侧经编译产物或 tsx 运行，保持单一 import 面）。
- 校验门禁：scripts/verify-data.ts 对 public/data/ 全部文件（四语 × 名录/详情）跑 safeParse；**门禁口径**是
  「契约形状 + 名录非空 + 名录 id ↔ 详情文件一一对应 + 四语名录 id 集合一致 + extra_level 单调」——
  **未知键不会失败**（所有 schema 均追加 `.catchall(z.unknown())`，
  见 `src/domain/schema.ts`；这是为向前兼容而做的取舍，不是遗漏）。

### 5.2 枚举同步

- ELEMENTS / PROFESSIONS / HIT / RANK_TO_TIER 只存在于 src/domain/enums.ts（含 7=锋御 等全集）。
- build 脚本删除自带 ELEMENT_EN / SPECIALTY_EN / HIT_EN，改从同一份 enums 生成英文值。
- 新增类别时只有一处要改：enums + catalog + schema（理想情况下 catalog 驱动 schema 字段选择）。

### 5.3 目录元信息

src/domain/catalog.ts 定义 4 类目（代理人/音擎/邦布/驱动盘）唯一事实源：
路由路径、编号、中文名、英文名、描述、图标候选、list 文件名、detail 目录、schema 类型引用。
→ App.vue 导航、HomeView 目录、路由定义、列表页全部由 catalog.ts 派生，删除手写双份。

## 6. 前端模块设计

### 6.1 composables

- useAsyncResource(fetcher) → { data, status, error, reload }：状态机收编 views 里手写的 loaded/error/loading 三件套；配合 watchEffect 支持路由参数变化自动 refetch。
- useCatalogList(config) → 输入 attrs/profession/camp/query，输出 filtered/count：把 AgentsView 的筛选逻辑通用化；各列表页只需声明可筛字段（阵营为数据动态提取，见 AgentsView）。
- useRouteParam(name) → 响应式 param（连续导航同一组件时正确切换）。
- usePageMeta(meta) → 写 document.title 与 meta description（三级：路由 meta 默认 → 页面覆盖 → 数据名覆盖）。
- useCatalogSort → 列表排序状态（列键/方向）与 URL 同步。**名录页一律不摆排序控件**
  （2026-10：排序钮和同一行的筛选钮、卡片版的标本签陈列互相挤，表格版又只能靠「表头能点」的暗示）；
  代理人两版、音擎、驱动盘都留着它算默认编号倒序，并照读历史 `?sort=&dir=` 链接——屏上仍有
  排序入口的只剩邦布名录（列头）。
- useAgentsViewVersion → 代理人名录的**版式偏好**（卡片名录 / 表格名录），模块级 ref + localStorage
  持久化；**只在本机生效，不进 URL**（分享出去的 `/agents` 链接不带版本）。
- useDetailNavigation → 详情页相邻条目的前后翻页。
- useDetailSections → 详情区块行构建（复用 domain/sections.ts）。
- useNavScrollable → 详情页/公式页导航条横滑（窄屏单行轨道，两端淡出 + 出口按钮；桌面滚轮/按钮）。
- useFeaturedAgents → 首页「今日角色」精选池（读 featured-pool.json，**当天生日的角色优先**，按日期确定性取 4 张；生日表见 featured-birthdays.json）。
- useHeroForm → 双形态角色（1551 佩洛伊斯）形态选择，模块级状态 + localStorage 持久化；
  **切换入口在设置页 `/settings`**，详情页/首页/名录卡片只读（**文件规则与 SSoT 见 `DATA_GUIDE.md` §5**；展示技法见 IMG_GUIDE）。
- useLocale → **当前展示语言**（`zh`/`en`/`ja`/`ko`），模块级 ref + localStorage 持久化 + `<html lang>` 同步；
  同一次切换覆盖两层：**游戏内容**（名称/技能/描述/术语释义，随四语数据面）与**界面短文案**
  （导航/按钮/区块标题/筛选/空错态/检索面板/设置页/页面 meta，随四语文案表 `domain/uiText.*.json`
  ＋ `useUiText`）；**站内中文长文**（`/about`、`/formulas`）与构建期静态产物不翻译，
  长文页对非中文读者挂「本页仅中文」注记。列表与详情按语言取数：
  `listFor`/`detailFor` 的 `lang` 是必填参数，`useAsyncResource` 的 watchEffect 读到它后自动重新取数。
  语言集**单一事实源是 `src/domain/langs.json`**（有序语言清单）：TS 侧经 `domain/lang.ts` 读它，
  `.mjs` 侧经 `scripts/build/langs.mjs` 读同一份，两条工具链不各写一遍。**切换入口在设置页**，**不进 URL**；
  范围与取舍见 [决策记录 0010](./docs/decisions/0010-multilingual-game-content.md)（数据面）与
  [0011](./docs/decisions/0011-multilingual-ui-copy.md)（界面文案）。
- anchorOffset → 锚点避让偏移计算（router scrollBehavior 与吸顶横条同源，读 CSS 变量 --anchor-offset）。
- useUiText → **当前语言的界面文案树**（`const { t } = useUiText()`，模板读 `t.list.code`）。
  文案表按语言整树替换，不做逐键合并；「与数据同处的标签」不进这张表（见 `domain/uiText.ts` 文件头的分工）。

### 6.2 组件

| 组件 | 职责 | 吸收的重复 |
|---|---|---|
| SiteHeader / SiteFooter | 布局 | App.vue 的结构+样式 |
| ListPage | 列表页容器（.page / .page-head 样式） | 4 个列表页的重复定义 |
| AsyncState | loading/error/empty 呈现 | 各列表页三件套 |
| CatalogTableSkeleton | 表格骨架屏 | 各列表页加载态 |
| ErrorBoundary | 渲染异常捕获 + 友好回退 | 避免白屏 |
| SearchField | 搜索框 + 计数 | 4 处复制 |
| FilterDropdown | 筛选下拉（属性/职业/阵营，图标 + 自定义面板） | 各列表页的筛选区块 |
| CatalogTable | 列配置驱动表格 | 4 张手写表格；列配置声明渲染/格式化/插槽 |
| CardGrid | 档案栅格（栅格几何 + 卡壳 + 骨架 + 空态；卡内内容经插槽） | 驱动盘 / 音擎两个栅格名录页的栅格与骨架外壳 |
| AgentCardGrid | 代理人 9:16 立绘名录格（校准取景 + 图下标本签 + 骨架 + 空态） | 代理人名录卡片版空态复用 `NoMatchState`；卡壳是留白分栏 + 取景框，与 `CardGrid` 的卡片盒几何不同源 |
| AgentCardList | 代理人卡片陈列体（渐进加载：首屏 18 条 + 滚动续载；无观察器时退化为按钮） | 卡片版的续载逻辑从视图里拆出，与页面壳解耦 |
| AgentTableList | 代理人表格陈列体（列配置 + 四语名/标签/稀有度单元格） | 表格版名录的行模板从视图里拆出 |
| CardBlock | 卡内「块」（上细线 + 等宽小字标签 + 注记 + 内容） | 卡片的 2/4 件套、基础属性、音擎效果等分块 |
| NoMatchState | 「检索/筛选无匹配」空态（标题 + 出路 + 一键清除） | 表格空态行与栅格空态的重复文案 |
| DetailSection | 编号 section-head 容器 | 详情页 01/02/03 头部 |
| KeyValueGrid | 数值网格 | 角色/音擎 stat-grid |
| DescRow | 序号+标题+富文本行 | skill/talent/skin 行 |
| Rarity / Tags | 稀有度 / 属性职业标签 | 各列表/详情页重复 |
| HollowImage | 多候选图 + 文字降级 | 全站图标统一入口 |
| DetailPage | 详情页容器（页头/区块编排） | 4 个详情页共享结构 |
| StatLevelPanel | 属性等级滑条面板（1–60、突破刻度） | 角色详情等级展示 |
| TermTip | 术语悬停浮层（读**当前语言**的本地 noun.json） | 富文本术语锚点交互 |
| NameCell | 名录名单元格（四语名/阵营；行内与栅格卡名两种排印） | 各表格与栅格名录页的名列 + 详情预热 |
| SignatureRef | 边缘注记式交叉引用（代理人 ↔ 专属音擎 互链），footnote 风格无卡盒；`thumb` 按素材原始高宽比定盒 | 代理人封面 / 音擎 head 的归属引用 |
| FormulaEq | 战斗公式条目排版（/formulas 页） | 公式图文统一渲染 |
| AtlasMap / AtlasDetail | 项目架构页的可缩放分层地图（六块台子、三十四栋等距楼房、四类连线；平移 / 缩放 / 筛选 / 选中）与详情面板（地图侧栏与窄屏行内两处复用）；台长与房子占地按体量、楼层数按连线数，几何由 `utils/isoAtlas.ts` 按固定世界坐标算出，文字是 HTML 覆盖层 | — |

### 6.3 视图瘦身目标（验收指标）

- 各列表页 ≤ 120 行 template 声明 + 少量逻辑。**行数是易变指标，本文件不复述数值**——需要时直接看文件。
- AgentDetailView 组装层（template + script）≤ 160 行（**行数不复述，以文件为准**；含样式与后续新增展示块的总行数不作硬指标）。
- 行为不变：现有路由、筛选、搜索、图标链、富文本渲染全部保持。

### 6.4 路由

- 全部 route 改 () => import(...) 懒加载（首屏只加载当前页）。
- route meta：title / eyebrow / description；usePageMeta 消费。
- 新增 404 视图（/:pathMatch(.*)* 不再是 redirect 到 /，显示档案式 404）。
- 新增设计系统文档路由（/style；见 §9）。
- 新增战斗公式页（/formulas，FormulasView + FormulaEq 组件 + formulaGuide.ts 单一事实源）。
- 新增设置页（/settings，SettingsView）：本机偏好——佩洛伊斯立绘形态与**展示语言**。
  **入口在站头导航第 06 位与首页目录**（导航入口数受 ADR 0004 约束，故替换掉原先占位的档案图谱）；
  **不进 sitemap，也不参与按路由预载**（`generate-route-html.mjs` 的 `VIEW_OF`/`STATIC_META` 无此页）。
- 新增项目架构页（/architecture，ArchitectureView + `AtlasMap` / `AtlasDetail`）：一张**可缩放的等距分层地图**——
  六块台子（外部与构建期 / 入口与壳 / 页面 / 展示 / 状态 / 核心）上立着三十四栋等距楼房，台子长度与房子占地按代码体量分档、
  楼层数 = 接入的连线数，楼上有屋顶女儿墙与楼层窗带、占地够宽的叠一层塔冠（**只靠明暗分档，不画投影**）；
  四类连线（装配调用 / 读取本地 / 站外取源 / 构建产出）用颜色与粗细区分；核心那层是三列并排的栏架；
  可平移、缩放、按类筛线、按层过滤、按名检索，点一格在面板里看路径与上下游。窄屏（<1024）不画地图，
  改成六层模块清单并在行内展开详情。**入口只有页脚**（首页目录只列游戏内容与本机偏好，
  站头导航不加，ADR 0004；见[决策记录 0028](./docs/decisions/0028-chinese-only-pages-and-footer-entries.md)）；
  模块与连线的事实单一事实源是 `domain/atlas.ts`，几何在 `utils/isoAtlas.ts`，图上的读数全部动态取。
  为什么是一张交互地图而不是静物图 / 3D 库 / 构建期扫描，见
  [决策记录 0027](./docs/decisions/0027-architecture-page-as-zoomable-atlas.md)（取代了
  [0025](./docs/decisions/0025-pipeline-page-as-isometric-stair.md) 与
  [0026](./docs/decisions/0026-architecture-page-as-isometric-section.md)）。
- `/agents` 是一个页面（`AgentsView`）内按本机偏好择一渲染两个陈列体：卡片版 `AgentCardList`
  或表格版 `AgentTableList`（都是它的静态导入，故首屏不闪、两版都在预载清单里）；切换钮在
  页面工具栏，版本是本地偏好、**不写 URL**（见 [决策记录 0012](./docs/decisions/0012-agents-view-switch-on-page.md)）。
- dev-only 页面机制（2026-08 集中）：route 的 DEV 分支按 `domain/devRoutes.ts` 登记注册（/style、/calibrate），
  生产构建 `import.meta.env.DEV=false` 整块摇树移除——dev 页在 prod 不可达、零打包。
  router scrollBehavior 统一处理 hash 锚点避让（读 --anchor-offset，见 composables/anchorOffset）。

## 7. 数据管线重构

scripts/build-data.ts 拆为：

```
scripts/build/
  io.ts              # 下载缓存 + 写盘（fetchJson / dump / writeDetails / mapConcurrent / resetOut）
  normalize.ts       # 规整纯函数（normalizeCharacterDetail 等，可单测）
  domains.ts        # 角色/音擎/邦布/驱动盘 名录+详情构建（按 LANGS 逐语言各一套）
  langs.mjs          # 语言集读取（纯 .mjs 工具链用；与 src/domain/lang.ts 共用 langs.json）
  live-target.ts     # 合规版本选择（resolveLiveTarget：live 缺失/不在 available 即抛错，纯函数可单测）
  index.ts           # 编排（版本探测 → 抓取 → 写盘 live/{lang}/）
```

- 规整函数全部改为纯函数（输入 raw detail → 输出规整 detail），纳入测试。
- 借用 schema 做规整后校验（parse 收集错误列表，失败打印出错文件与字段）。
- 新 pnpm scripts：pnpm run data（不变）、pnpm run verify:data（新增）、pnpm test（新增）。
- 验证链：data → verify:data → test → build（CI 或本地手动按序执行）。
- **多语言产出（2026-10）**：`live/` 下按 `LANGS` 各写一套完整数据面（名录 + 详情 + 名词表），
  根下只留 `manifest.json`。语言集单一事实源是 `src/domain/langs.json`，TS 与 .mjs 两条工具链共用。
  取舍见 [决策记录 0010](./docs/decisions/0010-multilingual-game-content.md)。

### 7.1 数据刷新与可靠性模型（2026-08）

数据更新由**单一写入者**承担，部署**只读**：

```
数据更新（唯一写者）                       部署（只读）
pnpm run sync ──▶ .github/workflows/data-sync.yml（每日 cron）
  探测新版本 → 重建 JSON → 图标 --soft 补差 → 汇总
  工作流内 pnpm run verify:data（硬门禁）通过 → commit + push 默认分支（master）
                                                └─▶ Vercel 部署（build:ci 只构建已提交快照）
```

- **单一写入者**：`scripts/sync-data.ts`（`pnpm run sync`）是唯一自动化写入 `public/data/` 的入口；
  `ci-data.ts`（部署期重建）已删除。部署 `build:ci` 只构建已提交快照，不再构建期重建数据。
- **尽力构建 + 完整门禁**：构建容忍单文件抖动（`fetchDetails` 详情失败重试后跳过），但 `verify:data`
  是「可提交」的唯一裁决，并升级为「契约 + 完整性 + 同源」：schema 合法 + 名录非空 + **名录 id ↔ 详情文件
  一一对应** + **四语名录 id 集合一致** + `extra_level` 单调。任一不满足 → 不提交（保留 last-good，顺延下次）。
- **JSON 严格 / 图标宽松**：内容必须完整（缺一阻断）；展示资产缺失则降级（CDN/文字占位）并自愈，不阻塞提交。
- **图标自愈**：`download-icons.mjs --soft` 每次同步都跑（幂等的存在性差集，只补缺失），瞬态失败的图标下次自愈。
- **失败 → 响应**：源站不可达 → 不动 last-good、图标仍可自愈、下轮重试；构建抛错 / 门禁不通过 → 不提交、下轮重试；
  图标缺失 → 降级 + 自愈。
- **取舍**：以「可用性让位于完整性」为代价——源站**持续**缺详情会冻结更新（门禁标红，需人工介入）；
  部署不再自愈（生产数据刷新对 cron 依赖更高）。

## 8. 测试策略（P0 先铺安全网）

| 对象 | 内容（**示例，非穷举**；完整清单见 `tests/`） |
|---|---|
| utils/text.ts | stripRichText 全部标记分支（color/IconMap/LAYOUT/BR/残留标签） |
| utils/rich.ts | 转义 + 两类定向还原 + 注入安全（<script> 被转义） |
| utils/gameMarkup.ts | 标记词法流：rich/text 共享的 tokenizeGameText 单一事实源 |
| utils/names.ts | pickName 四语回退顺序 + 空值边界 |
| domain/schema.ts | zod 契约通过/失败用例（list/detail/manifest） |
| domain/sections*.test.ts | 按域拆分：rows/skills/formula/levels/core 五文件 + 常量契约哨兵 |
| domain/skillFormula.ts | 公式求值引擎（{Skill:} 四则 / {CAL:} 等级代入） |
| data/api.ts | mock fetch：缓存命中、错误归一化、lang/baseUrl 拼接 |
| data/resources.ts | 类别表驱动：listPath/detailPath 的 URL 正确性 |
| 组件（@vue/test-utils） | CatalogTable 排序交互、FilterDropdown 弹层/选择行为 |
| composables | useCatalogList 过滤组合 + URL 同步、useCatalogSort 排序切换 |

> 精简原则（2026-08 评估后）：不写「事实快照」——枚举映射内容（enums.ts）
> 由数据类型 + 数据管道校验兜底，游戏更新时不产生假红；不写纯模板冒烟
> （DescRow/HollowImage 等无算法分支的渲染存在性断言）；不写「实现复制」
> 断言（组件渲染 src 与被测模块同一函数比对，恒真且阻重构）。

vitest 配置：node 环境测 utils/domain/api；jsdom + test-utils 测组件；aliases 与 vite.config 共用。

## 9. 设计系统文档（ADR-006）

- 新增 /style 路由 → StyleGuideView.vue：陈列 tokens（色彩/字号/间距/圆角/边框）、chips、search、table、按钮、HollowImage 占位态、富文本行——全部用真实组件渲染，带使用说明与命名规范。
  （2026-08 起 /style 与 /calibrate 均为 **dev-only** 页面：经 devRoutes.ts 登记、生产构建排除，见 §6.4。）
- 样式层保持 tokens.css + base.css + 组件 scoped，不改变任何像素。
- 该页同时充当开发者的组件速查手册，组件命名规范（PascalCase，职责单一）自此书面化。

## 10. 铁律（重构不得违反）

1. **运行时零外部请求**：前端只读本地 /data；数据构建期落地（pnpm run data）。
2. **版本号不硬编码**：一律从 manifest 的 zzz.live 动态取（站点只展示正式服数据，见 DATA_GUIDE §1）。
3. **站外图标走 <HollowImage> + src/data/icons.ts 候选链**，禁止直连单一外部图源（本地自绘筛选资产例外，见 DATA_GUIDE §5）。
4. **富文本经 rich.ts / stripRichText**，禁止裸插值；v-html 只在白名单渲染函数后使用。
5. **视觉语言稳定**：**设计语言禁令的唯一完整定义在 [`DATA_GUIDE.md`](./DATA_GUIDE.md) §10**，本条不复述要素；token 级精修（字体族、浮层阴影）的记录点是 `tokens.css` 注释与 `/style`（§9），不在禁令之列。
6. **临时文件只进 temp/**；测试 fixture 当前**内联在测试文件内**（仓库无独立 fixture 目录）。
7. **git 约定**：<type>: <中文摘要>；数据文件改动伴随 scripts 升级；不入库 dist/temp/.cache/_research_*。
8. **依赖单锁**：包管理器为 pnpm，只维护 `pnpm-lock.yaml`（版本由 `package.json` 的 `packageManager` 钉住），
   勿再引入 `package-lock.json` 或 yarn 锁文件（AGENTS.md §4；改用 pnpm 的理由与三个坑见决策记录 0005）。

## 11. 实施状态

重构范围 P0→P4（ADR-001）**已全部落地**，源码注释中的阶段标记按此对照：
P0 基线加固（测试安全网、`utils/names.ts` 唯一实现、枚举迁入 `domain/enums.ts`）、
P1 数据层与列表一致化（`catalog.ts` / `resources.ts` / `api.ts` 重构）、
P2 详情页拆分（`domain/sections.ts` 与详情组件）、P3 契约落地（zod schema + `verify-data.ts`）、
P4 体验与文档（懒加载、route meta、/style）。各层现状即上文 §4–§9 所描述的目录与模块
（§4.2 目录树、§5 契约、§6 组件/composables、§7 管线、§8 测试），不再单列已完成任务清单。
后续新增类别按 §5.3 catalog 走通接入流程。

## 12. 开放问题（后续轮次可讨论）

- 是否需要 SEO 预渲染（SSG/prerender）——当前 SPA 无 SSR，搜索引擎抓取有限。
  **量化证据（2026-10，Lighthouse 移动模拟）**：LCP 元素为 hero 文本，
  TTFB 占 ~3s（slow-4G 模型常数，SPA 架构下不可压缩）+ render delay ~0.6s；
  a11y/BP/SEO 已 100、CLS 0.02、TBT 120ms，性能分的天花板就在 TTFB——
  要把 LCP 压进 2.5s 只有 prerender 一条路，做与不做等这个证据再议。
- 是否做数据增量更新（只写变更详情，减少 git 噪声）。
- 是否需要内容搜索（全文检索索引 JSON）。
- 新增类别（敌人/材料/徽章）时按 §5.3 catalog 走通的接入流程。