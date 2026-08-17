# DESIGN.md · 空洞档案架构设计

> 本文档是项目**架构设计**（愿景、分层、契约、路线图），与 [DATA_GUIDE.md](./DATA_GUIDE.md)（数据事实）和 [AGENTS.md](./AGENTS.md)（工作约定）并列。
> 实施过程中本文件保持更新：结构落地后就地修正，不许让文档与代码漂移。

---

## 1. 背景与目标

「空洞档案」是绝区零数据展示型 wiki：Vue 3 + TS + Vite 6，零 UI 框架，构建期生成静态 JSON（public/data/），运行时零外部请求。
项目当前功能完整、视觉成立，但结构层存在**契约漂移、视图重复、零测试、单文件管线**四类问题，阻碍新增内容类型与长期维护。

本次重构目标（与用户多轮对齐后确认）：

1. 建立**数据契约单一事实源**，让 build 管线与前端永远无法漂移（含运行时校验 + CI 门禁）。
2. 前端**分层化**：视图变薄、逻辑进 composables、重复下沉为组件、状态无库。
3. **测试基建**从零到一，保护高风险纯逻辑。
4. 保持现有铁律与视觉语言（见 §10），**不推倒重来、不改视觉**。

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
utils（纯函数：text / rich / names / urls —— 无组件、无状态，可单测；data 与其平级互不依赖）
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
  data/
    api.ts               # 瘦身：请求层（timeout/错误归一化/baseUrl/lang）
    resources.ts         # 新增：类别驱动表，消除 4 组 list/detail 重复
    types.ts             # 保留：由 schema 推导的类型别名（向后兼容 import 面）
  composables/           # 新增
    useAsyncResource.ts  # 统一异步状态机（idle/loading/success/error/refetch）
    useCatalogList.ts    # 列表 + 筛选 + 搜索 + 计数（通用化）
    useRouteParam.ts     # 路由参数响应式化
    usePageMeta.ts       # per-route title/eyebrow/description
  components/
    layout/              # SiteHeader / SiteFooter（从 App.vue 抽出）
    list/                # CatalogTable / SearchField / FilterChips
    state/               # AsyncState（loading/error/empty 统一呈现）
    detail/              # DetailSection / KeyValueGrid / DescRow（技能/影画/皮肤共用行）
    HollowImage.vue      # 保留
  views/                 # 变薄：每个 view 只用 composables + 组件拼装
  styles/                # 维持 token 方案；CSS 变量为唯一设计事实
  router/index.ts        # lazy 路由 + route meta（title/eyebrow/desc）
scripts/
  build/                 # 拆模块：manifest / domains / normalize / io / index 等
  build-data.mjs         # 变薄：入口（顺序编排）
  verify-data.mjs        # 新增：对 public/data/ 做 zod 校验（可独立跑、可挂 CI）
  verify-icons.mjs       # 保留
