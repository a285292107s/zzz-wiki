# DESIGN.md · 绳网档案架构设计

> 本文档是项目**架构设计**（愿景、分层、契约、路线图），与 [DATA_GUIDE.md](./DATA_GUIDE.md)（数据事实）和 [AGENTS.md](./AGENTS.md)（工作约定）并列。
> 实施过程中本文件保持更新：结构落地后就地修正，不许让文档与代码漂移。

---

## 1. 背景与目标

「绳网档案」是绝区零数据展示型 wiki：Vue 3 + TS + Vite 6，零 UI 框架，构建期生成静态 JSON（public/data/），运行时零外部请求。
项目当前功能完整、视觉成立，但结构层存在**契约漂移、视图重复、零测试、单文件管线**四类问题，阻碍新增内容类型与长期维护。

本次重构目标（与用户多轮对齐后确认）：

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
| ADR-004 | 多语言 | **预留 lang 参数，默认 zh，本轮不做切换 UI** | 数据四语齐全，架构一次到位，入口以后加 |
| ADR-005 | 状态管理 | **保持无状态库，composables 解决** | 当前规模组合式函数足够，不引入 pinia |
| ADR-006 | 设计系统 | **维持 token 方案 + 新增设计系统文档页** | 视觉不动，组织方式文档化 |
| ADR-007 | 交付物 | DESIGN.md 落地为唯一架构依据 | 本轮实施依据 |

## 3. 现状问题（重构动机，代码级证据）

| 级别 | 问题 | 证据 |
|---|---|---|
| P0 | 数据契约两侧漂移、无机器校验 | scripts/build-data.mjs 的 SPECIALTY_EN 只到 6，前端 PROFESSIONS 已有 7（锋御）；类型全部 [k: string]: unknown，视图靠 as 断言 |
| P1 | 视图重复 | 4 个列表页各自手写 page-head/toolbar/loading/error/empty/表格行；AgentDetailView 529 行，TalentRow 两处重复声明 |
| P2 | 逻辑分裂重复 | locName（api.ts）与 pickName（text.ts）同一逻辑两份实现；枚举映射 types.ts 与 build 脚本双份；App.vue 导航与 HomeView sections 双份事实 |
| P3 | 数据层朴素 | 无超时/重试、错误归一化粗糙、BASE 硬编码 /data、LANG=zh 写死、缓存只进不出 |
| P4 | 零测试 | package.json 无 test script；正则清洗、规整逻辑、图标候选链均无单测保护 |

## 4. 目标架构

