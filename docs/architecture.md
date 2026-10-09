# 模块职责与调用边界

**用途**：判断「这次 import 是否越界」。本文件只承载**边界**——架构愿景、目录清单、契约细节
分别归 [`DESIGN.md`](../DESIGN.md)、[`DATA_GUIDE.md`](../DATA_GUIDE.md)，此处不重述。

**证据基础**：对 `src/**` 全量 import 扫描（`from '...'` 正则 + 逐层计数）。下表数字是**实测计数**，
不是设计意图。设计意图（`DESIGN.md` §4.1）与实测不符之处已在「已知偏离」中逐条登记。

> ⚠ **当前无分层门禁**：仓库无 eslint/oxlint 配置，也无 conformance 脚本
> （`scripts/` 与 `tests/` 均无匹配）。因此本表靠**人工 review** 守，不是 CI 保证的。

## 1. 分层与实测依赖方向

```
views ──────────▶ components(30) composables(51) data(38) domain(26) utils(19)
components ─────▶ composables(20) data(13) domain(17) utils(7)
composables ────▶ data(10) domain(10) utils(2) components(1) router(1) directives(1)
domain ─────────▶ data(3)
data ───────────▶ domain(7) utils(1)
utils ──────────▶ data(3) domain(2) composables(1)
router ─────────▶ views(1) domain(2) composables(1)
directives ─────▶ （无）
```

括号内为该方向上的 import 出现次数（源码级，含类型导入）。

## 2. 职责与边界表

| 目录 | 核心职责 | 允许依赖 | **严禁** | 实测违规 |
|---|---|---|---|---|
| `src/directives/` | 无状态 DOM 指令 | 无 | 任何业务层 | 无（实测零出边） |
| `src/domain/` | 单一事实源：枚举、目录元信息、zod 契约、区块构建、公式求值、检索 | 自身、zod、**`data` 的少量类型/JSON 资产** | **Vue**（实测零） | 无 Vue 依赖 ✅ |
| `src/data/` | 请求层、类别驱动表、图标候选链、术语词典 | `domain`、`utils`、自身 JSON | 组件、路由 | 无 ✅ |
| `src/utils/` | 纯函数：文本、富文本、命名、对比、取景、手势、标记词法 | `data`、`domain` | **Vue**、上层 | ⚠ `viewTransition/index.ts:31` 导入 Vue；`utils → composables` 1 处 |
| `src/composables/` | 状态与交互逻辑（异步状态机、筛选、路由参数、页元信息） | `domain`、`data`、`utils`、`router` | — | ⚠ 反向依赖 `components` 1 处 |
| `src/components/` | 展示；**不感知路由、不发起网络请求** | `domain`、`data`、`utils`、`composables` | `router`、`views` | ✅ 实测 `@/router`、`@/views` **零命中**；无 `fetch(` |
| `src/views/` | 路由级薄拼装 | 全部下层 | — | ⚠ `CalibrateView.vue` 直连 `fetch('/__calibrate')`（dev-only）**待复核** |
| `src/router/` | 路由与懒加载映射 | `views`、`composables`、`domain` | — | — |

## 3. 真硬边界（违反即返工）

1. **`components/` 不得 import `router` 或 `views`**——组件不知道自己被哪个路由渲染。实测当前为零，
   保持住。
2. **`components/` 不得发起网络请求**——数据一律经 `composables` / `data` 层的 hook 注入。
   （`dataVersions` 这类读版本元信息的工具函数不算请求；5 处 view/component 直接 import `@/data/api`
   取的都是 `dataVersions`，实测非 fetch 调用。）
3. **数据面零外部请求**——前端只读本地 `/data`；图片面唯一例外是候选链兜底，见
   [`AGENTS.md`](../AGENTS.md) §3 与 [`DATA_GUIDE.md`](../DATA_GUIDE.md) §5。
4. **枚举只定义在 `src/domain/enums.ts`**——`src/data/types.ts` **只做再导出**以保留既有 import 面。
   新增枚举值只改 `enums.ts` 一处（实测 `ELEMENTS`/`PROFESSIONS`/`HIT_TYPES`/`RANK_TO_TIER` 均仅此一处定义）。
5. **改动逻辑前先查 `src/utils/` 与 `src/domain/`**——同一功能禁止多处实现。

## 4. 已知偏离（已登记，**不是**待办）

这些是实测存在且**当前被接受**的方向，不是「待修 bug」。改它们需要单独立项并更新本表。

| 偏离 | 具体位置 | 为什么接受 |
|---|---|---|
| `domain → data`（3 处） | `filterIcons.ts:17`（运行时导入 `../data/filter-assets.json`）、`catalog.ts:8`、`signatureEngine.ts:14`（后两者**仅类型**） | 强行单向要么把图标分类搬进 `domain`（造成图标链规则双份，与 DATA_GUIDE §5 的 SSoT 冲突），要么删掉目录驱动表 |
| `data → domain`（7 处） | `api.ts:42`、`resources.ts:7`、`heroCalibration.ts:12`、`types.ts:7-8,29,44` | 契约与枚举本就应由 domain 拥有——这是**正向**依赖，登记在此仅为说明 `domain ↔ data` 并非严格单向 |
| `utils → data`（3 处） | `rich.ts:13`（`@/data/icons`）等 | 富文本渲染需要图标候选链；候选链的 SSoT 在 `data/icons.ts` |
| `utils → Vue`（1 处） | `src/utils/viewTransition/index.ts:31` | `viewTransition/` 是**有状态编排层**（依赖 Vue、`data`、`composables`），放在 `utils/` 下名不副实。两条出路：把它迁出 `utils/`，或把边界规则改为「其余 utils 为纯函数，`viewTransition/` 为显式例外」——**尚未拍板** |
| `composables → components`（1 处） | `useDetailPager.ts:11`（仅 `import type { DetailPagerItem }`） | 仅类型导入，无运行时回跳 |
| `composables ↔ router`（各 1 处） | `composables → router`(1)、`router → composables`(1) | 懒加载映射与锚点偏移互相需要，未造成分层坍塌 |

## 5. 与 `DESIGN.md` §4.1 的差异（必须知道）

`DESIGN.md` §4.1 现存表述为「单向依赖，禁止跨层回跳」，其层序图**与实测不符**：
实测 `domain ↔ data` 双向、`composables ↔ components` 双向、`composables ↔ router` 双向、
`utils → composables` 回跳、`utils → Vue`。

**以本表为准**。§4.1 的层序图应改为引用本文件；在它被修正前，不要按那张图的箭头做重构
（会得出「把图标分类搬进 domain」这类与 SSoT 冲突的结论）。

## 6. 新增模块时

1. 先在下表确认该模块属于哪一层，并只按「允许依赖」列 import。
2. 若确实需要一条新的反向依赖，**先在本文件 §4 登记**（写清位置与为什么接受），再写代码。
3. 不要为了「让图好看」而新增中间层或抽象——本项目的边界表是**约束工具**，不是架构表演。