tests/                   # 测试（vitest；见 §8）
docs/DESIGN.md           # 本文档（或仓库根）
```

## 5. 数据契约（核心机制）

### 5.1 单一事实源

- src/domain/schema.ts 用 zod 定义全部产出形状：CharacterListItem、CharacterDetail、WEngineListItem、WEngineDetail、Bangboo…、DiskDrive…、Manifest。
- 前端类型：src/data/types.ts 改为 z.infer 导出，删掉手写防御类型与 [k: string]: unknown 兜底（删除后逐页过 vue-tsc，消灭全部 as 断言）。
- 构建管线：scripts/build/ 直接 import 同一份 schema（zod 是运行时校验器，Node 天然可用；若工具链要求，build 侧经编译产物或 tsx 运行，保持单一 import 面）。
- 校验门禁：scripts/verify-data.mjs 对 public/data/ 全部文件跑 safeParse；名录数量、详情字段缺失、未知键都会非零退出。

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
- useCatalogList(config) → 输入 attrs/profession/query，输出 filtered/count：把 AgentsView 的筛选逻辑通用化；各列表页只需声明可筛字段。
- useRouteParam(name) → 响应式 param（连续导航同一组件时正确切换）。
- usePageMeta(meta) → 写 document.title 与 meta description（三级：路由 meta 默认 → 页面覆盖 → 数据名覆盖）。

### 6.2 组件

| 组件 | 职责 | 吸收的重复 |
|---|---|---|
| SiteHeader / SiteFooter | 布局 | App.vue 的结构+样式 |
| AsyncState | loading/error/empty 呈现 | 各列表页三件套 |
| SearchField | 搜索框 + 计数 | 4 处复制 |
| FilterChips | 筛选按钮组 | AgentsView 的 chips 区块 |
| CatalogTable | 列配置驱动表格 | 4 张手写表格；列配置声明渲染/格式化/插槽 |
| DetailSection | 编号 section-head 容器 | 详情页 01/02/03 头部 |
| KeyValueGrid | 数值网格 | 角色/音擎 stat-grid |
| DescRow | 序号+标题+富文本行 | skill/talent/skin 行 |

### 6.3 视图瘦身目标（验收指标）

- 各列表页 ≤ 120 行 template 声明 + 少量逻辑。
- AgentDetailView ≤ 180 行（区块拆到 detail/ 组件，或拆为局部 section 组件）。
- 行为不变：现有路由、筛选、搜索、图标链、富文本渲染全部保持。

### 6.4 路由

- 全部 route 改 () => import(...) 懒加载（首屏只加载当前页）。
- route meta：title / eyebrow / description；usePageMeta 消费。
- 新增 404 视图（/:pathMatch(.*)* 不再是 redirect 到 /，显示档案式 404）。
- 新增设计系统文档路由（见 §9）。

## 7. 数据管线重构

scripts/build-data.mjs（237 行）拆为：

```
scripts/build/
  manifest.mjs      # 版本读取
  io.mjs            # 下载缓存 + 写盘（现有 fetchJson/dump 迁入）
  normalize.mjs     # 规整纯函数（normalizeCharacterDetail 等，可单测）
  domains/
    character.mjs / weapon.mjs / bangboo.mjs / equipment.mjs
  index.mjs         # 编排（现状 main() 的逻辑）