### 4.1 分层与依赖规则（单向依赖，禁止跨层回跳）

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
utils（纯函数：text / rich / names / contrast / cameraRect —— 无组件、无状态，可单测；data 与其平级互不依赖）
```

规则：
- views 不得直接调 fetch、不得写 async 状态机样板、不得复制枚举映射；这些必须走 composables / domain。
- components 不感知路由、不发起请求（纯 props/emits/slots）。
- domain 不依赖任何 Vue 产物；utils 不依赖 Vue。
- 图标链（HollowImage + icons.ts）保持现状，作为铁律执行点，只做 API 稳定性整理。

### 4.2 目标目录

```
src/
  domain/                # 新增：单一事实源
    enums.ts             # 从 types.ts 迁出 ELEMENTS/PROFESSIONS/HIT/RANK_TO_TIER 等
    catalog.ts           # 4 类目唯一元信息（导航/首页/路由共用一份）
    schema.ts            # zod 数据契约（build 与前端共享）
    sections.ts          # 详情区块行构建（SkillRow/StatItem/SkinRow/潜能合成/段×指标转置表）
    skillFormula.ts      # 技能公式求值引擎（{Skill:}/{CAL:} 解析与等级代入，独立单测）
    filterIcons.ts       # 属性/职业筛选图标键（FilterDropdown 用）
    devRoutes.ts         # dev-only 页面元数据（/style、/calibrate；路由 DEV 分支 + 页脚派生）
    featuredPool.ts      # 今日角色精选池 zod schema（featured-pool.json 读写共用）
    scrollspy.ts         # 详情页/公式页吸顶导航滚动监听（active 区段判定）
    signatureEngine.ts   # 代理人 ↔ 专属音擎 互链解析（命名约定 + 覆盖表，纯函数可单测）
  data/
    api.ts               # 瘦身：请求层（timeout/错误归一化/baseUrl/lang）
    resources.ts         # 新增：类别驱动表，消除 4 组 list/detail 重复
    types.ts             # 保留：由 schema 推导的类型别名（向后兼容 import 面）
    icons.ts             # 图标候选链（本地 img/* → nanoka CDN 两级兜底）+ 技能键位资产名映射
    terms.ts             # 术语词典（读 /data/live/noun.json，供 TermTip）
    heroCalibration.ts   # AgentHead 移动端头图构图参数访问器（featured-pool calibrated 表）
    heroGenderVariants.ts / hero-gender-variants.json # 双形态 hero 文件（单一事实源，见 IMG_GUIDE）
    featured-pool.json   # 今日角色精选池（校准工具 dev 中间件读写）
    formulaGuide.ts      # 战斗公式图文内容（/formulas 页面数据源）
  composables/           # 新增
    useAsyncResource.ts  # 统一异步状态机（idle/loading/success/error/refetch）
    useCatalogList.ts    # 列表 + 筛选 + 搜索 + 计数（通用化）
    useRouteParam.ts     # 路由参数响应式化
    usePageMeta.ts       # per-route title/eyebrow/description
  components/
    layout/              # SiteHeader / SiteFooter（从 App.vue 抽出）
    list/                # CatalogTable / SearchField / FilterDropdown / ListPage
    state/               # AsyncState / CatalogTableSkeleton / ErrorBoundary
    detail/              # DetailPage / DetailSection / KeyValueGrid / DescRow / DetailHead / AgentHead / SkillGroup / CoreSkillGroup / LevelSlider / StatLevelPanel / TermTip
    BackToTop.vue / Rarity.vue / Tags.vue / HollowImage.vue / FormulaEq.vue
  views/                 # 变薄：每个 view 只用 composables + 组件拼装
  styles/                # 维持 token 方案；CSS 变量为唯一设计事实
  router/index.ts        # lazy 路由 + route meta（title/eyebrow/desc）
scripts/
  build-data.ts          # 入口（顺序编排，npm run data）
  sync-data.ts           # 数据+图标同步（唯一写者，npm run sync；data-sync workflow 定时触发并提交）
  build/                 # 拆模块：io / normalize / domains / live-target / index（+ download-icons.mjs）
  verify-data.ts         # 对 public/data/ 做 zod 校验（可独立跑、可挂 CI）
  verify-icons.mjs       # 保留