```

- 规整函数全部改为纯函数（输入 raw detail → 输出规整 detail），纳入测试。
- 借用 schema 做规整后校验（parse 收集错误列表，失败打印出错文件与字段）。
- 新 npm scripts：npm run data（不变）、npm run verify:data（新增）、npm test（新增）。
- 验证链：data → verify:data → test → build（CI 或本地手动按序执行）。

## 8. 测试策略（P0 先铺安全网）

| 对象 | 内容 |
|---|---|
| utils/text.ts | stripRichText 全部标记分支（color/IconMap/LAYOUT/BR/残留标签） |
| utils/rich.ts | 转义 + 两类定向还原 + 注入安全（<script> 被转义） |
| domain/enums.ts | 枚举全集、Tier 映射 |
| data/api.ts | mock fetch：缓存命中、错误归一化、lang/baseUrl 拼接 |
| data/resources.ts | 类别表驱动：listPath/detailPath 的 URL 正确性 |
| scripts/build/normalize.mjs | 用 fixture JSON 验证规整（含皮肤回退、英文值） |
| scripts/verify-data.mjs | 对 mock 数据目录的通过/失败用例 |
| 组件（@vue/test-utils） | HollowImage 候选回退、AsyncState 三态、SearchField v-model、CatalogTable 列渲染 |
| 视图冒烟 | 每个 view mount 后（mock 数据层）正常渲染关键节点 |

vitest 配置：node 环境测 utils/domain/api；jsdom + test-utils 测组件；aliases 与 vite.config 共用。

## 9. 设计系统文档（ADR-006）

- 新增 /style 路由 → StyleGuideView.vue：陈列 tokens（色彩/字号/间距/圆角/边框）、chips、search、table、按钮、HollowImage 占位态、富文本行——全部用真实组件渲染，带使用说明与命名规范。
- 样式层保持 tokens.css + base.css + 组件 scoped，不改变任何像素。
- 该页同时充当开发者的组件速查手册，组件命名规范（PascalCase，职责单一）自此书面化。

## 10. 铁律（重构不得违反）

1. **运行时零外部请求**：前端只读本地 /data；数据构建期落地（npm run data）。
2. **版本号不硬编码**：一律从 manifest 的 zzz.latest 动态取。
3. **图标走 <HollowImage> + src/data/icons.ts 候选链**，禁止直连单一外部图源。
4. **富文本经 rich.ts / stripRichText**，禁止裸插值；v-html 只在白名单渲染函数后使用。
5. **视觉语言不变**：1px 细线框、2px 圆角、等宽编号、纸墨配色；无圆角卡片堆叠/渐变霓虹/投影。
6. **临时文件只进 temp/**；测试 fixture 属仓库内容，进 tests/fixtures 或各模块旁 fixture 目录。
7. **git 约定**：<type>: <中文摘要>；数据文件改动伴随 scripts 升级；不入库 dist/temp/.cache/_research_*。
8. **新增依赖需两把锁一致**（package-lock.json + pnpm-lock.yaml）。

## 11. 分阶段路线图

> 每阶段独立可交付、可回滚；验收标准明确后合入主分支。

### P0 基线加固（安全网优先）—— ✅ 已完成

- [x] 引入 vitest + @vue/test-utils + jsdom（vitest ^3.2.7，pnpm-workspace.yaml 需允 esbuild 构建）
- [x] 为 utils/text.ts、utils/rich.ts、domain/enums.ts、utils/names.ts 写测试（29 用例，全部锁定当前行为）
- [x] 合并 locName/pickName → utils/names.ts（唯一实现）；api.ts 旧 export 改为转发
      —— **实际发现**：pickName 在 text.ts 中无任何调用方（死代码），视图全部使用 locName
- [x] 枚举从 types.ts 迁入 domain/enums.ts（新增 HIT_TYPES），types.ts 再导出（零调用方改动）

### P1 数据层与列表一致化

- domain/catalog.ts + data/resources.ts + api.ts 重构（timeout/错误归一化/baseUrl/lang 参数）
- useAsyncResource / useCatalogList / AsyncState / SearchField / FilterChips / CatalogTable
- 4 个列表页迁移（行为不变，代码量减半），HomeView 目录改用 catalog

### P2 详情页拆分

- DetailSection / KeyValueGrid / DescRow
- AgentDetailView / WEngineDetailView 瘦身；TalentRow 等类型迁入 domain 单一定义

### P3 契约落地

- schema.ts（zod）定义全部产出；types.ts 改为 z.infer 派生并删除 as 断言与 unknown 兜底
- build 脚本拆模块 + 复用 enums + 规整纯函数化
- verify-data.mjs + npm script + 验证链（含 CI 顺序）

### P4 体验与文档

- 路由懒加载 + route meta + usePageMeta + 404 页
- 设计系统页 /style（StyleGuideView）
- AGENTS.md 验证链补 test / verify:data 步骤；README 补架构指针

## 12. 开放问题（后续轮次可讨论）

- 是否需要 SEO 预渲染（SSG/prerender）——当前 SPA 无 SSR，搜索引擎抓取有限。
- 是否做数据增量更新（只写变更详情，减少 git 噪声）。
- 是否需要内容搜索（全文检索索引 JSON）。
- 新增类别（敌人/材料/徽章）时按 §5.3 catalog 走通的接入流程。

### P0 测试锁定的两个真实行为（待修复决策）

1. **rich.ts 的 IconMap 捕获组丢前缀**：`<IconMap:Icon_Normal>` 渲染为 `…/Normal.webp`
   而非 `…/Icon_Normal.webp`（捕获组取了 `Icon_` 之后的字段）——**✅ P0 已修复**。
   修复：捕获组改为 `(Icon_\w+)` 保留完整资产名，本地 SVG 字形（skillGlyphs.ts）得以命中；
   未知名资产走 CDN 时 URL 也恢复带前缀。tests/rich.test.ts 已锁定「本地 SVG 优先 + CDN 兜底」两个分支。
2. **stripRichText 放行带数字的 LAYOUT 标记**：正则 `LAYOUT_[A-Z]+#` 无法跨越数字
   （如 `{LAYOUT_PS5#O}` 原样保留）。若真实数据出现 `PS5` 等标记会漏洗，多为无害残留，
   修复时把 `[A-Z]+` 扩为 `[A-Z0-9]+` 并补用例。