tests/                   # 测试（vitest；见 §8）
```

## 5. 数据契约（核心机制）

### 5.1 单一事实源

- src/domain/schema.ts 用 zod 定义全部产出形状：CharacterListItem、CharacterDetail、WEngineListItem、WEngineDetail、Bangboo…、DiskDrive…、Manifest。
- 前端类型：src/data/types.ts 改为 z.infer 导出，删掉手写防御类型与 [k: string]: unknown 兜底（删除后逐页过 vue-tsc，消灭全部 as 断言）。
- 构建管线：scripts/build/ 直接 import 同一份 schema（zod 是运行时校验器，Node 天然可用；若工具链要求，build 侧经编译产物或 tsx 运行，保持单一 import 面）。
- 校验门禁：scripts/verify-data.ts 对 public/data/ 全部文件跑 safeParse；名录数量、详情字段缺失、未知键都会非零退出。

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
- useCatalogSort → 列表排序状态（列键/方向）与 URL 同步。
- useDetailNavigation → 详情页相邻条目的前后翻页。
- useDetailSections → 详情区块行构建（复用 domain/sections.ts）。
- useNavScrollable → 详情页/公式页导航条横滑（窄屏单行 scroll-snap + 桌面滚轮/按钮）。
- useFeaturedAgents → 首页「今日角色」精选池（读 featured-pool.json，每次挂载随机取 4 张）。
- useHeroForm → 双形态角色（1551 佩洛伊斯）形态选择，模块级状态 + localStorage 持久化（详见 IMG_GUIDE）。
- anchorOffset → 锚点避让偏移计算（router scrollBehavior 与吸顶横条同源，读 CSS 变量 --anchor-offset）。

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
| DetailSection | 编号 section-head 容器 | 详情页 01/02/03 头部 |
| KeyValueGrid | 数值网格 | 角色/音擎 stat-grid |
| DescRow | 序号+标题+富文本行 | skill/talent/skin 行 |
| Rarity / Tags | 稀有度 / 属性职业标签 | 各列表/详情页重复 |
| HollowImage | 多候选图 + 文字降级 | 全站图标统一入口 |
| DetailPage | 详情页容器（页头/区块编排） | 4 个详情页共享结构 |
| StatLevelPanel | 属性等级滑条面板（1–60、突破刻度） | 角色详情等级展示 |
| TermTip | 术语悬停浮层（读本地 noun.json） | 富文本术语锚点交互 |
| NameCell | 名录名单元格（四语名/阵营） | 4 张表格的名列 |
| SignatureRef | 边缘注记式交叉引用（代理人 ↔ 专属音擎 互链），footnote 风格无卡盒；`thumb` 按素材原始高宽比定盒 | 代理人 hero / 音擎 head 的归属引用 |
| FormulaEq | 战斗公式条目排版（/formulas 页） | 公式图文统一渲染 |

### 6.3 视图瘦身目标（验收指标）

- 各列表页 ≤ 120 行 template 声明 + 少量逻辑（AgentsView total 151 行，template ≈65 行）。
- AgentDetailView 组装层（template + script）≤ 160 行（实测 template ≈155 行；含样式与后续新增展示块的总行数不作硬指标）。
- 行为不变：现有路由、筛选、搜索、图标链、富文本渲染全部保持。

### 6.4 路由

- 全部 route 改 () => import(...) 懒加载（首屏只加载当前页）。
- route meta：title / eyebrow / description；usePageMeta 消费。
- 新增 404 视图（/:pathMatch(.*)* 不再是 redirect 到 /，显示档案式 404）。
- 新增设计系统文档路由（/style；见 §9）。
- 新增战斗公式页（/formulas，FormulasView + FormulaEq 组件 + formulaGuide.ts 单一事实源）。
- dev-only 页面机制（2026-08 集中）：route 的 DEV 分支按 `domain/devRoutes.ts` 登记注册（/style、/calibrate），
  生产构建 `import.meta.env.DEV=false` 整块摇树移除——dev 页在 prod 不可达、零打包。
  router scrollBehavior 统一处理 hash 锚点避让（读 --anchor-offset，见 composables/anchorOffset）。

## 7. 数据管线重构

scripts/build-data.ts 拆为：

```
scripts/build/
  io.ts              # 下载缓存 + 写盘（fetchJson / dump / mapConcurrent / resetOut）
  normalize.ts       # 规整纯函数（normalizeCharacterDetail 等，可单测）
  domains.ts        # 角色/音擎/邦布/驱动盘 名录+详情构建
  live-target.ts     # 合规版本选择（resolveLiveTarget：live 缺失/不在 available 即抛错，纯函数可单测）
  index.ts           # 编排（版本探测 → 抓取 → 写盘）
```

- 规整函数全部改为纯函数（输入 raw detail → 输出规整 detail），纳入测试。
- 借用 schema 做规整后校验（parse 收集错误列表，失败打印出错文件与字段）。
- 新 npm scripts：npm run data（不变）、npm run verify:data（新增）、npm test（新增）。
- 验证链：data → verify:data → test → build（CI 或本地手动按序执行）。

### 7.1 数据刷新与可靠性模型（2026-08）

数据更新由**单一写入者**承担，部署**只读**：

```
数据更新（唯一写者）                       部署（只读）
npm run sync ──▶ .github/workflows/data-sync.yml（每日 cron）
  探测新版本 → 重建 JSON → 图标 --soft 补差 → 汇总
  工作流内 npm run verify:data（硬门禁）通过 → commit + push 默认分支（master）
                                                └─▶ Vercel 部署（build:ci 只构建已提交快照）
```

- **单一写入者**：`scripts/sync-data.ts`（`npm run sync`）是唯一自动化写入 `public/data/` 的入口；
  `ci-data.ts`（部署期重建）已删除。部署 `build:ci` 只构建已提交快照，不再构建期重建数据。
- **尽力构建 + 完整门禁**：构建容忍单文件抖动（`fetchDetails` 详情失败重试后跳过），但 `verify:data`
  是「可提交」的唯一裁决，并升级为「契约 + 完整性」：schema 合法 + 名录非空 + **名录 id ↔ 详情文件
  一一对应** + `extra_level` 单调。任一不满足 → 不提交（保留 last-good，顺延下次）。
- **JSON 严格 / 图标宽松**：内容必须完整（缺一阻断）；展示资产缺失则降级（CDN/文字占位）并自愈，不阻塞提交。
- **图标自愈**：`download-icons.mjs --soft` 每次同步都跑（幂等的存在性差集，只补缺失），瞬态失败的图标下次自愈。
- **失败 → 响应**：源站不可达 → 不动 last-good、图标仍可自愈、下轮重试；构建抛错 / 门禁不通过 → 不提交、下轮重试；
  图标缺失 → 降级 + 自愈。
- **取舍**：以「可用性让位于完整性」为代价——源站**持续**缺详情会冻结更新（门禁标红，需人工介入）；
  部署不再自愈（生产数据刷新对 cron 依赖更高）。

## 8. 测试策略（P0 先铺安全网）

| 对象 | 内容 |
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

1. **运行时零外部请求**：前端只读本地 /data；数据构建期落地（npm run data）。
2. **版本号不硬编码**：一律从 manifest 的 zzz.live 动态取（站点只展示正式服数据，见 DATA_GUIDE §1）。
3. **图标走 <HollowImage> + src/data/icons.ts 候选链**，禁止直连单一外部图源。
4. **富文本经 rich.ts / stripRichText**，禁止裸插值；v-html 只在白名单渲染函数后使用。
5. **视觉语言稳定**：核心不变——1px 细线框、2px 圆角、等宽编号、纸墨配色；无圆角卡片堆叠/渐变霓虹/立体投影（浮层阴影除外，见 `--shadow-pop`）。字体族（CJK 衬线优先、sans 弃 `Inter`）与浮层阴影染 `--bg-0` 属 **token 级精修**，记录点见 `tokens.css` 注释、`/style` 页（§9）与 `DATA_GUIDE §7/§10`，不在本条禁令之列。
6. **临时文件只进 temp/**；测试 fixture 属仓库内容，进 tests/fixtures 或各模块旁 fixture 目录。
7. **git 约定**：<type>: <中文摘要>；数据文件改动伴随 scripts 升级；不入库 dist/temp/.cache/_research_*。
8. **依赖单锁**：只维护 `package-lock.json`（npm），勿再引入 pnpm/yarn 锁文件（AGENTS.md §4）。

## 11. 分阶段路线图

> 每阶段独立可交付、可回滚；验收标准明确后合入主分支。

### P0 基线加固（安全网优先）—— ✅ 已完成

- [x] 引入 vitest + @vue/test-utils + jsdom（vitest ^3.2.4，锁内解析 3.2.7）
- [x] 为 utils/text.ts、utils/rich.ts、domain/enums.ts、utils/names.ts 写测试（29 用例，全部锁定当前行为）
      —— **P0 时点**覆盖 14 个测试文件：text(10) + rich(10) + names(5) + icons(6) + schema(7) +
        sections(91) + api(12) + catalog-list(10) + catalog-sort(6) + catalogtable(3) +
        filterdropdown(7) + core-skill-group(6) + contrast(6) + styleguide-colors(4)
        = **183 用例全绿**（此后随新功能持续扩充，见 tests/，当前 27 个测试文件）
- [x] 合并 locName/pickName → utils/names.ts（唯一实现）；api.ts 旧 export 改为转发
      —— **实际发现**：pickName 在 text.ts 中无任何调用方（死代码），视图全部使用 locName
      —— **后续清理**：locName 别名已完全移除（api.ts 不再转发），所有调用方改用 pickName
- [x] 枚举从 types.ts 迁入 domain/enums.ts（新增 HIT_TYPES），types.ts 再导出（零调用方改动）

### P1 数据层与列表一致化 —— ✅ 已完成

- [x] domain/catalog.ts（4 类目唯一元信息）+ data/resources.ts（类别表驱动）+ api.ts 重构
      （kind 式 list/detail + DataError 归一化 + 10s 超时 + BASE_URL 派生 + lang 参数预留；
      旧 characters() 等兼容接口保留，新代码走 api.list / api.detail）
- [x] composables：useAsyncResource（状态机收编三件套）、useCatalogList（筛选/搜索/计数通用化）、useRouteParam
- [x] 组件：AsyncState / SearchField / FilterDropdown（属性/职业/阵营下拉，showAttr/showProf/showCamp 开关 + 数据驱动 camps）/ CatalogTable（列配置驱动 + 行插槽）
- [x] 4 个列表页迁移（行为不变，代码量减半以上；样式组件化后 CSS 由 21.95kB 降至 19.04kB）
- [x] App.vue 导航与 HomeView 目录改由 catalog 派生（删除手写双份）
- [x] App.vue 拆分：抽出 SiteHeader / SiteFooter（布局组件），App.vue 降至 51 行薄壳
- [x] 新建 ListPage 组件：吸收 4 个列表页共享的 .page / .page-head 样式，消除 8 处重复定义
- [x] tests/api.test.ts（mock fetch：normalize/路径/缓存/错误归一化三分支 + resources 表驱动），12 用例全绿

### P2 详情页拆分 —— ✅ 已完成

- [x] 组件：DetailHead（页头：eyebrow/标题/meta slot/画像）/ DetailSection（编号区块）/
      KeyValueGrid（数值网格）/ DescRow（序号+标题+正文行，variant 保视觉差异）
- [x] composables：useAsyncResource 直接驱动详情页（kind + id.value，连续导航自动 reload；useDetailResource 薄包装已移除）
- [x] domain/sections.ts：DetailRow / SkillRow / StatItem / SkinRow + dictToRows /
      buildSkillRows / buildSkinRows / SKILL_* 常量（TalentRow 等重复类型收敛于此）
- [x] AgentDetailView 529→~290 行（含样式；组装层 ≤160 行），WEngineDetailView 338→~168 行
      —— 后续新增潜能/核心技/等级滑条（StatLevelPanel 等）后：AgentDetailView 562 行（template ≈155 行，
        组装层仍 ≤160），WEngineDetailView 213 行
- [x] 视觉/行为不变：技能本地 SVG 图标、富文本渲染、皮肤缩略图全部保留
      —— 技能图标方案后续已回退 CDN 图（删 SkillIcon.vue/skillGlyphs.ts，见 §12 开放问题 1）
- [x] tests/sections.test.ts（91 用例）+ tests/catalogtable.test.ts（3 用例）+ tests/filterdropdown.test.ts（7 用例，jsdom）；
      vitest.config 接入 @vitejs/plugin-vue。build 通过（CSS 降至 17.64kB）

### P3 契约落地 —— ✅ 已完成

- [x] src/domain/schema.ts（zod 3.24）：全部产出 schema（名录/详情/manifest），.catchall 保留未知字段
- [x] src/data/types.ts 改为纯派生（z.infer + type-only import；zod 未进前端 bundle，134KB 不变）
- [x] build 管线拆模块（scripts/build/{io,normalize,domains,index}）经 tsx 运行；
      英文枚举从 domain/enums 复用——**修复历史漂移：1611 克拉蕾/4 音擎的 weapon_type
      从 fallback 中文「锋御」修正为规范英文 Armorer**（5 个数据文件语义修正）
- [x] scripts/verify-data.ts：manifest + 4 名录 + live 全量详情（225：58 角色 / 95 音擎 / 42 邦布 / 30 驱动盘）zod 校验，失败非零退出
- [x] 验证链：npm run data → verify:data → npm test → npm run build（AGENTS.md 已更新）
- [x] 新增 tests/schema.test.ts（契约通过/失败用例）

> P3 发现：角色 stats 存在数组字段（stats.tags）——schema 由 Record<number> 放宽为
> number|string|array，前端 STAT_DEFS 加 typeof 守卫（AgentDetailView）。

### P4 体验与文档 —— ✅ 已完成

- [x] 路由全量懒加载（每视图独立 chunk；主包 134KB→103KB，gzip 49.99→40.78KB）
- [x] route meta（title）+ usePageMeta（三级：组件标题覆盖 → route meta → 站名；description 注入）
- [x] NotFoundView（档案式 404，替代 redirect 到首页）
- [x] StyleGuideView（/style）：真实组件陈列 + 运行时读取 CSS 变量（token 零二次维护）
- [x] footer 增设计系统入口；AGENTS.md 验证链已补 test/verify:data；README 补架构指针（P0 时已完成）
- [x] 全局错误边界 ErrorBoundary：包裹 RouterView，渲染异常时捕获并显示友好回退（避免白屏）
      —— 2026-08 移除 live/latest 双版本后，`:key="dataVersion"` 重置机制已随版本切换一并删除
- [x] 术语系统：`<Term:N>` 富文本锚点（rich.ts）+ TermTip 悬停浮层 + terms.ts 读本地 noun.json（构建期下沉 live 单版本）
- [x] 移除 useDetailResource 薄包装：4 个详情页直接用 useAsyncResource + api.detail
- [x] 移除 locName 别名死代码：全站统一使用 pickName
- [x] ATTR_CODES / SPEC_CODES 从 domain/enums 派生：消除 useCatalogList 中的硬编码枚举漂移
- [x] schema.ts / normalize.ts / verify-data.ts 补充依赖方向与设计取舍文档

## 12. 开放问题（后续轮次可讨论）

- 是否需要 SEO 预渲染（SSG/prerender）——当前 SPA 无 SSR，搜索引擎抓取有限。
- 是否做数据增量更新（只写变更详情，减少 git 噪声）。
- 是否需要内容搜索（全文检索索引 JSON）。
- 新增类别（敌人/材料/徽章）时按 §5.3 catalog 走通的接入流程。

### P0 测试锁定的两个真实行为（待修复决策）

1. **rich.ts 的 IconMap 捕获组丢前缀**：`<IconMap:Icon_Normal>` 曾渲染为 `…/Normal.webp`
   而非 `…/Icon_Normal.webp`。**已处理（用户决策）**：技能图标先整体回退至 `dbc0c72` 的
   CDN 官方图方案（删除 SkillIcon.vue / skillGlyphs.ts 本地 SVG；rich.ts 恢复 CDN img），
   但捕获组保留 `(Icon_\w+)` 全名修正——不再请求丢前缀的 404 URL；
   随后（2026-08）技能键位图标随 `download-icons.mjs` 再次本地化到 `img/skill/`，
   现候选链为「本地 img/skill → nanoka CDN → .rich-key-broken 占位」，见 DATA_GUIDE §5。
   tests/rich.test.ts 锁定「本地 key image + data-cdn + 全资产名」行为。
2. **stripRichText 放行带数字的 LAYOUT 标记**：正则 `LAYOUT_[A-Z]+#` 无法跨越数字
   （如 `{LAYOUT_PS5#O}` 原样保留）。若真实数据出现 `PS5` 等标记会漏洗，多为无害残留，
   修复时把 `[A-Z]+` 扩为 `[A-Z0-9]+` 并补用例。